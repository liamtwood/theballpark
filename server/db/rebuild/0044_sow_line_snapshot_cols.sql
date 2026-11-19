-- Rebuild migration 0044 — SOW line snapshot columns (pV2-SOW-01, Phase 2).
-- project_document_lines FREEZES the agreed production items at execution (so a
-- signed SOW shows what was signed, not the live thread). The display gained
-- fields the table predates — add them. `spec` already holds the item
-- description. Idempotent (IF NOT EXISTS). Snapshot is written on sign→executed.

ALTER TABLE public.project_document_lines ADD COLUMN IF NOT EXISTS sku                 text;
ALTER TABLE public.project_document_lines ADD COLUMN IF NOT EXISTS unit_size           text; -- platter → serves, time → time_unit
ALTER TABLE public.project_document_lines ADD COLUMN IF NOT EXISTS variant             text; -- chosen variant label
ALTER TABLE public.project_document_lines ADD COLUMN IF NOT EXISTS variant_description text; -- the variant's own copy (markdown)
ALTER TABLE public.project_document_lines ADD COLUMN IF NOT EXISTS install_description text; -- services / install copy (markdown)
