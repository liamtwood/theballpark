-- =============================================================
-- Ballpark — Org-Type Config Migration (p0021 / Piece 2)
-- Description: Server-side home for the page-settings config that today
--   lives only in each browser's localStorage. One row per org_type holds
--   the full PageConfig stack (hero, sections, launcher actions, catalogue
--   view, theme/labels) as JSONB. Consumed by every user of that org_type;
--   authored by the platform admin only.
-- Run in: Supabase SQL editor (dev first, then preview, then prod)
-- DO NOT run automatically — apply by hand per the deploy checklist.
--
-- Scope (v1): org_type tier only. Deferred to backlog (p005x):
--   • user-tier overrides   • brand inheritance / platform.default resolver
--   • brand cloning         • audit history beyond updated_at/updated_by
-- =============================================================

-- -------------------------------------------------------------
-- 1. CONFIG TABLE
-- One row per org_type. org_type mirrors orgs.type exactly
-- ('agency' | 'supplier' | 'admin') so it stays the stable identity
-- dimension — the drawer's Role tab maps to org_type at the boundary
-- (agent → agency, admin → admin, supplier → supplier).
-- -------------------------------------------------------------

create table if not exists org_type_config (
  org_type    text primary key
                check (org_type in ('agency', 'supplier', 'admin')),
  -- Full PageConfig stack (PlatformConfig + pageSettings incl. catalogue
  -- view) merged from the current per-(platform,role) localStorage profiles.
  payload     jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references users(id)
);

comment on table org_type_config is
  'Per-org_type page-settings config (PageConfig stack as JSONB). One row '
  'per org_type; consumed by all users of that type, authored by the '
  'platform admin. localStorage is now only a fast-paint cache.';

-- -------------------------------------------------------------
-- 2. SEED THE THREE ROWS
-- Empty payloads so GET always resolves a row; the client falls back to
-- DEFAULT_CONFIG for any missing key. The real seed (Liam's current
-- role-scoped localStorage state) is written by the one-off migration
-- script once Piece 1's clean shape is confirmed.
-- -------------------------------------------------------------

insert into org_type_config (org_type, payload) values
  ('agency',   '{}'::jsonb),
  ('supplier', '{}'::jsonb),
  ('admin',    '{}'::jsonb)
on conflict (org_type) do nothing;

-- -------------------------------------------------------------
-- 3. updated_at trigger
-- -------------------------------------------------------------

create or replace function set_org_type_config_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists trg_org_type_config_updated_at on org_type_config;
create trigger trg_org_type_config_updated_at
  before update on org_type_config
  for each row execute function set_org_type_config_updated_at();

-- -------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- Defense-in-depth: the Express API is the primary auth gate (the PUT route
-- is wrapped in the admin middleware and derives identity from the JWT).
-- These policies protect against direct Supabase access.
-- -------------------------------------------------------------

alter table org_type_config enable row level security;

-- Readable by all authenticated users (everyone consumes their org_type row).
create policy "org_type_config_read_all"
  on org_type_config for select
  to authenticated
  using (true);

-- Writable by PLATFORM admins only — a user whose org is the platform org
-- (orgs.type = 'admin'). Agency/supplier admins cannot author config.
create policy "org_type_config_write_platform_admin"
  on org_type_config for all
  to authenticated
  using (
    exists (
      select 1
      from   users u
      join   orgs  o on o.id = u.org_id
      where  u.id   = auth.uid()
      and    o.type = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from   users u
      join   orgs  o on o.id = u.org_id
      where  u.id   = auth.uid()
      and    o.type = 'admin'
    )
  );
