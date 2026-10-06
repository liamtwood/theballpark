-- Rebuild migration 0008 — CATEGORIES (marketplace taxonomy). LOCKED spec
-- (docs/DATA-MODEL-REDESIGN "categories — LOCKED 2026-10-02").
--
-- The ONE product vocabulary everything classifies against: a recursive
-- single-parent tree (strict single owner → O(1) reparent; tags are the weak
-- m2m, elsewhere). Marketplace-only — feedback trackers have their OWN tree
-- (shared.feedback_categories), so NO `namespace` here (table = its namespace).
-- The face is an ICON (icon_name + icon_color), never an image. `level` is
-- DERIVED from the parent chain, not stored. org_id = Ballpark for the shared
-- taxonomy. status enum (new/active/retired) replaces v1's is_active+enabled.
--
-- RLS: the taxonomy is shared reference data — every authenticated role browses
-- it; curation is platform-admin (app_is_admin()).

create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  ref           text,                              -- stable human-readable slug (no raw PKs in URLs)
  name          text not null,
  description   text,
  parent_id     uuid references public.categories(id),
  sort_order    integer not null default 0,
  icon_name     text,                              -- Lucide glyph, lazy-resolved (<app-entity-icon>)
  icon_color    text,                              -- pastel token bg
  tagline       text,
  org_id        uuid not null references public.orgs(id),   -- = Ballpark root for the shared tree
  status        text not null default 'active' check (status in ('new','active','retired')),
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id),
  constraint categories_not_self_parent check (id <> parent_id)   -- direct cycle; deeper walks guarded in app
);
create unique index categories_ref_uidx on public.categories (ref) where ref is not null and deleted_at is null;
create index categories_parent_idx on public.categories (parent_id) where deleted_at is null;
create index categories_org_idx on public.categories (org_id) where deleted_at is null;

alter table public.categories enable row level security;
alter table public.categories force row level security;
create policy categories_read on public.categories for select using (true);  -- shared taxonomy: all read
create policy categories_write on public.categories for all
  using (public.app_is_admin()) with check (public.app_is_admin());          -- platform-admin curation

grant select, insert, update, delete on public.categories to web_app_user;
