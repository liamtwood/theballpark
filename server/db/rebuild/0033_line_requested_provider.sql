-- 0033_line_requested_provider.sql
-- pV2-ADD-LINE-SUPPLIER-01 (Liam 2026-11-08). A CUSTOM line (item_id NULL) the
-- agency adds from a supplier's banner "+" records WHICH supplier it wants to
-- cost it — WITHOUT engaging them. Engagement (project_providers + the brief)
-- still happens only at SEND: a project_providers row grants the supplier RLS
-- READ on the project (0023), so creating it at add would expose an unsent draft.
--
-- Semantics:
--   • NULL  = the agent's own line (unchanged) — never swept into a send.
--   • set   = "please cost this" for that supplier; the estimate attributes the
--             line to them (COALESCE(items.org_id, requested_provider_org_id)) and
--             sendOutreach briefs it to THAT supplier only.
--   • editable while unsent; frozen once briefed (service-enforced).
--   • NOT ownership: project_items.org_id (the agency) still owns the line; the
--     supplier only ever writes its own project_item_quotes row after send.
-- Catalogue lines leave it NULL (their supplier is the item owner).
--
-- Additive nullable column + FK + partial index. Idempotent. No RLS change: the
-- existing project_items policies cover the new column.

alter table public.project_items
  add column if not exists requested_provider_org_id uuid references public.orgs(id);

create index if not exists project_items_requested_provider_idx
  on public.project_items (requested_provider_org_id)
  where deleted_at is null and requested_provider_org_id is not null;
