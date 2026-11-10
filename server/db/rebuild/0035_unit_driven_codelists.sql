-- Rebuild migration 0035 — the two unit-driven codelists that item_unit.meta.needs
-- points at but 0007/0011 never seeded:
--   time → 'time_unit'  (Hour / Half day / Day / Weekend / Week / Month) → items.time_unit (column)
--   size → 'size'       (Small / Medium / Large / XLarge)                → items.attributes.size (JSONB)
-- 0007 RETIRED the old `item_time_unit` list and nothing replaced it; 0011 set
-- time→needs:"time_unit" and size→needs:"size" with no list behind either, so the
-- item editor had no options to offer. Both are ballpark (admin-editable in Settings).
-- Idempotent (NOT EXISTS guards) so a re-run / an env already seeded by hand is a no-op.

-- ── time_unit ───────────────────────────────────────────────────────────────
insert into public.reference_codelists (name, type, family, default_code, description)
select 'time_unit', 'ballpark', 'Item Attributes', 'hour',
       'Time granularity for time-priced items (item_unit = time); stored in items.time_unit.'
where not exists (select 1 from public.reference_codelists where name = 'time_unit');

insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active)
select (select id from public.reference_codelists where name = 'time_unit'), v.code, v.label, null, v.sort_order, true
from (values
  ('hour','Hour',0), ('half_day','Half day',1), ('day','Day',2),
  ('weekend','Weekend',3), ('week','Week',4), ('month','Month',5)
) as v(code, label, sort_order)
where not exists (
  select 1 from public.reference_codelist_values rv
  where rv.codelist_id = (select id from public.reference_codelists where name = 'time_unit')
    and rv.code = v.code
);

insert into public.reference_codelist_consumers (codelist_id, consumer_table, consumer_column)
select (select id from public.reference_codelists where name = 'time_unit'), 'items', 'time_unit'
where not exists (
  select 1 from public.reference_codelist_consumers
  where codelist_id = (select id from public.reference_codelists where name = 'time_unit')
    and consumer_table = 'items' and consumer_column = 'time_unit'
);

-- ── size ────────────────────────────────────────────────────────────────────
-- Descriptive label (prices like `each`), so it lives in attributes.size, not a
-- column — hence no reference_codelist_consumers row (no dedicated column to point at).
insert into public.reference_codelists (name, type, family, default_code, description)
select 'size', 'ballpark', 'Item Attributes', 'medium',
       'Descriptive size for size-unit items (item_unit = size); stored in items.attributes.size.'
where not exists (select 1 from public.reference_codelists where name = 'size');

insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active)
select (select id from public.reference_codelists where name = 'size'), v.code, v.label, null, v.sort_order, true
from (values
  ('small','Small',0), ('medium','Medium',1), ('large','Large',2), ('xlarge','XLarge',3)
) as v(code, label, sort_order)
where not exists (
  select 1 from public.reference_codelist_values rv
  where rv.codelist_id = (select id from public.reference_codelists where name = 'size')
    and rv.code = v.code
);
