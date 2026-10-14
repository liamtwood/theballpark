-- Rebuild migration 0018 — PROJECTS slice, Stage 1 (Create).
-- Ports the v2 project create flow onto the streamlined schema. Three tables:
--   projects (base 66 → ~24, LOCKED), project_settings (1:1, rate overrides),
--   project_categories (the per-(project×category) brief bucket — spine of the
--   AI create flow). Line cluster (project_items/quotes), messaging cluster and
--   project_documents come in S2/S3/S4. Spec = DATA-MODEL-REDESIGN §Projects.
--
-- Conventions (match items 0015): status/type/tier are TEXT governed by a
-- reference codelist (project_status / project_type / tier / category_status),
-- validated app-side — NOT a DB CHECK ("register, don't FK-enforce"). Fuzzy
-- planning fields (event_date, venue_name) are deliberately TEXT. Money NUMERIC.
-- RLS: a project is AGENCY-OWNED — org_id = app_current_org() (+ admin). Reads
-- are split from writes so S3 can widen the READ policy to engaged suppliers
-- (via project_providers) without touching write.

-- ═══════════════════════════════════════════════════════════════════════════
-- projects — the agency's project (identity + fuzzy planning facts + buyer
-- snapshot + cover + brief). Satellites hold settings / lines / docs / media.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  ref           text,                                    -- per-org ref stream (generated on create)
  name          text not null,
  description   text,
  status        text not null default 'draft',           -- project_status codelist (draft/active/completed/archived)
  org_id        uuid not null references public.orgs(id),-- the OWNING agency org (sacred — from session, never body)
  tier          text,                                    -- tier codelist
  currency      text,                                    -- ISO-4217; seeded from the org default
  po_ref        text,
  -- planning facts (fuzzy text = source of truth for intent; resolve later via project_links FR-00234)
  event_date    text,                                    -- TEXT, deliberately fuzzy ("2nd Tuesday", "TBD")
  event_type    text,                                    -- project_type codelist
  guest_count   integer,
  duration_days integer,
  venue_name    text,                                    -- TEXT, deliberately fuzzy
  venue_address_id uuid references public.addresses(id), -- resolved venue (addresses slice)
  -- buyer: client_name is the queried column; client jsonb = snapshot (company_number, logo_url, address, contact). No client_id.
  client_name   text,
  client        jsonb not null default '{}'::jsonb,
  -- cover: consolidates cover_image_url + focal x/y + unsplash attribution.
  cover         jsonb not null default '{}'::jsonb,
  icon_name     text,
  icon_color    text,
  -- brief: raw text + the AI parse archive (parsed_brief_json is archive only; the live per-category brief is project_categories.requirement_brief).
  raw_brief_text   text,
  parsed_brief_json jsonb,
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id)
);
create index projects_org_idx on public.projects (org_id) where deleted_at is null;
create index projects_status_idx on public.projects (status) where deleted_at is null;

alter table public.projects enable row level security;
alter table public.projects force row level security;
-- READ: owner agency + admin now. S3 widens this to suppliers engaged via project_providers.
create policy projects_read on public.projects for select
  using (org_id = public.app_current_org() or public.app_is_admin());
create policy projects_insert on public.projects for insert
  with check (org_id = public.app_current_org() or public.app_is_admin());
create policy projects_update on public.projects for update
  using      (org_id = public.app_current_org() or public.app_is_admin())
  with check (org_id = public.app_current_org() or public.app_is_admin());
create policy projects_delete on public.projects for delete
  using (org_id = public.app_current_org() or public.app_is_admin());
grant select, insert, update, delete on public.projects to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- project_settings — 1:1 satellite: project budget + rate overrides. NULL means
-- INHERIT the org default (effective = COALESCE(project_settings.x, orgs.default_x)).
-- Budget is AGENCY-PRIVATE — never shared with suppliers.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.project_settings (
  project_id      uuid primary key references public.projects(id) on delete cascade,
  project_budget  numeric,
  margin_pct      numeric,                                -- null = inherit orgs.default_margin_pct
  contingency_pct numeric,
  vat_pct         numeric,
  insurance_pct   numeric,
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id)
);

alter table public.project_settings enable row level security;
alter table public.project_settings force row level security;
-- Rides the project's visibility/ownership (budget is agency-private → no supplier read).
create policy project_settings_all on public.project_settings for all
  using      (exists (select 1 from public.projects p where p.id = project_id
                        and (p.org_id = public.app_current_org() or public.app_is_admin())))
  with check (exists (select 1 from public.projects p where p.id = project_id
                        and (p.org_id = public.app_current_org() or public.app_is_admin())));
grant select, insert, update, delete on public.project_settings to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- project_categories — the per-(project × category) bucket: the spine of the AI
-- create flow. The brief decomposes into per-category buckets; each holds the AI
-- match; project_items hang off project_category_id (S2). requirement_brief is
-- the SSOT per-category brief (projects.parsed_brief_json is the raw archive only).
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.project_categories (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  category_id       uuid references public.categories(id),  -- null = custom/uncategorised bucket
  requirement_brief text,                                   -- SSOT per-category brief (AI oneLiner at scaffold, then user-editable)
  requirement_detail text,
  match_result_json jsonb,                                  -- AI match provenance per category
  sort_order        integer not null default 0,
  status            text not null default 'draft',          -- category_status codelist (+ 'descoped' — reconcile in codelist pass)
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id)
);
-- Real ON CONFLICT upsert target (was SELECT-then-upsert in v1 for lack of this).
create unique index project_categories_proj_cat_uidx
  on public.project_categories (project_id, category_id) where deleted_at is null;
create index project_categories_project_idx on public.project_categories (project_id) where deleted_at is null;

alter table public.project_categories enable row level security;
alter table public.project_categories force row level security;
create policy project_categories_all on public.project_categories for all
  using      (exists (select 1 from public.projects p where p.id = project_id
                        and (p.org_id = public.app_current_org() or public.app_is_admin())))
  with check (exists (select 1 from public.projects p where p.id = project_id
                        and (p.org_id = public.app_current_org() or public.app_is_admin())));
grant select, insert, update, delete on public.project_categories to web_app_user;
