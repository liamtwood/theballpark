-- Rebuild migration 0043 — SOW section boilerplate (pV2-SOW-01, Phase 2).
-- Adds the per-section intro copy (Parties, Milestones, Services, Fees, T&Cs …)
-- to the existing `sow_boilerplate` codelist so it is editable in Settings ▸
-- Codelists alongside intro / payment_schedule / conclusion. The Angular panel
-- reads each via CodelistService (bp('<code>')) and falls back to a built-in
-- default when the list is absent. Idempotent (skips codes that already exist).

INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'sow_boilerplate'),
       v.code, v.label, v.sort_order, true, jsonb_build_object('text', v.text)
FROM (VALUES
  ('parties_project', 'Parties & Project intro', 4,
   'This Statement of Work ("SOW") is entered into between the two parties identified in the SOW Parties table below, and governs the goods and services to be supplied in connection with the project set out in Project Details.'),
  ('sow_parties', 'SOW Parties intro', 5,
   'This SOW is made between the following parties, each of whom warrants that it has authority to enter into it:'),
  ('project_details', 'Project Details intro', 6,
   'This SOW relates to the following project:'),
  ('milestones', 'Project Milestones intro', 7,
   'The key dates and milestones for delivery of the Services are set out below. Dates shown as indicative are subject to written confirmation by both parties; confirmed dates are binding.'),
  ('services_goods', 'Services & Goods intro', 8,
   'The Supplier shall supply the goods and deliver the services described in this section, as agreed and costed through the Ballpark platform. The pricing table below is the definitive record of the agreed scope and cost; the item descriptions that follow set out the agreed detail.'),
  ('services_install', 'Services (install & de-rig) intro', 9,
   'The following installation, on-site and de-rig services are included for each item, as specified by the Supplier:'),
  ('fees_payment', 'Fees & Payment intro', 10,
   'The Fee payable under this SOW, and the terms on which it is invoiced and paid, are set out below. All amounts are exclusive of VAT unless expressly stated otherwise.'),
  ('terms', 'Terms & Conditions', 11,
   'The Supplier''s standard terms and conditions of supply apply to and are incorporated into this SOW (provided at supplier level). Where those terms conflict with the body of this SOW, the body of this SOW prevails.')
) AS v(code, label, sort_order, text)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_boilerplate') AND x.code = v.code
);
