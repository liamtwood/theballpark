-- Rebuild migration 0041 — SOW boilerplate codelist (pV2-SOW-01, Phase 2).
-- The SOW's fixed boilerplate copy (Standard Intro, Payment schedule, Signature
-- conclusion) lives in a `sow_boilerplate` reference codelist (type='ballpark',
-- per-env, editable in Settings ▸ Codelists) rather than hardcoded in the client.
-- The text is stored in each value's meta.text; the Angular panel reads it via
-- CodelistService and falls back to a built-in default when the list is absent.
-- APPLIED to ballpark-v2-dev 2026-11-16 (via Supabase MCP).

INSERT INTO public.reference_codelists (name, description, type, family, default_code, is_active)
SELECT 'sow_boilerplate', 'SOW fixed boilerplate copy (intro / payment schedule / conclusion)', 'ballpark', NULL, NULL, true
WHERE NOT EXISTS (SELECT 1 FROM public.reference_codelists WHERE name = 'sow_boilerplate');

INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'sow_boilerplate'),
       v.code, v.label, v.sort_order, true, jsonb_build_object('text', v.text)
FROM (VALUES
  ('intro', 'Document Purpose', 1,
   'This Statement of Work ("SOW") is entered into directly between the Agency and the Supplier named below in connection with the project described. It was generated using cost data and scope details submitted through the Ballpark platform (www.theballpark.ai - operated by The Ballpark AI Ltd, "Ballpark").

Ballpark is a technology platform that connects Agencies with Suppliers and provides ballpark cost estimates, booking tools and payment facilitation. Ballpark is not a party to this SOW, does not provide the Services or Deliverables described in it, and is not responsible for their delivery. See "Role of Ballpark" in Annex A for full detail.'),
  ('payment_schedule', 'Payment schedule', 2,
   'A percentage of the total Fee is invoiced upon signature of this SOW by both the Agency and the Supplier. The negotiated percentage is defined in the table below, and paid by the Agency via Stripe. The remaining balance is invoiced on completion of the Services, payable within [30] days. Funds are collected and released by Ballpark acting solely as a payment facilitator on the Supplier''s behalf.'),
  ('conclusion', 'Signature conclusion', 3,
   'This Statement of Work is entered into on the Effective Date pursuant to the Supplier''s standard terms of purchase set out in Annex A. Any terms and conditions on the Agency''s form of purchase order are void and have no legal effect unless otherwise agreed. Each party warrants that they have all right, title and interest to bind the applicable entity on whose behalf they are signing.')
) AS v(code, label, sort_order, text)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_boilerplate') AND x.code = v.code
);
