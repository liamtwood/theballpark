-- 0056_sow_status_prefixed_labels.sql — prefix the SOW lifecycle pills with "SOW"
-- for consistency across inbox / home / panel (Liam 2026-11-18): SOW Draft, SOW
-- Review (already), SOW Approved, etc. Values unchanged; labels only.
UPDATE public.reference_codelist_values v SET label = m.label
FROM (VALUES
  ('draft',               'SOW Draft'),
  ('reviewed',            'SOW Reviewed'),
  ('accepted',            'SOW Approved'),
  ('declined',            'SOW Rejected'),
  ('executed',            'SOW Executed'),
  ('counterparty_signed', 'SOW Signed')
) AS m(code, label)
WHERE v.code = m.code
  AND v.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_status');
