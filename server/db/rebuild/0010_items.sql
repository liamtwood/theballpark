-- Rebuild migration 0010 — ITEMS (supplier catalogue). Per docs/ITEMS.md +
-- the locked v0.2.0 item model (pV2-STORE-IMPORT-01) + DATA-MODEL-COLUMN-STANDARDS.
--
-- An item = a product/service owned by exactly ONE supplier (org_id). Universal
-- core + unit-driven fields (unit.meta.needs: serves/time_unit/size) + attributes
-- jsonb (5 describe-groups + Options + variants) + kind + lineage. Two independent
-- lifecycle axes: approval_status (moderation) + is_active (supplier visibility);
-- marketplace public = approved && active. Soft-delete everywhere.
--
-- DROPPED from the v2 shape (ITEMS.md "defer/drop"): min_price (removed),
-- external_url (unused), coverage_area (ambiguous → location_coverage), tags[]
-- (→ item_tag junction), pending_classification (transient).

create table public.items (
  id            uuid primary key default gen_random_uuid(),
  ref           text,                                   -- slug / future ballpark_id (object contract)
  org_id        uuid not null references public.orgs(id),          -- exclusive supplier owner
  category_id   uuid references public.categories(id),             -- top-level marketplace category
  subcategory_id uuid references public.categories(id),            -- child axis (auto-classified; supplier-editable)
  name          text not null,
  description   text,

  -- pricing & commerce
  currency      text,                                   -- NULL → supplier default_currency (codelist `currency`)
  base_price    numeric(12,2),
  install_cost  numeric(12,2),
  install_description text,
  install_unit  text,                                   -- per_item | per_order | percentage (drives line install formula)
  tier          text,                                   -- codelist `tier`

  -- practical / unit-driven (v0.2.0: the one extra field named by unit.meta.needs)
  unit          text,                                   -- codelist `item_unit` (each/per guest/platter/time/size)
  serves        integer check (serves is null or serves > 0),   -- platter pack size
  time_unit     text,                                   -- codelist (time items)
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  location_coverage text,                               -- free-text service area

  -- media
  images        jsonb not null default '[]'::jsonb,     -- [{url, sort_order, is_hero}]
  image_url     text,                                   -- synced from images[0] (legacy convenience)
  image_display text not null default 'cover' check (image_display in ('cover','contain')),

  -- describe / configure (5 groups + Options + variant-matrix all live in here)
  attributes    jsonb not null default '{}'::jsonb,
  kind          text check (kind is null or kind in ('variant','addon','component')),  -- NULL = standard
  parent_item_id  uuid references public.items(id),     -- variant/buildup parent (dormant tree)
  derived_from_id uuid references public.items(id),     -- lineage (duplicate source)

  -- lifecycle & visibility (two axes)
  approval_status text not null default 'draft',        -- codelist `item_approval_status` (draft/pending/approved/rejected)
  is_active     boolean not null default true,

  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id),

  constraint items_not_self_parent  check (id <> parent_item_id),
  constraint items_not_self_derived check (id <> derived_from_id)
);
create unique index items_ref_uidx on public.items (ref) where ref is not null and deleted_at is null;
create unique index items_org_name_uidx on public.items (org_id, lower(name)) where deleted_at is null;  -- per-supplier name dedupe
create index items_org_idx on public.items (org_id) where deleted_at is null;
create index items_category_idx on public.items (category_id) where deleted_at is null;
create index items_subcategory_idx on public.items (subcategory_id) where deleted_at is null;
create index items_live_idx on public.items (category_id) where deleted_at is null and is_active and approval_status = 'approved';
create index items_parent_idx on public.items (parent_item_id) where parent_item_id is not null and deleted_at is null;

-- ========== RLS — public reads approved+active; supplier own; admin all; writes own+admin
alter table public.items enable row level security;
alter table public.items force row level security;

create policy items_read on public.items for select using (
  (is_active and approval_status = 'approved' and deleted_at is null)   -- public marketplace
  or org_id = public.app_current_org()                                  -- supplier's own store (any state)
  or public.app_is_admin()                                              -- admin moderation
);
create policy items_write on public.items for all
  using (org_id = public.app_current_org() or public.app_is_admin())
  with check (org_id = public.app_current_org() or public.app_is_admin());

grant select, insert, update, delete on public.items to web_app_user;
