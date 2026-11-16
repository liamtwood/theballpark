-- Rebuild migration 0040 — DOCUMENT CLUSTER: BIDIRECTIONAL SOW (supplier-authored).
-- Additive to 0039. Adds the supplier→agency SOW direction alongside the built
-- agency-authored path, WITHOUT changing the agency path's observable behavior.
-- pV2-SOW-01. Designer RLS sign-off: conditional-approved 2026-11-16 (see below).
--
-- APPLIED to ballpark-v2-dev 2026-11-16 (via Supabase MCP as owner). Designer cleared
--    the DDL (2026-11-16); Liam locked the product shape (2026-11-16): DROP the confirm
--    step, supplier authors all SOW content + sets the deposit, agency proposes via inbox
--    + signs-or-doesn't. Coverage gate tests/0040_document_cluster_supplier_direction.test.js
--    — 31/31 PASS as web_app_user (BOTH directions). Designer reconciles pV2-SOW-01 + the
--    audit against the settled shape; Phase-1 service re-audit still owed when that lands.
--
-- UNIFICATION NOTE: the designer's "derive the party, don't branch on p_role" + the
--    status rename necessarily reshape the SHARED sign code, so this unifies BOTH
--    directions onto one no-confirm machine. The agency direction's SEMANTICS are
--    preserved (counterparty signs first, author counter-signs last, freeze on first
--    signature) — only its separate `confirm` click is gone, the same simplification
--    Liam applied to the supplier direction. The 0039 coverage test's confirm/status
--    assertions are superseded by the 0040 gate.
--
-- MODEL (Liam locked the product shape; designer blessed the RLS shape):
--   A project has an agency (producer) and a client; the agency engages suppliers.
--   An SOW is a two-party contract on ONE engagement (project_providers row):
--     • agency-authored (0039, BUILT): org_id = agency; supplier is the counterparty.
--     • supplier-authored (THIS slice): org_id = supplier; agency is the counterparty.
--   org_id = THE AUTHOR. Direction = which side of the engagement equals d.org_id.
--   Signing rule (both directions): the COUNTERPARTY signs first (on the unsigned
--   draft), the AUTHOR counter-signs last → executed. Order is DERIVED, never stored.
--
-- DESIGNER CONDITIONS absorbed here (all four locked):
--   (b) ONE unified counterparty-read policy per table (replaces the built
--       *_provider_read trio). The engagement is PINNED (pp.id = d.project_provider_id)
--       — without the pin, a single A↔S engagement would leak every S-authored SOW to
--       A across ALL shared projects (cross-project read leak). S2 carried.
--   (c) Engagement guard both directions, pinning d.project_id = pp.project_id (new:
--       stops an author misfiling a doc onto another project via a real engagement).
--   (d) [Section 4] Sign path DERIVES the party from (app_current_org, d.org_id, pp) —
--       never branches auth on the client-supplied p_role (confused-deputy). role is
--       stored as PARTY-TYPE (agency|supplier), validated == the derived party.
--   B3 freeze generalized to "frozen once ANY signature exists" (matches the built
--       first-signature=freeze semantics) + the BINDING columns added to the frozen set
--       (a signed doc can't be re-pointed to another engagement, dragging its signatures).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · Unified COUNTERPARTY read (replaces the built *_provider_read trio).
--     Widens SELECT to "the other party on the doc's engagement", both directions.
--     The owner reads via the existing agency `_all` (org_id = app_current_org());
--     this policy is strictly the NON-owner counterparty, with the engagement pinned.
--     Agency-direction behavior is preserved (re-tested in the coverage gate).
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists project_documents_provider_read on public.project_documents;
create policy project_documents_counterparty_read on public.project_documents for select
  using (project_documents.deleted_at is null                                    -- S2
    and exists (select 1 from public.project_providers pp
                 where pp.id = project_documents.project_provider_id             -- PIN the engagement (no cross-project leak)
                   and pp.deleted_at is null
                   and public.app_current_org() in (pp.org_id, pp.provider_org_id)  -- reader is a party
                   and project_documents.org_id in (pp.org_id, pp.provider_org_id) -- owner is a party (integrity)
                   and public.app_current_org() <> project_documents.org_id));   -- reader = the COUNTERPARTY (owner uses _all)

drop policy if exists project_document_lines_provider_read on public.project_document_lines;
create policy project_document_lines_counterparty_read on public.project_document_lines for select
  using (exists (select 1 from public.project_documents d
                   join public.project_providers pp on pp.id = d.project_provider_id
                  where d.id = project_document_lines.document_id
                    and d.deleted_at is null                                     -- S2
                    and pp.deleted_at is null
                    and public.app_current_org() in (pp.org_id, pp.provider_org_id)
                    and d.org_id in (pp.org_id, pp.provider_org_id)
                    and public.app_current_org() <> d.org_id));

drop policy if exists project_document_signatures_provider_read on public.project_document_signatures;
create policy project_document_signatures_counterparty_read on public.project_document_signatures for select
  using (exists (select 1 from public.project_documents d
                   join public.project_providers pp on pp.id = d.project_provider_id
                  where d.id = project_document_signatures.document_id
                    and d.deleted_at is null                                     -- S2
                    and pp.deleted_at is null
                    and public.app_current_org() in (pp.org_id, pp.provider_org_id)
                    and d.org_id in (pp.org_id, pp.provider_org_id)
                    and public.app_current_org() <> d.org_id));

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Engagement guard — a doc's (project_id, project_provider_id) must be a real
--     engagement the OWNER is a party to, on that project. Both directions. Closes
--     "author misfiles a doc onto another project via its real engagement" — nothing
--     checked d.project_id = pp.project_id before, in EITHER direction.
--     SECURITY INVOKER: relies on project_providers RLS showing the owner its own
--     engagement (verify at apply — both parties must see the pp row). Early-return on
--     NULL project_provider_id (agency→client reserved), like the supersedes guard.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.project_documents_engagement_guard()
  returns trigger language plpgsql
  set search_path = public, pg_temp as $$
begin
  if new.project_provider_id is null then return new; end if;                    -- agency→client reserved
  if not exists (select 1 from public.project_providers pp
                  where pp.id = new.project_provider_id
                    and pp.deleted_at is null
                    and new.project_id = pp.project_id                           -- PIN the project (newly load-bearing)
                    and new.org_id in (pp.org_id, pp.provider_org_id)) then      -- owner is a party to it
    raise exception 'project_documents %: (project_id, project_provider_id) must be an engagement the owner % is a party to',
      coalesce(new.id::text, 'new'), new.org_id;
  end if;
  return new;
end $$;
drop trigger if exists project_documents_engagement_guard_biu on public.project_documents;
create trigger project_documents_engagement_guard_biu
  before insert or update on public.project_documents
  for each row execute function public.project_documents_engagement_guard();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · B3 freeze — generalized. Built rule was status in (supplier_signed, executed);
--     the true invariant is "frozen once the FIRST signature lands" (identical result
--     in the agency direction, and correct when the agency signs first). Plus the
--     BINDING columns: a signed doc cannot be re-pointed onto a different engagement
--     (that would carry its signatures into the other party's set and misrepresent
--     who's bound). `presentation` stays editable (pure display).
--     NB for Section 4: the sign definer MUST write snapshots/materialize lines BEFORE
--     inserting the first signature row — once a signature exists this trigger would
--     reject the snapshot write itself.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.project_documents_freeze()
  returns trigger language plpgsql
  set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.project_document_signatures s where s.document_id = old.id)
     and (
          new.content               is distinct from old.content
       or new.deposit_pct           is distinct from old.deposit_pct
       or new.parties_snapshot      is distinct from old.parties_snapshot
       or new.terms_snapshot        is distinct from old.terms_snapshot
       or new.name                  is distinct from old.name
       or new.description           is distinct from old.description
       -- binding columns (bidirectional re-point guard):
       or new.project_provider_id   is distinct from old.project_provider_id
       or new.project_id            is distinct from old.project_id
       or new.org_id                is distinct from old.org_id
       or new.supersedes_document_id is distinct from old.supersedes_document_id
     ) then
    raise exception 'project_documents %: frozen once signed — create a new SOW to amend', old.id;
  end if;
  return new;
end $$;
-- trigger project_documents_freeze_biu already created in 0039; CREATE OR REPLACE
-- above re-points it (no DROP/CREATE needed — it binds the function by name).

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · SIGN MACHINE — generalized, bidirectional, NO confirm step (Liam 2026-11-16:
--     "drop confirm; the agency signs or they don't, that's the process"). ONE path
--     serves both directions; the party is DERIVED from (app_current_org, d.org_id, pp),
--     never branched on the client p_role (confused-deputy). The COUNTERPARTY signs
--     first on the unsigned draft (= the freeze/issue point); the AUTHOR counter-signs
--     → executed. State machine: draft → counterparty_signed → executed (+ declined).
--
--   LINE materialization + parties/terms SNAPSHOT resolution stay the Phase-1 SERVICE's
--     job (as 0039 deferred: lines are definer-only writes; cross-org party resolution
--     needs the org_contact/supplier_directory helpers). This function advances status +
--     writes the signature; the SUBSTANCE it protects is `content` (the supplier-authored
--     jsonb), frozen by the generalized B3 trigger the instant the first signature lands,
--     so the security model holds without materialization here. When Phase-1 adds it, it
--     MUST run before the first sig insert (per §3). Designer re-audits that service code.
--
--   deposit_pct needs NO handling — it falls out of ownership: on a supplier-owned doc
--     only the supplier (org_id = app_current_org()) can write it; the agency is
--     read-only and proposes via the inbox. Agency-owned docs stay agency-set.
-- ═══════════════════════════════════════════════════════════════════════════

-- confirm is retired — there is no separate accept step; the signature is the accept.
drop function if exists public.document_confirm(uuid);

-- Neutral mid status (the agency can be the first signer, so 'supplier_signed' is wrong).
UPDATE public.reference_codelist_values
   SET code = 'counterparty_signed', label = 'Counterparty signed'
 WHERE code = 'supplier_signed'
   AND codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_status');

create or replace function public.document_sign(p_document_id uuid, p_role text, p_name text, p_title text)
  returns public.project_documents
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  d  public.project_documents;
  pp public.project_providers;
  v_me uuid := public.app_current_org();
  v_counterparty uuid;      -- the non-owner party on the engagement
  v_caller_role  text;      -- party-TYPE derived for v_me: 'agency' | 'supplier'
  v_is_author boolean;
begin
  select * into d from public.project_documents where id = p_document_id and deleted_at is null;
  if not found then raise exception 'document not found'; end if;
  if d.project_provider_id is null then
    raise exception 'agency->client signing is not supported in v1';     -- reserved direction
  end if;

  select * into pp from public.project_providers
   where id = d.project_provider_id and deleted_at is null;
  if not found then raise exception 'engagement not found'; end if;

  -- The two parties are pp.org_id (agency side) and pp.provider_org_id (supplier side);
  -- the author owns the doc (d.org_id = one of them), the counterparty is the other.
  if d.org_id not in (pp.org_id, pp.provider_org_id) then
    raise exception 'document owner is not a party to its engagement';
  end if;
  v_counterparty := case when d.org_id = pp.org_id then pp.provider_org_id else pp.org_id end;

  -- Derive the CALLER's party strictly from session + engagement — never from p_role.
  if v_me = d.org_id then
    v_is_author := true;
  elsif v_me = v_counterparty then
    v_is_author := false;
  else
    raise exception 'not a party to this document';
  end if;

  -- Party-TYPE label (stable across directions): the agency side of the engagement.
  v_caller_role := case when v_me = pp.org_id then 'agency' else 'supplier' end;
  if p_role is distinct from v_caller_role then
    raise exception 'role % does not match the signing party (%)', p_role, v_caller_role;  -- anti-spoof
  end if;

  -- Sequencing: counterparty signs first (draft -> counterparty_signed); author last
  -- (counterparty_signed -> executed). Order is DERIVED, never stored.
  if v_is_author then
    if d.status <> 'counterparty_signed' then
      raise exception 'author counter-signs only after the counterparty (status=%)', d.status;
    end if;
  else
    if d.status <> 'draft' then
      raise exception 'counterparty signs the unsigned draft (status=%)', d.status;
    end if;
  end if;

  -- Signature row + status flip are one atomic write. signer/role set server-side.
  insert into public.project_document_signatures
    (org_id, document_id, signer_org_id, signer_user_id, role, name, title, created_by)
  values (d.org_id, d.id, v_me, public.app_current_user_id(), v_caller_role, p_name, p_title,
          public.app_current_user_id());

  update public.project_documents
     set status = case when v_is_author then 'executed' else 'counterparty_signed' end,
         updated_at = now(), updated_by = public.app_current_user_id()
   where id = d.id returning * into d;
  return d;
end $$;
revoke all on function public.document_sign(uuid,text,text,text) from public;
grant execute on function public.document_sign(uuid,text,text,text) to web_app_user;
