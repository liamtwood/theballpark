# RLS audit — SOW document cluster (0039), acquisition-grade

**Date:** 2026-11-13 · **Auditor:** chat/designer · **Target:** `server/db/rebuild/0039_document_cluster.sql`
**Bar:** the inbox bar (0023) — DB-enforced tenant isolation, `supplier_directory`/definer for cross-org,
org_id pinned by RLS not the app, coverage test. Spec: `prompts/pV2-SOW-01-prompt.md` (pV2-SECURITY-RLS-01).

**Verdict:** shape is right (matches 0023 conventions). **Does not land** until the two ⚠️ write paths are
built as a gated SECURITY DEFINER, the post-sign freeze is DB-enforced, and a coverage test ships. Admin-write
is *not* a 0039 blocker (see F-ADMIN). Findings below; blockers are B1–B4.

> **LAND-GATE MET — 2026-11-13 (CC, `ballpark-v2-dev`).** `0039` applied; all four blockers built:
> **B1/B2** `document_confirm` + `document_sign` SECURITY DEFINERs (supplier has no direct write);
> **B3** post-sign freeze trigger (column-scoped); **B4** supersedes same-org/engagement guard as a
> SECURITY INVOKER `BEFORE INSERT/UPDATE` trigger. Strong recs built too: **S1** signatures + lines
> SELECT-only grants, **S2** `deleted_at` on the provider reads. **S3** coverage test
> `server/db/rebuild/tests/0039_document_cluster.test.js` runs as `web_app_user`, **22/22 PASS** — incl.
> cross-supplier isolation, no direct supplier/agency write, definer rejects non-engaged + out-of-sequence,
> frozen-column reject, and the B4 case (agency2 superseding agency1's doc → invisible → not found → rejected).
> **Service-layer gates (parties/terms server-side via `org_contact`/`supplier_directory`; `terms_pdf_url`
> engagement-scoped file access) land in Phase 1 and are NOT yet audited — re-audit owed when the service code is up.**

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

### B4 · `supersedes_document_id` must be **same-org-scoped** (added with the lifecycle 3-cases, 2026-11-13)
`supersedes_document_id` is a nullable self-FK that enforces existence but **not org**. "Superseded" is derived
("a doc with a successor"), and that derivation drives the **"current" set** (current = non-declined AND
non-superseded). So if the derivation counts *any* successor, **org B can insert its own document `S` with
`S.supersedes_document_id = <org A's doc>`** (the `_all with check` only constrains `S.org_id = B`, not the
pointer's target) and thereby make org A's live SOW compute as superseded — it vanishes from A's current list.
That's a cross-tenant **visibility/integrity** attack, not a read leak (RLS still blocks reading the foreign row),
but it's real. Close it on **both** sides:
- **Derivation:** a doc is superseded iff a successor exists with `successor.supersedes_document_id = doc.id`
  **AND `successor.org_id = doc.org_id`** (ideally same `project_id` + `project_provider_id` too — supersession
  is within one engagement chain).
- **Write path:** the change-order creator validates the predecessor is the agency's **own**, same
  `(project, provider)` — in the definer/service that mints the successor (a `CHECK` can't do a subquery; a FK
  can't check org). A `BEFORE INSERT/UPDATE` trigger is the DB-enforced option.
The coverage test (S3) adds a case: org B cannot hide org A's doc via a cross-org supersedes pointer.

**`project_items.sow_document_id` (reinstated) — RLS unchanged, confirmed.** The additive nullable FK does **not**
alter `project_items` visibility: no new policy, so the row's `org_id` (`_all`) + the 0023 message-relation
`provider_read` still govern. A supplier reading a briefed item now sees the `sow_document_id` value, but can read
the referenced SOW only if engaged (the documents `provider_read`) — the uuid itself leaks nothing (they're a
party to it). Minor integrity note (same class as B4, lower impact as it drives no cross-tenant derivation): the
service should set `sow_document_id` only to a same-`project` doc.

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
- **`project_items.sow_document_id` reinstated — RLS unchanged (see B4 block).** Case 3 (more-work SOW) splits a
  supplier's agreed items across several live SOWs, so membership can't derive from "all agreed items"; the live
  link is needed. Visibility unaffected — confirmed above.
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

---

# Bidirectional expansion — SOW supplier-authored direction (`0040`), 2026-11-16

**Target:** `server/db/rebuild/0040_document_cluster_supplier_direction.sql` (additive to 0039).
**Change:** `project_documents` becomes **bidirectional** — `org_id` = the **author** (agency OR supplier).
Agency-authored (0039) is unchanged; supplier-authored is added. Direction = which side of the engagement
(`project_providers`) equals `org_id`. Liam locked the product shape (confirm step **dropped**; supplier authors
content + sets the deposit; agency proposes via inbox + signs-or-doesn't).

**Verdict:** **CLEARED both directions, 2026-11-16.** Conditional sign-off (2026-11-16) issued, all conditions
absorbed into 0040, coverage gate `tests/0040_document_cluster_supplier_direction.test.js` = **31/31 PASS** as
`web_app_user`. The one hard blocker (a missing engagement pin on the mirror read) was caught pre-apply.

## The blocker — caught and closed
**Cross-project read leak on the counterparty read.** The proposed mirror read-widen omitted the engagement pin
`pp.id = d.project_provider_id`. Without it, a single A↔S engagement on one project would widen reads to **every**
SOW between A and S across **all** shared projects. The built 0039 `_provider_read` pins the engagement; the
bidirectional policy had to as well. Closed: 0040 ships ONE unified `*_counterparty_read` policy per table (§1)
that pins `pp.id`, carries S2 (`deleted_at`), requires both reader and owner to be parties, and excludes the owner
(`app_current_org() <> d.org_id`, owner reads via `_all`). Replaces the 0039 `_provider_read` trio on all three tables.

## Conditions — all built
- **(b) Unified counterparty read** — one policy/table, engagement pinned, both directions, S2 carried. ✓ (§1)
- **(c) Engagement guard** (`BEFORE INSERT/UPDATE`, both directions) — `(project_id, project_provider_id)` must be a
  real engagement the owner is a party to **on that project** (`d.project_id = pp.project_id`, newly load-bearing —
  nothing checked it before, either direction). Early-returns on reserved NULL (agency→client). ✓ (§2)
  SECURITY INVOKER: relies on `project_providers` RLS showing **both** parties their shared engagement row — the
  31/31 green (legitimate authors insert; non-parties rejected) confirms it; re-confirm when the service layer reads pp.
- **(d) Derive-the-party sign path** — `document_sign` derives author/counterparty from (session org, `org_id`, pp);
  **never** branches auth on client `p_role` (validated only as an anti-spoof label); `role` stored as party-TYPE
  (agency|supplier); signing **order** (counterparty-first) derived, never stored. ✓ (§4)
- **B3 freeze generalized** — keyed on **signature-existence** (not a status name; preserves the first-signature=
  freeze semantics), extended to the **binding** columns (`project_provider_id`, `project_id`, `org_id`,
  `supersedes_document_id`) so a signed doc can't be re-pointed onto another engagement, dragging its signatures
  into the other party's set. `presentation` stays editable. ✓ (§3)
- **Confirm dropped / status rename** — `document_confirm` retired (signature = acceptance); state machine
  `draft → counterparty_signed → executed (+ declined)`; `sow_status` value `supplier_signed` → `counterparty_signed`
  (the agency can sign first). ✓ (§4 + codelist UPDATE)
- **supplier_org_id denormalized** = the provider party (direction-independent `parties_snapshot`). ✓
- **Ordering note honoured** — the Phase-1 service MUST materialise snapshots/lines **before** the first signature
  insert (once a signature exists the freeze trigger rejects the snapshot write itself). Recorded in 0040 §3/§4.

## Coverage (31/31, both directions)
Cross-project isolation (the `pp.id` pin — A↔S on pp1 can't read S's SOW on pp2) · counterparty-first / author-last
both directions · **role-spoof rejected** both directions (caller claims the other party's role → rejected) ·
engagement guard rejects a non-party author AND `project_id ≠ pp.project_id` · **re-point of a signed doc to another
engagement rejected** (binding freeze) · substance freeze both directions · lockdown (no PUBLIC exec, `search_path`
pinned, `document_confirm` gone).

## Still owed — Phase-1 service re-audit (not DDL)
When the service code lands, re-audit: **snapshot resolution + line materialization** (server-side via
`org_contact`/`supplier_directory`, must run **before** the first signature) · **engagement-scoped file access**
(`terms_pdf_url` + any agency-supplied attachment) · **engagement-scoped SOW aggregation** — the model's biggest
practical risk: every reader that filters `project_documents.org_id = :me` now **misses counterparty-authored docs**,
so all SOW listing/"current-set" derivation must go engagement-scoped. CC flags it in the shipped file.

---

# Phase-1 service re-audit — `sow.service.js` + `routes/sow.js` (843f8a2b), 2026-11-16

Walked the **content-authored v1** service (structured-lines / catalogue-pull deferred, so parties/terms snapshot
resolution + line materialization + file access ride the later enhancement and re-audit then). **Clean on:** `org_id`
sacred (routes pass `req.user.org_id`, never the body); Zod on every body + UUID params; the sign path passes
`org_type` only as a **label** — `document_sign` re-derives the party from the session GUC + engagement and rejects
a mismatch, so a forged role can't sign; `createDraft` checks party membership in the app layer **and** the
engagement guard backstops; `updateDraft` leans on author `_all` and maps the freeze trigger to a 409. Routes inherit
the audited chain (global `requestContext` pin → v2 `authenticate` + `requireActiveMembership`), same as inbox.

## S-READ · SOW reads rely on RLS **alone** — no app-layer party predicate (two-layer gap). Severity **MEDIUM** (HIGH on any un-flipped connection)
`listForProject` is `WHERE project_id = $1` with **no org/party filter** (deliberate — `org_id = :me` would drop
counterparty-authored docs, which is most of them); `getById` is `WHERE id = $1`. Both rely **entirely** on the RLS
policies to scope the visible set. But `request-context.js` pins the GUCs **without** a `SET ROLE web_app_user`, and
dev's `DATABASE_URL` is the **schema owner**, which **bypasses RLS** (that file says so, lines 11–13; corroborated
by CC's smoke needing an explicit `SET ROLE web_app_user` to exercise the policies). **Where the connection role is
the owner** — confirm `ballpark-v2-dev`'s live role — these two endpoints return **every party's SOWs on a project,
and any SOW by id, to any authenticated active user of any org**: RLS only bites once the role flips to
`web_app_user`. Even once it flips, the finding stands as the missing second layer (below) — SOW's read isolation
must not hang on that single control.
- The audited sibling **inbox.service does not do this** — it carries an app-layer party predicate on its reads
  (`WHERE project_id=$1 AND $2 IN (m.from_org_id, m.to_org_id)`, `WHERE p.org_id=$1`, `WHERE pp.provider_org_id=$1`),
  so it is tenant-scoped at the app layer **and** by RLS. SOW's reads are the one surface whose isolation hangs on a
  **single** control (the role flip) — exactly what the two-layer enforcement standard (inbox precedent) prevents.
- **FIX — mirror the RLS policy at the app layer, don't `org_id`-filter (preserves counterparty visibility):**
  ```
  listForProject(projectId, viewerOrgId):
    WHERE project_id = $1 AND deleted_at IS NULL
      AND ( org_id = $2                                             -- author (mirrors _all)
         OR project_provider_id IN (SELECT id FROM project_providers
                                     WHERE deleted_at IS NULL
                                       AND $2 IN (org_id, provider_org_id)) )  -- counterparty (mirrors counterparty_read)
  getById: fold the same predicate into the WHERE, or after fetch assert viewer == author OR a party to
           project_provider_id (else 404).
  ```
  Restores two-layer isolation (so SOW isn't breached by a single misconfigured/forgotten role flip) and closes the
  live dev-QC exposure. **Not a DDL issue** — the 0040 policies are correct under `web_app_user` (31/31 + the service
  smoke 11/11 prove it); this is the missing app-layer belt.

## Nits
- `resolveParties(viewer, …)` — the `viewer` param is unused (`getById` passes `org_type` but it's ignored). Drop or use.
- Deferred (ride the structured-lines enhancement, re-audit then): parties/terms snapshot resolution, line
  materialization (must run **before** the first signature), engagement-scoped file access.
