-- Rebuild migration 0006 — CODELISTS (reference data), new 3-table id-keyed model.
-- Per docs/CODELISTS.md (v0.2 redesign): the LIST, its VALUES, and a CONSUMERS
-- registry (which columns use a list). Lives in v2dev's OWN public schema
-- (per-instance) — NOT a cross-env `shared` schema. id-keyed so renaming a list
-- is one column update (values/consumers FK on id); value `code`s stay the stable
-- strings entity rows store. type = scope (system | ballpark | org): who may edit
-- + env-sharing policy. family = optional grouping tag ('status', 'unit', …).
--
-- RLS: reference data is NOT tenant-scoped — every authenticated role reads it
-- (dropdowns everywhere); writes are platform-admin only (app_is_admin()). Seeded
-- in 0007 from the canonical values.

-- ========== the LIST
create table public.reference_codelists (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                     -- mutable unique handle; system-list names are frozen like constants
  description   text,
  type          text not null check (type in ('system','ballpark','org')),  -- SCOPE (see doc)
  family        text,                              -- optional grouping tag: 'status','unit',…
  default_code  text,                              -- UI pre-select
  is_active     boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id)
);
create unique index reference_codelists_name_uidx on public.reference_codelists (name) where deleted_at is null;
create index reference_codelists_family_idx on public.reference_codelists (family) where family is not null;

-- ========== the VALUES of a list (code is load-bearing — stored on entity rows)
create table public.reference_codelist_values (
  id            uuid primary key default gen_random_uuid(),
  codelist_id   uuid not null references public.reference_codelists(id) on delete cascade,
  code          text not null,                     -- stable; projects.status='active' stores this
  label         text not null,
  symbol        text,                              -- e.g. currency symbol
  sort_order    integer not null default 0,
  meta          jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  retired_at    timestamptz,
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id)
);
create unique index reference_codelist_values_code_uidx
  on public.reference_codelist_values (codelist_id, code) where deleted_at is null;
create index reference_codelist_values_list_idx
  on public.reference_codelist_values (codelist_id) where deleted_at is null;

-- ========== CONSUMERS registry — which columns use a list (register != enforce)
create table public.reference_codelist_consumers (
  id            uuid primary key default gen_random_uuid(),
  codelist_id   uuid not null references public.reference_codelists(id) on delete cascade,
  consumer_table  text not null,
  consumer_column text not null,
  created_at timestamptz not null default now(), created_by uuid references public.users(id)
);
create unique index reference_codelist_consumers_uidx
  on public.reference_codelist_consumers (consumer_table, consumer_column);

-- ========== RLS — read by anyone (reference data), write platform-admin only
alter table public.reference_codelists enable row level security;  alter table public.reference_codelists force row level security;
alter table public.reference_codelist_values enable row level security; alter table public.reference_codelist_values force row level security;
alter table public.reference_codelist_consumers enable row level security; alter table public.reference_codelist_consumers force row level security;

create policy reference_codelists_read on public.reference_codelists for select using (true);
create policy reference_codelists_write on public.reference_codelists for all
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy reference_codelist_values_read on public.reference_codelist_values for select using (true);
create policy reference_codelist_values_write on public.reference_codelist_values for all
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy reference_codelist_consumers_read on public.reference_codelist_consumers for select using (true);
create policy reference_codelist_consumers_write on public.reference_codelist_consumers for all
  using (public.app_is_admin()) with check (public.app_is_admin());

grant select, insert, update, delete on
  public.reference_codelists, public.reference_codelist_values, public.reference_codelist_consumers
  to web_app_user;
