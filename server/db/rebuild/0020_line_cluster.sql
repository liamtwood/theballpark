-- Rebuild migration 0020 — LINE CLUSTER, Stage 2 (Estimate).
-- The freeze + overlay line model (DATA-MODEL-REDESIGN §"Line cluster — LOCKED").
-- Supersedes UNIFY-01's single merged line-state table. Three tables:
--   project_items       — STATIC requirement: a faithful FROZEN clone of the item
--                         at add (immune to later catalogue edits; item_id is
--                         provenance only).
--   project_item_quotes — the complete supplier-modifiable form; a NULL-means-
--                         inherit sparse OVERLAY, one row per (requirement × provider).
--                         Current form = COALESCE(quote.field, project_items.field);
--                         the populated quote fields ARE the changelog.
--   project_item_matches— per-requirement AI provenance (1:1).
--
-- Conventions (match items 0015 / projects 0018): status/unit/currency are TEXT
-- governed by a reference codelist, validated app-side — NOT a DB CHECK. Money is
-- NUMERIC. Audit columns everywhere. RLS: AGENCY-OWNED (org_id = app_current_org()
-- + admin), read split from write so S3 can widen READ to engaged providers.
--
-- S2/S3 boundary (deliberate): project_item_quotes.project_provider_id references
-- project_providers, which is an S3 table. The overlay table is built here (per the
-- slice plan) but stays EMPTY until S3, so the column is a plain nullable uuid with
-- NO FK yet. S3 creates project_providers and ALTERs this column to add the FK.
-- Dragging the engagement spine forward now would be transitional rework.

-- ═══════════════════════════════════════════════════════════════════════════
-- project_items — the frozen requirement. A faithful clone of the item's full
-- definition at add; item_id is a provenance pointer (NULL = custom line).
-- kind/parent_id are dormant (buildup shelved); selection_type is dormant (v1
-- pick-one-of-similar) — both cheap to keep for forward-compat.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.project_items (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.orgs(id),              -- the OWNING agency (sacred — from session)
  project_id          uuid not null references public.projects(id) on delete cascade,
  project_category_id uuid references public.project_categories(id) on delete set null,
  item_id             uuid references public.items(id),                      -- provenance only; NULL = custom (is_custom derived)
  kind                text,                                                  -- dormant (buildup shelved)
  parent_id           uuid references public.project_items(id) on delete cascade, -- dormant recursive buildup
  name                text not null,
  description         text,
  attributes          jsonb not null default '{}'::jsonb,                    -- cloned describe-groups/variants bag
  selection_type      text,                                                  -- dormant (v1 pick-one-of-similar)
  quantity            numeric,
  unit                text,                                                  -- item_unit codelist
  currency            text,                                                  -- ISO-4217; travels with price (frozen)
  base_price          numeric,                                               -- catalogue reference, frozen
  variant             jsonb not null default '{}'::jsonb,
  installed           boolean not null default false,
  install_description text,
  install_cost        numeric,
  install_unit        text,
  image_url           text,
  status              text not null default 'active',                        -- line_status codelist
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id)
);
create index project_items_project_idx  on public.project_items (project_id) where deleted_at is null;
create index project_items_category_idx on public.project_items (project_category_id) where deleted_at is null;
create index project_items_parent_idx   on public.project_items (parent_id) where deleted_at is null and parent_id is not null;

alter table public.project_items enable row level security;
alter table public.project_items force row level security;
-- READ: owner agency + admin now. S3 widens to providers engaged via project_providers.
create policy project_items_read on public.project_items for select
  using (org_id = public.app_current_org() or public.app_is_admin());
create policy project_items_insert on public.project_items for insert
  with check (org_id = public.app_current_org() or public.app_is_admin());
create policy project_items_update on public.project_items for update
  using      (org_id = public.app_current_org() or public.app_is_admin())
  with check (org_id = public.app_current_org() or public.app_is_admin());
create policy project_items_delete on public.project_items for delete
  using (org_id = public.app_current_org() or public.app_is_admin());
grant select, insert, update, delete on public.project_items to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- project_item_quotes — the sparse OVERLAY. One row per (requirement × provider).
-- Mirrored definitional fields hold NULL unless the provider changes them (null =
-- inherit from project_items); the populated fields are the changelog. Quote-native
-- fields hold the agent's client-facing text + the price offer + status. Read the
-- current agreed form as COALESCE(quote.field, project_items.field).
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.project_item_quotes (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.orgs(id),              -- the OWNING agency (sacred)
  project_item_id     uuid not null references public.project_items(id) on delete cascade,
  -- S3 boundary: FK to project_providers added in S3 (table empty until then).
  project_provider_id uuid,
  -- mirrored definitional (NULL = inherit from project_items)
  name                text,
  description         text,
  attributes          jsonb,
  variant             jsonb,
  image_url           text,
  unit                text,
  quantity            numeric,
  currency            text,
  install_description text,
  install_cost        numeric,
  install_unit        text,
  -- quote-native
  quote_description   text,                                                  -- AGENT client-facing Quote-doc text (the one agent-owned field; FR-00229)
  price_before        numeric,                                               -- per-unit "was" cache
  price_current       numeric,                                               -- per-unit "now" (falls back to project_items.base_price)
  price_override      numeric,                                               -- flat line-total override
  status              text not null default 'pending',                       -- quote_status codelist
  decline_reason      text,
  details             text,                                                  -- human calc note ("2 × TV @ $50 for 3 days = $300")
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id),
  -- per-unit and flat-total are mutually exclusive (same rule as project_items.flat_total was)
  constraint project_item_quotes_price_xor check (price_current is null or price_override is null)
);
-- One quote per (requirement × provider). project_provider_id NULL = the agent's
-- own self-quote (agent-own lines, auto-accepted) — at most one such row per item.
create unique index project_item_quotes_req_provider_uidx
  on public.project_item_quotes (project_item_id, coalesce(project_provider_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where deleted_at is null;
create index project_item_quotes_item_idx on public.project_item_quotes (project_item_id) where deleted_at is null;

alter table public.project_item_quotes enable row level security;
alter table public.project_item_quotes force row level security;
-- Rides the requirement's ownership. S3 widens READ to the quoting provider.
create policy project_item_quotes_all on public.project_item_quotes for all
  using      (exists (select 1 from public.project_items pi where pi.id = project_item_id
                        and (pi.org_id = public.app_current_org() or public.app_is_admin())))
  with check (exists (select 1 from public.project_items pi where pi.id = project_item_id
                        and (pi.org_id = public.app_current_org() or public.app_is_admin())));
grant select, insert, update, delete on public.project_item_quotes to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- project_item_matches — per-requirement AI provenance (1:1 with project_items).
-- source = catalogue (manual add) / custom / ai. The AI create flow writes
-- confidence + reason + estimated price; a manual marketplace add writes source
-- only. Kept out of project_items (§"Dropped vs today": source/ai_* → matches).
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.project_item_matches (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.orgs(id),               -- the OWNING agency (sacred)
  project_item_id    uuid not null references public.project_items(id) on delete cascade,
  source             text not null default 'catalogue',                      -- match_source codelist (catalogue/custom/ai)
  ai_confidence      numeric,
  ai_match_reason    text,
  ai_estimated_price numeric,
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id)
);
create unique index project_item_matches_item_uidx on public.project_item_matches (project_item_id);

alter table public.project_item_matches enable row level security;
alter table public.project_item_matches force row level security;
create policy project_item_matches_all on public.project_item_matches for all
  using      (exists (select 1 from public.project_items pi where pi.id = project_item_id
                        and (pi.org_id = public.app_current_org() or public.app_is_admin())))
  with check (exists (select 1 from public.project_items pi where pi.id = project_item_id
                        and (pi.org_id = public.app_current_org() or public.app_is_admin())));
grant select, insert, update, delete on public.project_item_matches to web_app_user;
