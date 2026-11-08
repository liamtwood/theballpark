-- 0034_org_invites.sql
-- pV2-INVITE-SUPPLIER-01 (Liam + designer sign-off 2026-11-08). An agency invites
-- a supplier who isn't on Ballpark from the estimate. The supplier is a REAL
-- pending org (orgs type='supplier' status='pending', allowed since 0002) with an
-- invited OWNER seat (user_orgs status='invited'); ONE pending org per supplier,
-- shared across agencies (dedupe by the seat's user email — server-side, owner
-- path, because own-org RLS hides another agency's pending org).
--
-- org_invites is the LINK: supplier org × inviting agency (× originating project).
-- It is:
--   • the agency's ONLY read path to a pending org it invited (orgs RLS is
--     own-org; supplier_directory is active-only) — via invited_supplier_contact();
--   • the addCustomItem gate (a line may route to a pending org only if the
--     caller's org has an invite row for it);
--   • the fan-out for acceptance: accept stamps accepted_at on EVERY row for the
--     supplier and notifies EVERY inviting agency.
-- No email column: the address lives on the invited seat's users stub (SSOT; a
-- copy here could drift and is extra agency-readable PII).
-- accepted_at NULL = outstanding. No decline/revoke flow yet — if one lands, add
-- declined_at / revoked_at rather than overloading the null.
--
-- Writes happen ONLY on the server's bootstrap/owner path (owner-pool, which in
-- v2dev is web_app_user + app.is_admin) inside the same transaction that creates
-- the pending org — so web_app_user gets no tenant write policy here.

create table if not exists public.org_invites (
  id                  uuid primary key default gen_random_uuid(),
  supplier_org_id     uuid not null references public.orgs(id),
  agency_org_id       uuid not null references public.orgs(id),
  project_id          uuid references public.projects(id) on delete set null, -- provenance: first project
  invited_by_user_id  uuid not null references public.users(id),
  accepted_at         timestamptz,
  created_at timestamptz not null default now(), created_by uuid not null references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id),
  constraint org_invites_not_self check (supplier_org_id <> agency_org_id)
);
-- One row per agency × supplier; a re-invite (another project) reuses it.
create unique index if not exists org_invites_pair_uidx
  on public.org_invites (supplier_org_id, agency_org_id) where deleted_at is null;
create index if not exists org_invites_agency_idx
  on public.org_invites (agency_org_id) where deleted_at is null;

alter table public.org_invites enable row level security;
alter table public.org_invites force row level security;

-- READ: the inviting agency's members see their rows; the supplier's members see
-- the rows for their org (who invited them). Ballpark admin read (app_is_admin)
-- matches every other table's read escape.
drop policy if exists org_invites_read on public.org_invites;
create policy org_invites_read on public.org_invites for select
  using (agency_org_id = public.app_current_org()
      or supplier_org_id = public.app_current_org()
      or public.app_is_admin());
-- WRITE: bootstrap/owner path only (the invite + accept transactions). No tenant
-- write — an agency can't mint or re-point an invite row through a request.
drop policy if exists org_invites_bootstrap_write on public.org_invites;
create policy org_invites_bootstrap_write on public.org_invites for all
  using (public.app_is_admin())
  with check (public.app_is_admin());

grant select, insert, update on public.org_invites to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- invited_supplier_contact — the agency's display of a supplier it INVITED
-- (pending or since joined). Mirrors org_contact (0023): narrow SECURITY DEFINER,
-- gate INSIDE the definer (an org_invites row from the caller's org), pinned
-- search_path, EXECUTE revoked from PUBLIC. Returns only what the agency typed
-- (name / website) + city + status — status drives the "Invited" pill.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.invited_supplier_contact(target uuid)
  returns table(id uuid, name text, city text, website text, status text)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select o.id, o.name, loc.city, o.website, o.status
      from public.orgs o
      left join lateral public.address_locality(o.primary_address_id) loc(city, country) on true
     where o.id = target
       and o.type = 'supplier'
       and o.deleted_at is null
       and exists (
         select 1 from public.org_invites oi
          where oi.supplier_org_id = target
            and oi.agency_org_id = public.app_current_org()
            and oi.deleted_at is null)
  $$;
revoke all on function public.invited_supplier_contact(uuid) from public;
grant execute on function public.invited_supplier_contact(uuid) to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- Invited pill — the DISPLAY of orgs.status='pending' on a supplier banner (one
-- stored state; the client derives 'invited' from supplierStatus, like
-- lineDisplayCode). Lives on the per-supplier pill list, not line_display_status
-- (it describes the supplier, not a line). Colour editable in Settings ▸ Codelists.
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
select (select id from public.reference_codelists where name = 'supplier_summary_status'),
       'invited', 'Invited', 0, true, jsonb_build_object('color', '#f8fafc')
where exists (select 1 from public.reference_codelists where name = 'supplier_summary_status')
  and not exists (
    select 1 from public.reference_codelist_values x
     where x.codelist_id = (select id from public.reference_codelists where name = 'supplier_summary_status')
       and x.code = 'invited');
