-- 0027_supplier_self_status.sql
-- The supplier's OWN project rollup pill (supplier home / Messages landing), worded
-- from the supplier's point of view — distinct from supplier_summary_status, which
-- is the AGENT's view of a supplier ("Awaiting supplier"). Here the supplier sees
-- "Action required" (their turn), "Awaiting agency" (waiting on the agency) or
-- "All confirmed". Editable pill (type ballpark, family Pills). Idempotent.

INSERT INTO public.reference_codelists (name, description, type, family, default_code, is_active)
SELECT 'supplier_self_status',
       'Supplier''s own project rollup status (supplier home + Messages landing)',
       'ballpark', 'Pills', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM public.reference_codelists WHERE name = 'supplier_self_status');

INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'supplier_self_status'),
       v.code, v.label, v.sort_order, true, jsonb_build_object('color', v.color)
FROM (VALUES
  ('action_required', 'Action required', 1, '#f8fafc'),
  ('awaiting_agency', 'Awaiting agency', 2, '#f8fafc'),
  ('all_confirmed',   'All confirmed',   3, '#c54382')
) AS v(code, label, sort_order, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'supplier_self_status')
    AND x.code = v.code
);
