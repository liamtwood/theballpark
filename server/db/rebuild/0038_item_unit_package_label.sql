-- Rebuild migration 0038 — relabel the item_unit 'platter' code (Liam 2026-11-11).
-- The CODE stays 'platter' (every reveal/pricing path keys off it); only the display
-- label changes to "Package (serves N)" so it reads naturally for a whole-unit item
-- that serves a headcount (e.g. "Dinner for 50", serves 50). Supersedes the 'Platter'
-- label the 0011 groom set. Idempotent.
update public.reference_codelist_values
set label = 'Package (serves N)'
where code = 'platter'
  and codelist_id = (select id from public.reference_codelists where name = 'item_unit' and deleted_at is null);
