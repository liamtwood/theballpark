-- Rebuild migration 0011 — groom the `item_unit` codelist to the v0.2.0 locked 5.
-- Supersedes the item_unit values the 0007 seed carried over from v2 (25 values).
-- Per pV2-STORE-IMPORT-01: every item has a universal core; the chosen UNIT names
-- the ONE extra field via meta.needs. Five units only:
--   each        → (none)          qty × base_price
--   per_guest   → (none)          guest_count × base_price
--   platter     → needs: serves   ⌈guests ÷ serves⌉ × base_price
--   time        → needs: time_unit qty × base_price × periods
--   size        → needs: size      size is a descriptive label (→ attributes); prices like each
do $$
declare lid uuid;
begin
  select id into lid from public.reference_codelists where name = 'item_unit' and deleted_at is null;
  if lid is null then raise exception 'item_unit codelist not found'; end if;

  delete from public.reference_codelist_values where codelist_id = lid;

  insert into public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta) values
    (lid, 'each',      'Each',      0, true, '{}'::jsonb),
    (lid, 'per_guest', 'Per guest', 1, true, '{}'::jsonb),
    (lid, 'platter',   'Platter',   2, true, '{"needs":"serves"}'::jsonb),
    (lid, 'time',      'Time',      3, true, '{"needs":"time_unit"}'::jsonb),
    (lid, 'size',      'Size',      4, true, '{"needs":"size"}'::jsonb);

  update public.reference_codelists set default_code = 'each', updated_at = now() where id = lid;
end $$;
