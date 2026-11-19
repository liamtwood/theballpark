-- Rebuild migration 0045 — SOW Appendices intro (pV2-SOW-01, Phase 2).
-- Adds the 'appendix' section intro to the sow_boilerplate codelist, consistent
-- with the other per-section intros (editable in Settings ▸ Codelists). The
-- Appendices node (type 'appendix') renders its attachment slot below this text;
-- upload UI is the deferred Documents work. Idempotent.

INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'sow_boilerplate'),
       'appendix', 'Appendices intro', 12, true,
       jsonb_build_object('text', 'The documents listed below are attached to and form part of this Statement of Work.')
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_boilerplate') AND x.code = 'appendix'
);
