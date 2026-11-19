-- 0049_sow_status_review_values.sql — pill values for the review lifecycle.
-- Adds 'in_review' (neutral) + 'accepted' (green) to the sow_status codelist so
-- the status pill reads cleanly. Idempotent (NOT EXISTS guard, like 0039).
INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'sow_status'),
       v.code, v.label, v.sort_order, true, jsonb_build_object('color', v.color)
FROM (VALUES
  ('in_review', 'In review', 6, '#eef2f7'),
  ('accepted',  'Accepted',  7, '--color-state-emerald')
) AS v(code, label, sort_order, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_status')
    AND x.code = v.code
);
