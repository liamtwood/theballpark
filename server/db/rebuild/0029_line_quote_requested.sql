-- 0029_line_quote_requested.sql
-- A pre-pricing split (Liam 2026-11-02): a briefed line reads "Quote requested"
-- until the supplier engages (sends any message), then "Agreeing cost" (to_agree);
-- a price action already moves it to quoted/etc. `quote_requested` is the new
-- line_display_status code the deriver returns for brief_sent with no supplier
-- engagement. Idempotent.

INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'line_display_status'),
       'quote_requested', 'Quote requested', 11, true, jsonb_build_object('color', '#f8fafc')
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'line_display_status')
    AND x.code = 'quote_requested'
);
