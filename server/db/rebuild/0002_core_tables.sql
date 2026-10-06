-- Rebuild migration 0002 — CORE TABLES + BOOTSTRAP (org slice, step 2 + step 0 part 2)
-- orgs (33-col object) · users · addresses, with the orgs<->addresses FK cycle
-- resolved by deferred ALTER, and the Ballpark #1 + system-user bootstrap.
-- Conventions (from DATA-MODEL-COLUMN-STANDARDS): object header, audit trio,
-- deleted_at soft-delete, numeric >= 0, partial-unique handles, per-table RLS.
-- Bootstrap UUIDs: system user = all-zeros, Ballpark org #1 = …0001.

-- ========== orgs (object; IS the tenant → no org_id; parent_id -> orgs, Ballpark root)
create table public.orgs (
  id            uuid primary key default gen_random_uuid(),
  ref           text,
  name          text not null,
  description   text,
  status        text not null default 'active' check (status in ('pending','active','suspended','retired')),
  type          text not null check (type in ('agency','supplier','ballpark')),
  parent_id     uuid references public.orgs(id),
  primary_address_id uuid,                         -- FK added after addresses (cycle)
  email         text,
  phone         text,
  website       text,
  company_number text,
  vat_number     text,
  vat_registered boolean not null default false,
  logo_url        text,
  cover_image_url text,
  image_display   text default 'cover' check (image_display in ('cover','contain')),
  images          jsonb not null default '[]'::jsonb,
  terms_pdf_url   text,
  default_currency        text,
  default_margin_pct      numeric check (default_margin_pct >= 0),
  default_contingency_pct numeric check (default_contingency_pct >= 0),
  default_vat_pct         numeric check (default_vat_pct >= 0),
  default_insurance_pct   numeric check (default_insurance_pct >= 0),
  auto_publish_items      boolean not null default true,
  ref_prefix    text,
  ref_counter   integer not null default 0 check (ref_counter >= 0),
  created_at timestamptz not null default now(), created_by uuid,   -- nullable through bootstrap
  updated_at timestamptz not null default now(), updated_by uuid,
  deleted_at timestamptz, deleted_by uuid
);
create unique index orgs_name_uidx on public.orgs (lower(name)) where deleted_at is null;
create unique index orgs_ref_uidx  on public.orgs (ref) where ref is not null and deleted_at is null;
create index orgs_parent_idx on public.orgs (parent_id) where deleted_at is null;

-- ========== users (identity + profile, OIDC-aligned; org_id = Ballpark #1 instance ownership)
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  ref           text,
  sub           text,                               -- OIDC subject (was google_sub)
  email         text not null,
  email_verified boolean not null default false,
  name          text,
  display_name  text,
  avatar_url    text,
  locale        text,
  timezone      text,
  description   text,
  status        text not null default 'active' check (status in ('active','suspended','retired')),
  org_id         uuid,                              -- = Ballpark #1; FK added after bootstrap
  default_org_id uuid,                              -- active-org preference; FK added later
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  deleted_at timestamptz, deleted_by uuid
);
create unique index users_email_uidx on public.users (lower(email)) where deleted_at is null;
create unique index users_sub_uidx   on public.users (sub) where sub is not null and deleted_at is null;

-- ========== addresses (object; null ref — addressed via parent; org-owned)
create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  ref         text,
  name        text,                                 -- optional label
  org_id      uuid not null,                        -- FK added after bootstrap
  type        text not null default 'registered' check (type in ('registered','site','billing')),
  line1       text,
  line2       text,
  city        text,
  region      text,
  postcode    text,
  country     text,
  latitude    numeric,
  longitude   numeric,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  deleted_at timestamptz, deleted_by uuid
);
create index addresses_org_idx on public.addresses (org_id) where deleted_at is null;

-- ========== resolve the orgs <-> addresses FK cycle
alter table public.orgs
  add constraint orgs_primary_address_fk foreign key (primary_address_id) references public.addresses(id);

-- ========== BOOTSTRAP: Ballpark org #1 + system user (audit FKs still nullable)
insert into public.orgs (id, name, type, status)
  values ('00000000-0000-0000-0000-000000000001', 'Ballpark', 'ballpark', 'active');
insert into public.users (id, email, name, status, org_id)
  values ('00000000-0000-0000-0000-000000000000', 'system@ballpark.internal', 'System', 'active',
          '00000000-0000-0000-0000-000000000001');
-- stamp authorship now the system user exists
update public.orgs  set created_by = '00000000-0000-0000-0000-000000000000',
                        updated_by = '00000000-0000-0000-0000-000000000000' where created_by is null;
update public.users set created_by = '00000000-0000-0000-0000-000000000000',
                        updated_by = '00000000-0000-0000-0000-000000000000' where created_by is null;

-- ========== cross/audit FKs (added after bootstrap so the seed could land)
alter table public.orgs
  add constraint orgs_created_by_fk foreign key (created_by) references public.users(id),
  add constraint orgs_updated_by_fk foreign key (updated_by) references public.users(id),
  add constraint orgs_deleted_by_fk foreign key (deleted_by) references public.users(id);
alter table public.users
  add constraint users_org_fk         foreign key (org_id)        references public.orgs(id),
  add constraint users_default_org_fk foreign key (default_org_id) references public.orgs(id),
  add constraint users_created_by_fk  foreign key (created_by)    references public.users(id),
  add constraint users_updated_by_fk  foreign key (updated_by)    references public.users(id),
  add constraint users_deleted_by_fk  foreign key (deleted_by)    references public.users(id);
alter table public.addresses
  add constraint addresses_org_fk        foreign key (org_id)     references public.orgs(id),
  add constraint addresses_created_by_fk foreign key (created_by) references public.users(id),
  add constraint addresses_updated_by_fk foreign key (updated_by) references public.users(id),
  add constraint addresses_deleted_by_fk foreign key (deleted_by) references public.users(id);

-- ========== re-enforce audit NOT NULL (bootstrap is stamped)
alter table public.orgs  alter column created_by set not null;
alter table public.users alter column created_by set not null, alter column org_id set not null;

-- ========== RLS (enabled after seed; policy ships with the table)
alter table public.orgs enable row level security;  alter table public.orgs  force row level security;
alter table public.users enable row level security; alter table public.users force row level security;
alter table public.addresses enable row level security; alter table public.addresses force row level security;

create policy orgs_self on public.orgs for all
  using (id = public.app_current_org() or public.app_is_admin())
  with check (id = public.app_current_org() or public.app_is_admin());
-- counterparty read (supplier sees agency via a shared project) ships with the project slice.

-- NOTE: the `org_id = app_current_org()` clause below is DEAD in v2dev (org_id is
-- the Ballpark instance, not the functional org) and is SUPERSEDED by 0005, which
-- recreates this policy with membership-overlap visibility (app_can_see_user).
create policy users_self on public.users for all
  using (id = public.app_current_user_id() or org_id = public.app_current_org() or public.app_is_admin())
  with check (id = public.app_current_user_id() or public.app_is_admin());

create policy addresses_all on public.addresses for all
  using (org_id = public.app_current_org() or public.app_is_admin())
  with check (org_id = public.app_current_org() or public.app_is_admin());

-- ========== grants to the runtime role
grant select, insert, update, delete on public.orgs, public.users, public.addresses to web_app_user;
