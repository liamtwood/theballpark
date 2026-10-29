-- 0026_status_codelists.sql
-- The two EDITABLE status-pill codelists (family = 'Pills'), consolidated from the
-- old per-surface hardcoded pills (Liam 2026-10-29):
--   line_display_status      — per-LINE status (8 codes): the inbox rail/header,
--                              Running budget rows and estimate rows.
--   supplier_summary_status  — per-SUPPLIER rollup (3 codes): the Running budget
--                              supplier cards and the Messages landing.
-- Both render via the shared app-status-pill (text + colour from the value meta,
-- editable in Settings ▸ Codelists). Values reflect the design agreed on dev2.
-- Also sets the `family` grouping tag on the ballpark lists (groups the Settings
-- list: Pills / Item Attributes / Object Type / Project Attributes). Idempotent:
-- safe to re-run and safe on an env that already has any of this.

-- 1) supplier_summary_status codelist (new) ----------------------------------
INSERT INTO public.reference_codelists (name, description, type, family, default_code, is_active)
SELECT 'supplier_summary_status',
       'Per-supplier rollup status (Running budget supplier cards + Messages landing)',
       'ballpark', 'Pills', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM public.reference_codelists WHERE name = 'supplier_summary_status');

-- 2) line_display_status → Pills family --------------------------------------
UPDATE public.reference_codelists SET family = 'Pills' WHERE name = 'line_display_status';

-- 3) new line_display_status codes (quoted / new_cost / booked) --------------
INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'line_display_status'),
       v.code, v.label, v.sort_order, true, jsonb_build_object('color', v.color)
FROM (VALUES
  ('quoted',   'Price offered',     2, '#f8fafc'),
  ('new_cost', 'Price Match asked', 3, '#f8fafc'),
  ('booked',   'Booked',            7, '--color-state-emerald')
) AS v(code, label, sort_order, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'line_display_status')
    AND x.code = v.code
);

-- 4) supplier_summary_status values ------------------------------------------
INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'supplier_summary_status'),
       v.code, v.label, v.sort_order, true, jsonb_build_object('color', v.color)
FROM (VALUES
  ('action_required',  'Action required',  1, '#f8fafc'),
  ('awaiting_supplier','Awaiting supplier', 2, '#f8fafc'),
  ('all_confirmed',    'All confirmed',     3, '#c54382')
) AS v(code, label, sort_order, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'supplier_summary_status')
    AND x.code = v.code
);

-- 5) labels + sort + colours on every value (the agreed design) --------------
UPDATE public.reference_codelist_values rcv
SET label = v.label,
    sort_order = v.sort_order,
    meta = COALESCE(rcv.meta, '{}'::jsonb) || jsonb_build_object('color', v.color)
FROM (VALUES
  ('line_display_status',     'to_agree',          'Agreeing cost',     1, '#f8fafc'),
  ('line_display_status',     'quoted',            'Price offered',     2, '#f8fafc'),
  ('line_display_status',     'new_cost',          'Price Match asked', 3, '#f8fafc'),
  ('line_display_status',     'you_accepted',      'You accepted',      4, '#c54382'),
  ('line_display_status',     'they_accepted',     'They accepted',     5, '#c54382'),
  ('line_display_status',     'all_confirmed',     'Cost Accepted',     6, '#c54382'),
  ('line_display_status',     'booked',            'Booked',            7, '--color-state-emerald'),
  ('line_display_status',     'declined',          'Declined',          8, '--color-danger'),
  ('supplier_summary_status', 'action_required',   'Action required',   1, '#f8fafc'),
  ('supplier_summary_status', 'awaiting_supplier', 'Awaiting supplier', 2, '#f8fafc'),
  ('supplier_summary_status', 'all_confirmed',     'All confirmed',     3, '#c54382')
) AS v(list, code, label, sort_order, color)
WHERE rcv.code = v.code
  AND rcv.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = v.list);

-- 6) family grouping for the other ballpark lists ----------------------------
UPDATE public.reference_codelists SET family = v.fam
FROM (VALUES
  ('install_unit',      'Item Attributes'),
  ('item_attribute',    'Item Attributes'),
  ('item_media_limits', 'Item Attributes'),
  ('item_unit',         'Item Attributes'),
  ('address_type',      'Object Type'),
  ('project_type',      'Object Type'),
  ('tier',              'Project Attributes'),
  ('mood',              'Project Attributes'),
  ('currency',          'Project Attributes')
) AS v(name, fam)
WHERE public.reference_codelists.name = v.name;
