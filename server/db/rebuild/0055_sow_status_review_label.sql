-- 0055_sow_status_review_label.sql — relabel the in_review pill from "In review" to
-- "SOW Review" (Liam 2026-11-18): reads clearly in the inbox + SOW panel. Value
-- unchanged (in_review); label only.
UPDATE public.reference_codelist_values
   SET label = 'SOW Review'
 WHERE code = 'in_review'
   AND codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_status');
