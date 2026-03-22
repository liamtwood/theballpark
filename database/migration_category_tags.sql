-- =============================================================
-- Ballpark — Category Tags Migration
-- Description: Adds category-scoped tags and item-tag junction
-- Run in: Supabase SQL editor (dev first, then preview, then prod)
-- =============================================================

-- -------------------------------------------------------------
-- 1. TAG TABLE
-- The controlled vocabulary for each category.
-- Admin-managed. Scoped to a single category.
-- -------------------------------------------------------------

create table if not exists tag (
  id           uuid primary key default gen_random_uuid(),
  category_id  text not null references category(id) on delete cascade,
  label        text not null,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),

  unique (category_id, label)
);

comment on table tag is
  'Category-scoped tags. Each tag belongs to exactly one category. '
  'Used to classify supplier items and power brief parsing.';

-- -------------------------------------------------------------
-- 2. ITEM-TAG JUNCTION TABLE
-- -------------------------------------------------------------

create table if not exists supplier_item_tag (
  item_id  uuid not null references items(id) on delete cascade,
  tag_id   uuid not null references tag(id)   on delete cascade,
  primary key (item_id, tag_id)
);

comment on table supplier_item_tag is
  'Many-to-many join between items and tag. '
  'Tags on an item must belong to the same category as the item.';

-- Optional: enforce category consistency at DB level
-- (also enforced in the service layer)
create or replace function check_item_tag_category()
returns trigger language plpgsql as $$
declare
  item_cat  text;
  tag_cat   text;
begin
  select category_id into item_cat from items where id = NEW.item_id;
  select category_id into tag_cat  from tag    where id = NEW.tag_id;
  if item_cat <> tag_cat then
    raise exception 'Tag category (%) does not match item category (%)', tag_cat, item_cat;
  end if;
  return NEW;
end;
$$;

create trigger trg_check_item_tag_category
  before insert or update on supplier_item_tag
  for each row execute function check_item_tag_category();

-- -------------------------------------------------------------
-- 3. INDEXES
-- -------------------------------------------------------------

create index if not exists idx_tag_category_id        on tag(category_id);
create index if not exists idx_supplier_item_tag_item on supplier_item_tag(item_id);
create index if not exists idx_supplier_item_tag_tag  on supplier_item_tag(tag_id);

-- -------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -------------------------------------------------------------

alter table tag               enable row level security;
alter table supplier_item_tag enable row level security;

-- Tags are readable by all authenticated users
create policy "tags_read_all"
  on tag for select
  to authenticated
  using (true);

-- Tags are writable by admins only
create policy "tags_write_admin"
  on tag for all
  to authenticated
  using (
    exists (
      select 1 from users
      where id   = auth.uid()
      and   role = 'admin'
    )
  );

-- Item tags readable by authenticated users
create policy "item_tags_read_all"
  on supplier_item_tag for select
  to authenticated
  using (true);

-- Item tags writable by the supplier who owns the item
create policy "item_tags_write_supplier"
  on supplier_item_tag for all
  to authenticated
  using (
    exists (
      select 1
      from   items i
      join   users u on u.org_id = i.org_id
      where  i.id      = supplier_item_tag.item_id
      and    u.id      = auth.uid()
    )
  );
