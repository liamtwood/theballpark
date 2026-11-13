-- Rebuild migration 0039 — DOCUMENT CLUSTER (SOW), Stage 4.
-- The SOW/Quote document, per DATA-MODEL-REDESIGN §"Document cluster — LOCKED".
-- Builds the per-supplier Statement of Work: a two-party (Agency ↔ Supplier, both
-- Ballpark orgs) contract GENERATED from the project, FROZEN at issue, SIGNED.
-- pV2-SOW-01. v1 = SOW rows only (type='sow'); the generic Documents release is
-- additive. v1 = no AI; the AI collection layer only pre-fills the manual sections.
--
-- APPLIED to ballpark-v2-dev 2026-11-13 (via Supabase MCP as owner). The per-line
--     acquisition-grade RLS audit (docs/audits/2026-11-13-sow-document-cluster-rls-audit.md,
--     the inbox bar) has cleared: B1/B2 definers, B3 freeze, B4 supersedes guard, S1/S2.
--     Coverage test tests/0039_document_cluster.test.js — 22/22 PASS as web_app_user.
--
-- THREE tables (per the plan):
--   project_documents            — the OBJECT (one row per SOW; multiple SOWs per
--                                  (project × supplier) over time; NO versioning —
--                                  "current" = latest non-declined row).
--   project_document_lines       — the §3 item-set, FROZEN onto the doc at issue.
--   project_document_signatures  — append-only two-party signature rows.
--
-- Conventions (match 0018/0020): status/type are TEXT governed by a reference
-- codelist (validated app-side, NOT a DB CHECK). Money is NUMERIC. Audit columns
-- everywhere. RLS: AGENCY-OWNED (org_id = app_current_org() + admin), READ widened
-- to the engaged SUPPLIER via project_providers (the 0023 inbox pattern). org_id on
-- every row is the AGENCY (sacred, from session) and is PINNED in the supplier
-- predicates (RLS pins org_id, not the app).
--
-- RECONCILIATIONS applied vs pV2-SOW-01 (flagged to Liam, pending spec reconcile):
--   • No version / is_current (Liam's call: multiple SOWs). KEEP supersedes_document_id
--     (nullable self-FK) — Liam's 3 use cases need it: (1) SOW never executed →
--     declined/abandoned; (2) CHANGE ORDER to a signed SOW → new SOW, supersedes SET;
--     (3) MORE WORK → new INDEPENDENT SOW, supersedes NULL. (2) vs (3) are
--     indistinguishable by created_at alone. "Superseded" is DERIVED (a SOW with a
--     successor); no status value, no version int, no is_current.
--   • "Current" is PLURAL — a supplier can hold several concurrent valid SOWs (case 3):
--     current = non-declined AND non-superseded (no successor).
--   • The approved content_snapshot is realised in the plan's shape: `content`
--     (editable narrative sections) + `parties_snapshot` + `terms_snapshot`
--     jsonb + the frozen project_document_lines rows. FREEZE ON ISSUE
--     (ready_to_sign) — you can't sign a moving doc; an edit drops back to draft
--     and clears signatures.
--   • deposit_pct kept as a STRUCTURED numeric column (agency-set; WS6/Stripe reads
--     it) in addition to rendering inside content.payment_schedule.
--   • KEEP project_items.sow_document_id (reversed — NOT redundant): case 3 splits a
--     supplier's agreed items across multiple live SOWs, so draft membership can't
--     derive from "all agreed items". The live link marks which SOW a live item is on
--     (re-points on a change order; only NEW items land on a "more work" SOW) and
--     freezes into project_document_lines at issue.
--   • Status machine: draft → ready_to_sign → supplier_signed → executed, + declined
--     (terminal). No 'superseded' (no versioning).

-- ═══════════════════════════════════════════════════════════════════════════
-- project_documents — the SOW instance (object base contract: ref/name/description).
-- Scope: supplier→agency (project_provider_id = the supplier engagement) now;
-- agency→client (project_provider_id NULL, project_category_id for all-items) is
-- model-reserved, post-launch. org_id is ALWAYS the agency.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.project_documents (
  id                   uuid primary key default gen_random_uuid(),
  ref                  text,                                                  -- human handle (object contract; null in practice)
  name                 text not null,
  description          text,
  org_id               uuid not null references public.orgs(id),              -- the AGENCY (sacred — from session)
  project_id           uuid not null references public.projects(id) on delete cascade,
  project_provider_id  uuid references public.project_providers(id),          -- the supplier engagement (NULL = agency→client, reserved)
  supplier_org_id      uuid references public.orgs(id),                       -- the supplier counterparty (NULL on agency→client)
  project_category_id  uuid references public.project_categories(id) on delete set null, -- reserved (agency→client scoping)
  supersedes_document_id uuid references public.project_documents(id),        -- SET = change order replacing a signed SOW (case 2); NULL = standalone incl. "more work" (case 3)
  type                 text not null default 'sow',                           -- document_type codelist (sow | quote …)
  status               text not null default 'draft',                         -- sow_status codelist (draft/ready_to_sign/supplier_signed/executed/declined)
  deposit_pct          numeric(5,2),                                          -- agency-set at Create; WS6 reads it (intent only, nothing charges)
  content              jsonb not null default '[]'::jsonb,                    -- ordered narrative sections [{name, content, order}] (the 5 editable fields live here)
  presentation         jsonb not null default '{}'::jsonb,                    -- Options panel: theme/header/footer + SOW body toggles
  parties_snapshot     jsonb,                                                 -- FROZEN at issue: agency + supplier (resolved server-side) + end-client
  terms_snapshot       jsonb,                                                 -- FROZEN at issue: Annex A ref + boilerplate merge values (deposit %, net days)
  issued_at            timestamptz,                                           -- when it went to ready_to_sign (freeze point)
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id)
);
create index if not exists project_documents_project_idx  on public.project_documents (project_id) where deleted_at is null;
create index if not exists project_documents_provider_idx on public.project_documents (project_provider_id) where deleted_at is null and project_provider_id is not null;
create index if not exists project_documents_supplier_idx on public.project_documents (supplier_org_id) where deleted_at is null and supplier_org_id is not null;
create index if not exists project_documents_supersedes_idx on public.project_documents (supersedes_document_id) where supersedes_document_id is not null;

alter table public.project_documents enable row level security;
alter table public.project_documents force row level security;
-- AGENCY: full access to its own documents (write stays agency-only).
create policy project_documents_all on public.project_documents for all
  using      (org_id = public.app_current_org() or public.app_is_admin())
  with check (org_id = public.app_current_org() or public.app_is_admin());
-- SUPPLIER (engaged provider): READ its own documents. org_id (agency) PINNED via
-- the engagement row so a forged org_id can't orphan the read. WRITE stays off this
-- policy — the supplier's confirm/sign is a SERVER-SIDE operation (see signatures).
create policy project_documents_provider_read on public.project_documents for select
  using (project_documents.deleted_at is null                                  -- S2: hide soft-deleted SOWs from the supplier (agency _all still sees them to restore)
    and exists (select 1 from public.project_providers pp
                  where pp.id = project_documents.project_provider_id
                    and pp.provider_org_id = public.app_current_org()
                    and pp.org_id = project_documents.org_id
                    and pp.deleted_at is null));
-- ⚠️ RLS-AUDIT: the supplier confirm (+ deposit acceptance) and the supplier sign
--    must advance status WITHOUT allowing arbitrary field writes. Recommended: a
--    gated SECURITY DEFINER (like org_contact) that validates engagement + role +
--    the current status, writes the signature row, and flips status — rather than a
--    broad supplier UPDATE policy. Field writes rejected once status >= supplier_signed.
--    Designer to settle policy-vs-definer in the per-line audit before this lands.
grant select, insert, update, delete on public.project_documents to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- project_document_lines — the §3 item-set, FROZEN onto the doc at issue (a draft
-- re-derives live from the supplier's agreed quotes; these rows populate at
-- ready_to_sign). render_included/amendment_rounds are the per-line render terms
-- (FR-00227), frozen from the catalogue item. Rides the parent doc's ownership.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.project_document_lines (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.orgs(id),                -- the AGENCY (sacred), mirrors the parent doc
  document_id        uuid not null references public.project_documents(id) on delete cascade,
  project_item_id    uuid references public.project_items(id) on delete set null, -- provenance (set null if the live line is later removed)
  name               text not null,
  spec               text,
  quantity           numeric,
  unit               text,                                                    -- item_unit codelist (frozen)
  unit_price         numeric,
  line_total         numeric,
  currency           text,                                                    -- ISO-4217 (frozen)
  source             text,                                                    -- own_design | price_matched
  price_notes        text,                                                    -- AI calc note, frozen
  approval_date      timestamptz,
  concept_ref        text,
  branding_delta     text,
  render_included    boolean not null default false,
  amendment_rounds   int,
  quote_description  text,                                                    -- the agent's client-facing line text (frozen)
  created_at timestamptz not null default now(), created_by uuid references public.users(id)
);
create index if not exists project_document_lines_doc_idx on public.project_document_lines (document_id);

alter table public.project_document_lines enable row level security;
alter table public.project_document_lines force row level security;
-- Rides the parent document's visibility (agency full; engaged supplier read).
create policy project_document_lines_all on public.project_document_lines for all
  using      (exists (select 1 from public.project_documents d where d.id = document_id
                        and (d.org_id = public.app_current_org() or public.app_is_admin())))
  with check (exists (select 1 from public.project_documents d where d.id = document_id
                        and (d.org_id = public.app_current_org() or public.app_is_admin())));
create policy project_document_lines_provider_read on public.project_document_lines for select
  using (exists (select 1 from public.project_documents d
                   join public.project_providers pp on pp.id = d.project_provider_id
                  where d.id = project_document_lines.document_id
                    and d.deleted_at is null                                    -- S2
                    and pp.provider_org_id = public.app_current_org()
                    and pp.org_id = d.org_id
                    and pp.deleted_at is null));
-- Lines are FROZEN at issue by document_confirm (a definer, runs as owner). Append-only
-- at the privilege layer: no direct write from web_app_user (mirrors S1 on signatures).
grant select on public.project_document_lines to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- project_document_signatures — append-only, exactly the two parties. A signature
-- row is written server-side (signed_at/by/org from the session, never the client).
-- role 'client' is the external end-client (org/user null; captured by name/title) —
-- reserved for the agency→client scope, not written in v1.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.project_document_signatures (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id),                   -- the AGENCY (sacred), mirrors the parent doc
  document_id     uuid not null references public.project_documents(id) on delete cascade,
  signer_org_id   uuid references public.orgs(id),                            -- the signing party's org (null = external client)
  signer_user_id  uuid references public.users(id),
  role            text not null,                                              -- signatory_role codelist (agency | supplier | client)
  name            text not null,                                              -- signatory name (frozen)
  title           text,                                                       -- signatory title (frozen)
  signed_at       timestamptz not null default now(),
  created_at timestamptz not null default now(), created_by uuid references public.users(id)
);
create index if not exists project_document_signatures_doc_idx on public.project_document_signatures (document_id);
-- One signature per (document × role) — guards a double-sign.
create unique index if not exists project_document_signatures_doc_role_uidx
  on public.project_document_signatures (document_id, role);

alter table public.project_document_signatures enable row level security;
alter table public.project_document_signatures force row level security;
-- Agency: full read of its docs' signatures. Engaged supplier: read.
create policy project_document_signatures_all on public.project_document_signatures for all
  using      (exists (select 1 from public.project_documents d where d.id = document_id
                        and (d.org_id = public.app_current_org() or public.app_is_admin())))
  with check (exists (select 1 from public.project_documents d where d.id = document_id
                        and (d.org_id = public.app_current_org() or public.app_is_admin())));
create policy project_document_signatures_provider_read on public.project_document_signatures for select
  using (exists (select 1 from public.project_documents d
                   join public.project_providers pp on pp.id = d.project_provider_id
                  where d.id = project_document_signatures.document_id
                    and d.deleted_at is null                                    -- S2
                    and pp.provider_org_id = public.app_current_org()
                    and pp.org_id = d.org_id
                    and pp.deleted_at is null));
-- B2/S1: signatures are written ONLY by document_sign (a definer, runs as owner). NO
-- direct write from web_app_user — neither party gets an INSERT/UPDATE/DELETE path, so
-- a signature can't be forged, written out of sequence, or deleted. READ only here.
grant select on public.project_document_signatures to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- Catalogue source for the render terms (FR-00227) — the per-line render defaults
-- a SOW line freezes from. Additive, nullable/defaulted (safe on existing rows).
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.items add column if not exists render_included boolean not null default false;
alter table public.items add column if not exists render_amendment_rounds int;

-- ═══════════════════════════════════════════════════════════════════════════
-- Live SOW membership on project_items — which current SOW a live requirement is on
-- (NULL = not yet on a SOW). Re-points on a change order (case 2) or when a "more
-- work" SOW (case 3) claims a new item; freezes into project_document_lines at issue.
-- Additive nullable FK on the locked project_items (0020); FK target created above.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.project_items add column if not exists sow_document_id uuid references public.project_documents(id);
create index project_items_sow_doc_idx on public.project_items (sow_document_id) where deleted_at is null and sow_document_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- Codelists (type='ballpark', per-env editable). document_type = the discriminator;
-- sow_status = the pill (family 'Pills', meta.color per the status-pill model);
-- signatory_role = the signature role. Idempotent (NOT EXISTS guards).
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.reference_codelists (name, description, type, family, default_code, is_active)
SELECT v.name, v.description, 'ballpark', v.family, v.default_code, true
FROM (VALUES
  ('document_type',  'Project document type (SOW / Quote)',        NULL,    'sow'),
  ('sow_status',     'SOW lifecycle status (pill)',                'Pills', 'draft'),
  ('signatory_role', 'SOW signatory role (agency/supplier/client)', NULL,   'supplier')
) AS v(name, description, family, default_code)
WHERE NOT EXISTS (SELECT 1 FROM public.reference_codelists r WHERE r.name = v.name);

INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'sow_status'),
       v.code, v.label, v.sort_order, true, jsonb_build_object('color', v.color)
FROM (VALUES
  ('draft',          'Draft',           1, '#f8fafc'),
  ('ready_to_sign',  'Ready to sign',   2, '#f8fafc'),
  ('supplier_signed','Supplier signed', 3, '#c54382'),
  ('executed',       'Executed',        4, '--color-state-emerald'),
  ('declined',       'Declined',        5, '--color-danger')
) AS v(code, label, sort_order, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_status')
    AND x.code = v.code
);

INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'document_type'),
       v.code, v.label, v.sort_order, true, '{}'::jsonb
FROM (VALUES ('sow', 'Statement of Work', 1), ('quote', 'Quote', 2)) AS v(code, label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'document_type')
    AND x.code = v.code
);

INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'signatory_role'),
       v.code, v.label, v.sort_order, true, '{}'::jsonb
FROM (VALUES ('agency', 'Agency', 1), ('supplier', 'Supplier', 2), ('client', 'End client', 3)) AS v(code, label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'signatory_role')
    AND x.code = v.code
);

-- ═══════════════════════════════════════════════════════════════════════════
-- B1/B2 · the gated SECURITY DEFINER write path (RLS audit 2026-11-13). The
-- supplier has NO direct UPDATE/INSERT on project_documents or _signatures; the
-- status machine lives in these functions. org_contact shape: engagement + role +
-- status precondition checked INSIDE, search_path pinned, revoke-public + grant
-- web_app_user. signer_org_id/signed_at/created_by set server-side from the session.
--
-- document_confirm — the engaged supplier's pre-sign confirm (draft → ready_to_sign,
-- the issue/freeze point). Snapshot RESOLUTION (content/parties/terms via org_contact
-- + supplier_directory, line freeze into project_document_lines) is the AGENCY's
-- server-side issue path while the doc is still draft; re-audited with the service
-- (Phase 1). This function only validates + advances status.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.document_confirm(p_document_id uuid)
  returns public.project_documents
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare d public.project_documents;
begin
  select * into d from public.project_documents where id = p_document_id and deleted_at is null;
  if not found then raise exception 'document not found'; end if;
  if not exists (select 1 from public.project_providers pp
                  where pp.id = d.project_provider_id
                    and pp.provider_org_id = public.app_current_org()
                    and pp.org_id = d.org_id and pp.deleted_at is null)
    then raise exception 'not the engaged supplier'; end if;
  if d.status <> 'draft' then raise exception 'confirm only from draft (status=%)', d.status; end if;
  update public.project_documents
     set status = 'ready_to_sign', issued_at = now(),
         updated_at = now(), updated_by = public.app_current_user_id()
   where id = d.id returning * into d;
  return d;
end $$;
revoke all on function public.document_confirm(uuid) from public;
grant execute on function public.document_confirm(uuid) to web_app_user;

-- document_sign — both parties funnel through one path so sequencing lives in one
-- place: supplier signs only from ready_to_sign (→ supplier_signed); agency signs only
-- after the supplier (→ executed). The signature row + status flip are one atomic write.
create or replace function public.document_sign(p_document_id uuid, p_role text, p_name text, p_title text)
  returns public.project_documents
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare d public.project_documents; v_signer_org uuid;
begin
  select * into d from public.project_documents where id = p_document_id and deleted_at is null;
  if not found then raise exception 'document not found'; end if;

  if p_role = 'agency' then
    if d.org_id <> public.app_current_org() then raise exception 'not the agency'; end if;
    if d.status <> 'supplier_signed'        then raise exception 'agency signs only after supplier (status=%)', d.status; end if;
    v_signer_org := d.org_id;
  elsif p_role = 'supplier' then
    if not exists (select 1 from public.project_providers pp
                    where pp.id = d.project_provider_id
                      and pp.provider_org_id = public.app_current_org()
                      and pp.org_id = d.org_id and pp.deleted_at is null)
      then raise exception 'not the engaged supplier'; end if;
    if d.status <> 'ready_to_sign' then raise exception 'not ready to sign (status=%)', d.status; end if;
    v_signer_org := public.app_current_org();
  else raise exception 'bad role %', p_role;
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

-- ═══════════════════════════════════════════════════════════════════════════
-- B3 · post-sign FREEZE (DB-enforced). RLS can't say "no field writes once signed",
-- and the agency _all policy allows UPDATE regardless of status. This BEFORE UPDATE
-- trigger rejects a change to any contract-substance column once the row is
-- supplier_signed/executed — for BOTH parties, including the definers' owner writes
-- (they only touch status/updated_*, which pass). To amend a signed SOW you create a
-- NEW SOW (supersedes). (The frozen LINE SET is covered separately: project_document_lines
-- is append-only at the grant layer.) presentation left editable (pure display) — flagged
-- for the re-audit.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.project_documents_freeze()
  returns trigger language plpgsql as $$
begin
  if old.status in ('supplier_signed','executed') and (
       new.content          is distinct from old.content
    or new.deposit_pct      is distinct from old.deposit_pct
    or new.parties_snapshot is distinct from old.parties_snapshot
    or new.terms_snapshot   is distinct from old.terms_snapshot
    or new.name             is distinct from old.name
    or new.description       is distinct from old.description
  ) then
    raise exception 'project_documents %: frozen once signed (status=%) — create a new SOW to amend', old.id, old.status;
  end if;
  return new;
end $$;
drop trigger if exists project_documents_freeze_biu on public.project_documents;
create trigger project_documents_freeze_biu
  before update on public.project_documents
  for each row execute function public.project_documents_freeze();

-- ═══════════════════════════════════════════════════════════════════════════
-- B4 · supersedes_document_id must point WITHIN the same tenant + engagement chain
-- (RLS audit re-pass 2026-11-13). The self-FK enforces existence, not org — and since
-- "superseded" DERIVES from "has a successor" and drives the "current" set, org B
-- setting its own doc's supersedes → org A's doc would make A's live SOW compute as
-- superseded and vanish from A's current list (cross-tenant integrity hit; not a read
-- leak). A CHECK can't subquery and an FK can't test org, so enforce in a trigger. The
-- "superseded" DERIVATION must match org too (successor.org_id = doc.org_id, same
-- project+provider) — done in the service/view (Phase 1). Runs SECURITY INVOKER: a
-- cross-tenant target is invisible under RLS → the SELECT returns NOT FOUND → rejected.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.project_documents_supersedes_guard()
  returns trigger language plpgsql
  set search_path = public, pg_temp as $$
declare p public.project_documents;
begin
  if new.supersedes_document_id is null then return new; end if;
  if new.supersedes_document_id = new.id then raise exception 'a SOW cannot supersede itself'; end if;
  select * into p from public.project_documents where id = new.supersedes_document_id;
  if not found then raise exception 'supersedes target % not found (or not visible to this org)', new.supersedes_document_id; end if;
  if p.org_id is distinct from new.org_id
     or p.project_id is distinct from new.project_id
     or p.project_provider_id is distinct from new.project_provider_id then
    raise exception 'supersedes_document_id must reference the same org + (project, provider) chain';
  end if;
  return new;
end $$;
drop trigger if exists project_documents_supersedes_guard_biu on public.project_documents;
create trigger project_documents_supersedes_guard_biu
  before insert or update on public.project_documents
  for each row execute function public.project_documents_supersedes_guard();
