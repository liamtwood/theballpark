-- 0030_line_draft.sql
-- A pre-send line state (Liam 2026-11-03): a line that's in the estimate but has
-- NOT been sent to the supplier yet (status 'to_send' — e.g. a recommended line)
-- reads "Draft", not "Quote requested" (nothing has been requested yet). The
-- deriver returns `draft` for status='to_send'; this seeds the codelist VALUE so
-- the pill shows a label + colour and the text/colour stay editable in
-- Settings ▸ Codelists. Idempotent.

INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'line_display_status'),
       'draft', 'Draft', 12, true, jsonb_build_object('color', '#f1f5f9')
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'line_display_status')
    AND x.code = 'draft'
);
