# RLS audit — SOW document cluster (0039), acquisition-grade

**Date:** 2026-11-13 · **Auditor:** chat/designer · **Target:** `server/db/rebuild/0039_document_cluster.sql`
**Bar:** the inbox bar (0023) — DB-enforced tenant isolation, `supplier_directory`/definer for cross-org,
org_id pinned by RLS not the app, coverage test. Spec: `prompts/pV2-SOW-01-prompt.md` (pV2-SECURITY-RLS-01).

**Verdict:** shape is right (matches 0023 conventions). **Does not land** until the two ⚠️ write paths are
built as a gated SECURITY DEFINER, the post-sign freeze is DB-enforced, and a coverage test ships. Admin-write
is *not* a 0039 blocker (see F-ADMIN). Findings below; blockers are B1–B3.

---

## The two ⚠️ spots — settled

### B1 · `project_documents` status advance → SECURITY DEFINER, **not** a supplier UPDATE policy
A supplier UPDATE policy is the wrong tool: **RLS is row-level, not column-level** — a policy that lets the
supplier UPDATE the row cannot stop them rewriting `content` / `deposit_pct` / `parties_snapshot`. Column
`GRANT`s layered on top are fragile and easy to get wrong. Use a **gated SECURITY DEFINER** (the `org_contact`
shape from 0023): the engagement + role + status-precondition checks live **inside** the function, `search_path`
pinned, `revoke all from public` + `grant execute to web_app_user`. The supplier gets **no UPDATE policy** on
`project_documents`. The function is the single write path for the supplier's confirm and sign; "field writes
rejected once `status >= supplier_signed`" becomes true by construction (the function simply offers no field write).

### B2 · supplier signature INSERT → **fold into the same definer**, no standalone INSERT policy
A standalone supplier INSERT policy on `project_document_signatures` would let the supplier write a signature row
**decoupled from status validation** — e.g. sign while still `draft`, forge `name`/`title`, or write a second
role. The signature row **and** the status flip must be one atomic, validated write. So: one write path. The
definer (B1) writes the signature and flips status in one transaction; `signer_org_id`/`name`/`title`/`signed_at`
are set **server-side from the session**, never from client input (org_id is sacred — same rule as every row).
The `unique(document_id, role)` index backstops a double-sign; sequencing (ready_to_sign → supplier_signed →
executed) is enforced in the function.

**Recommended definer shape** (both parties funnel through it so the status machine lives in one place):

```sql
create or replace function public.document_sign(p_document_id uuid, p_role text, p_name text, p_title text)
  returns public.project_documents           -- the updated doc row
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare d public.project_documents; v_signer_org uuid;
begin
  select * into d from public.project_documents
   where id = p_document_id and deleted_at is null;
  if not found then raise exception 'document not found'; end if;

  -- role ↔ caller: agency = the owning org; supplier = the engaged provider.
  if p_role = 'agency' then
    if d.org_id <> public.app_current_org() then raise exception 'not the agency'; end if;
    if d.status <> 'supplier_signed'      then raise exception 'agency signs only after supplier'; end if;
    v_signer_org := d.org_id;
  elsif p_role = 'supplier' then
    if not exists (select 1 from public.project_providers pp
                    where pp.id = d.project_provider_id
                      and pp.provider_org_id = public.app_current_org()
                      and pp.org_id = d.org_id and pp.deleted_at is null)
      then raise exception 'not the engaged supplier'; end if;
    if d.status <> 'ready_to_sign' then raise exception 'not ready to sign'; end if;
    v_signer_org := public.app_current_org();
  else raise exception 'bad role';
  end if;

  insert into public.project_document_signatures
    (org_id, document_id, signer_org_id, signer_user_id, role, name, title, created_by)
  values (d.org_id, d.id, v_signer_org, public.app_current_user_id(), p_role, p_name, p_title,
          public.app_current_user_id());

  update public.project_documents
     set status = case when p_role = 'supplier' then 'supplier_signed' else 'executed' end,
         updated_at = now(), updated_by = public.app_current_user_id()
   where id = d.id returning * into d;
  return d;
end $$;
revoke all on function public.document_sign(uuid,text,text,text) from public;
grant execute on function public.document_sign(uuid,text,text,text) to web_app_user;
```
A sibling `document_confirm(p_document_id)` does the supplier's pre-sign confirm (`draft → ready_to_sign`, the
freeze point where lines + `parties_snapshot` + `terms_snapshot` populate) on the same engagement check.

### B3 · post-sign **freeze must be DB-enforced**, not trusted to the service
RLS can't express "no field writes once `status >= supplier_signed`" — and the agency `_all` policy allows the
agency to UPDATE the row regardless of status. So the freeze needs a DB mechanism. Either (a) route **all**
writes through SECURITY DEFINER functions and `revoke update` on the frozen columns from `web_app_user`, or the
simpler (b): a **`BEFORE UPDATE` trigger** that `raise`s if any frozen column (`content`, `deposit_pct`,
`parties_snapshot`, `terms_snapshot`, the line set) changes while `status >= supplier_signed`, allowing only the
status-machine transitions the functions perform. (b) is least-disruptive and belt-and-braces for both parties.
This is the one genuinely new requirement vs 0023 — the inbox has no freeze-after-sign concept.

---

## Strong recommendations (defense-in-depth, align to 0023)

- **S1 · append-only grants on `project_document_signatures`.** It's written only by the definer (B2). Drop
  `update, delete` from the `web_app_user` grant (ideally `insert` too, since the definer owns the write) —
  leave `select`. Mirrors the inbox's deliberate "no DELETE for providers" (audit L2). Makes append-only true at
  the privilege layer, not just by convention.
- **S2 · `deleted_at` on the provider reads.** The three `*_provider_read` policies don't filter
  `project_documents.deleted_at is null`, so a soft-deleted SOW stays visible to the supplier. Add it (the inbox
  reads filter the target row's `deleted_at`). The agency `_all` intentionally sees soft-deleted rows (restore).
- **S3 · coverage test — MANDATORY gate (same as the inbox).** Ship `0039`'s RLS test alongside, modelled on
  `tests/fr00215_write_close.test.js`, asserting: supplier A cannot read supplier B's doc; a non-engaged org
  reads nothing; the supplier has **no** direct INSERT/UPDATE on `project_documents` or `_signatures` (only the
  definer); `document_sign`/`document_confirm` reject a non-engaged caller and an out-of-sequence status; a
  frozen-column UPDATE after `supplier_signed` is rejected (B3). Land gates on this.

## Service-layer gates (not DDL — re-audit when CC writes the service)
- **parties_snapshot / terms_snapshot resolved SERVER-SIDE** at issue via `org_contact`/`supplier_directory` —
  the Angular component never reaches the supplier org (own-org RLS zeroes cross-org). The migration commits to
  this; verify in the service code review.
- **Annex A (`terms_pdf_url`) file access engagement-scoped** — enforced at the storage / signed-URL layer, not
  this table. A supplier's T&C PDF is fetchable only by parties on an actual engagement, not any org that can see
  the directory row. Must be checked when the file-serving path lands.

## Confirmations (CC's questions — all good)
- **org_id pinned via `project_providers`** in the supplier read predicates ✓ (`pp.org_id = d.org_id`, exactly
  0023's audit-M1 pin). The child-row `org_id` is set server-side by the definer (B2); the agency `_all` path is
  parent-pinned, matching the 0020/0018 sibling convention.
- **`project_items.sow_document_id` dropped — AGREED.** In the 3-table model draft membership derives live from
  the supplier's agreed quotes and freezes into `project_document_lines` at issue; a stored back-link on the live
  line is redundant.
- **`content_snapshot` → the plan's shape — AGREED.** `content` (editable narrative sections) + `parties_snapshot`
  + `terms_snapshot` jsonb + frozen `project_document_lines` rows. Freeze on **issue** (ready_to_sign), not create.

## Notes (non-blocking)
- **F-ADMIN · admin-write is NOT a 0039 blocker.** `app_is_admin()` in `with check` matches 0018/0020 — the
  FR-00215 project-cluster admin-write escape is still open **cluster-wide** (closed only for items/orgs). Don't
  special-case 0039 (it would diverge from its siblings); close it in the one coordinated FR-00215 slice before
  launch (bundled w/ data wipe + model review), per the launch gate.
- **deposit_pct dual-home.** Lives as the structured `numeric` column (WS6 reads it) **and** renders inside
  `content.payment_schedule`. Treat the **column as SSOT**; the section renders from it, never a separate input.
- `numeric(5,2)` fits 0–100; app validates the range. Fine.
- Optional: a partial index on `(org_id) where deleted_at is null` for the agency `_all` query.
