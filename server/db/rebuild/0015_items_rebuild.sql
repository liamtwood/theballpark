-- Rebuild migration 0015 — ITEMS rebuilt fresh + tags + item_tags.
-- SUPERSEDES 0010 (items) and 0011 (item_unit groom stays valid). 0010's items
-- drifted from the locked model during a compaction gap; it held only throwaway
-- rows and nothing FKs to it, so we DROP + rebuild from the locked column spec
-- (DATA-MODEL-REDESIGN "items", groups 1-7, 2026-10-09) rather than migrate.
--
-- Item domain = items + tags + item_tags (+ catalogue_extract_job from 0014). No
-- other tables: variants / attribute-groups / volume tiers / media / buildup all
-- live as attributes/images jsonb or dormant columns on items.
--
-- Status codelists are SYSTEM (code owns the value set via these CHECKs + a code
-- constant + a contract test; admin owns only label/colour on the codelist rows).

-- ─────────────────────────────────────────────────────────────────────────────
-- item_status SYSTEM codelist (new/active/retired) — the one list 0007 lacked.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare lid uuid;
begin
  select id into lid from public.reference_codelists where name = 'item_status' and deleted_at is null;
  if lid is null then
    insert into public.reference_codelists (name, description, type, family, default_code, is_active)
    values ('item_status', 'Item visibility lifecycle', 'system', 'status', 'new', true)
    returning id into lid;
  end if;
  delete from public.reference_codelist_values where codelist_id = lid;
  insert into public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta) values
    (lid, 'new',     'New',     0, true, '{"color":"slate"}'::jsonb),
    (lid, 'active',  'Active',  1, true, '{"color":"green"}'::jsonb),
    (lid, 'retired', 'Retired', 2, true, '{"color":"gray"}'::jsonb);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- tags — faceted vocabulary (Class A object, Ballpark-owned global reference).
-- dimension = the facet ('mood', etc.); label = the value. Minimal now; flesh out later.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tags (
  id          uuid primary key default gen_random_uuid(),
  ref         text,
  name        text not null,                                  -- the tag label (e.g. "Rustic")
  description text,
  status      text not null default 'active',
  dimension   text,                                           -- facet: 'mood' | null (free tag) | future facets
  category_id uuid references public.categories(id),          -- null = global (e.g. moods); else category-scoped
  org_id      uuid not null references public.orgs(id)
                default '00000000-0000-0000-0000-000000000001',-- Ballpark #1 (global reference is Ballpark-owned)
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id)
);
create unique index tags_dim_name_uidx
  on public.tags (coalesce(category_id::text, ''), dimension, lower(name)) where deleted_at is null;
create index tags_dimension_idx on public.tags (dimension) where deleted_at is null;

alter table public.tags enable row level security;
alter table public.tags force row level security;
create policy tags_read on public.tags for select using (true);       -- global faceted vocabulary
create policy tags_write on public.tags for all
  using (public.app_is_admin()) with check (public.app_is_admin());   -- Ballpark curates the vocabulary
grant select, insert, update, delete on public.tags to web_app_user;

-- ─────────────────────────────────────────────────────────────────────────────
-- items — rebuilt to the locked spec. Column order per COLUMN-STANDARDS:
-- id · ref · name · description · status · type · org_id · [class/price/unit/media/attrs/lineage] · audit.
-- ─────────────────────────────────────────────────────────────────────────────
drop table if exists public.items cascade;

create table public.items (
  -- base contract
  id            uuid primary key default gen_random_uuid(),
  ref           text,                                            -- public slug (populate where user-facing, EP-00021)
  name          text not null,
  description   text,
  status        text not null default 'new'
                  check (status in ('new','active','retired')),  -- item_status (system; mirrors code constant)
  type          text check (type is null or type in ('variant','addon','component')),  -- was `kind`; bucket-1; dormant
  org_id        uuid not null references public.orgs(id),        -- exclusive supplier owner

  -- classification (ONE home node at any depth; no subcategory axis)
  category_id   uuid references public.categories(id),
  tier          text,                                            -- codelist `tier` (bucket 3; validated at write)

  -- moderation axis (independent of status)
  approval_status text not null default 'draft'
                  check (approval_status in ('draft','pending','approved','rejected')),

  -- pricing & commerce
  currency      text,                                            -- NULL → supplier default_currency
  base_price    numeric(12,2) check (base_price is null or base_price >= 0),
  install_cost  numeric(12,2) check (install_cost is null or install_cost >= 0),
  install_description text,
  install_unit  text check (install_unit is null or install_unit in ('per_item','per_order','percentage')),

  -- unit-driven (the ONE extra field named by unit.meta.needs; `size` is descriptive → attributes)
  unit          text,                                            -- codelist `item_unit`
  serves        integer check (serves is null or serves > 0),
  time_unit     text,
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),

  -- media
  images        jsonb not null default '[]'::jsonb,              -- [{url, sort_order, is_hero}]
  image_display text not null default 'cover' check (image_display in ('cover','contain')),

  -- describe / configure (5 groups + variants + price_tiers + _source all live here)
  attributes    jsonb not null default '{}'::jsonb,
  external_url  text,                                            -- extract identity (dedup with attributes._source)

  -- lineage (dormant buildup tree; same rule applies if/when it ships)
  parent_item_id  uuid references public.items(id),
  derived_from_id uuid references public.items(id),

  -- audit
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id),

  constraint items_not_self_parent  check (id <> parent_item_id),
  constraint items_not_self_derived check (id <> derived_from_id)
);

create unique index items_ref_uidx       on public.items (ref) where ref is not null and deleted_at is null;
create unique index items_org_name_uidx  on public.items (org_id, lower(name)) where deleted_at is null;
create index items_org_idx       on public.items (org_id) where deleted_at is null;
create index items_category_idx  on public.items (category_id) where deleted_at is null;
create index items_live_idx      on public.items (category_id)
  where deleted_at is null and status = 'active' and approval_status = 'approved';
create index items_parent_idx    on public.items (parent_item_id) where parent_item_id is not null and deleted_at is null;

-- RLS — read: public(active+approved) / own / admin · write: own (admin moderates UPDATE/DELETE only).
-- INSERT is CLOSED (FR-00215): own-org only. Admin cross-org extract writes with current_org = the TARGET org
-- (withAdminContext / createForOrg set it), so org_id = app_current_org() holds without an app_is_admin escape.
alter table public.items enable row level security;
alter table public.items force row level security;

create policy items_read on public.items for select using (
  (status = 'active' and approval_status = 'approved' and deleted_at is null)
  or org_id = public.app_current_org()
  or public.app_is_admin()
);
create policy items_insert on public.items for insert
  with check (org_id = public.app_current_org());                                  -- CLOSED: no admin escape
create policy items_update on public.items for update
  using      (org_id = public.app_current_org() or public.app_svc_moderate())
  with check (org_id = public.app_current_org()
              or (public.app_svc_moderate()
                  and approval_status in ('draft','pending','approved','rejected')));
create policy items_delete on public.items for delete
  using (org_id = public.app_current_org() or public.app_is_admin());              -- admin reject = moderation

grant select, insert, update, delete on public.items to web_app_user;

-- ─────────────────────────────────────────────────────────────────────────────
-- item_tags — Class D junction (item ↔ tag). Soft-unlink; no header, no updated_*.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.item_tags (
  item_id uuid not null references public.items(id),
  tag_id  uuid not null references public.tags(id),
  created_at timestamptz not null default now(), created_by uuid references public.users(id),
  deleted_at timestamptz,
  primary key (item_id, tag_id)
);
create index item_tags_tag_idx on public.item_tags (tag_id) where deleted_at is null;

alter table public.item_tags enable row level security;
alter table public.item_tags force row level security;
-- Visible / writable iff the ITEM is (link rides the item's visibility + ownership).
create policy item_tags_read on public.item_tags for select using (
  exists (select 1 from public.items i where i.id = item_id
            and ((i.status='active' and i.approval_status='approved' and i.deleted_at is null)
                 or i.org_id = public.app_current_org() or public.app_is_admin()))
);
create policy item_tags_write on public.item_tags for all
  using      (exists (select 1 from public.items i where i.id = item_id
                        and (i.org_id = public.app_current_org() or public.app_is_admin())))
  with check (exists (select 1 from public.items i where i.id = item_id
                        and (i.org_id = public.app_current_org() or public.app_is_admin())));
grant select, insert, update, delete on public.item_tags to web_app_user;
