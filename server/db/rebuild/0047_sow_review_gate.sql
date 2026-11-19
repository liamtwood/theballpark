-- 0047_sow_review_gate.sql — the Draft→Review visibility gate (pV2-SOW-01).
--
-- Lifecycle (Liam 2026-11-17): Draft (author-only) → In review (supplier "Send
-- for review" → counterparty can now see it + comment) → Accepted (counterparty
-- Accept → snapshot + PDF rubber stamp) | Declined.
--
-- This tightens the three 0040 `*_counterparty_read` policies with
-- `status <> 'draft'`: a draft is PRIVATE to the author; the counterparty reads
-- the SOW (and its lines/signatures) only once it has been sent for review. The
-- owner still reads their own draft via the `_all` policy (unchanged). Strictly
-- MORE restrictive than 0040 — same party predicate, one extra AND. Mirrors the
-- gate already baked into review_comment_is_party (0046). Status is free text
-- (no enum), so 'in_review'/'accepted' need no schema change.

-- project_documents
drop policy if exists project_documents_counterparty_read on public.project_documents;
create policy project_documents_counterparty_read on public.project_documents for select
  using (
    project_documents.deleted_at is null
    and project_documents.status <> 'draft'                              -- sent-for-review gate
    and exists (
      select 1 from public.project_providers pp
       where pp.id = project_documents.project_provider_id
         and pp.deleted_at is null
         and (public.app_current_org() = pp.org_id or public.app_current_org() = pp.provider_org_id)
         and (project_documents.org_id = pp.org_id or project_documents.org_id = pp.provider_org_id)
         and public.app_current_org() <> project_documents.org_id)
  );

-- project_document_lines
drop policy if exists project_document_lines_counterparty_read on public.project_document_lines;
create policy project_document_lines_counterparty_read on public.project_document_lines for select
  using (
    exists (
      select 1 from public.project_documents d
        join public.project_providers pp on pp.id = d.project_provider_id
       where d.id = project_document_lines.document_id
         and d.deleted_at is null and pp.deleted_at is null
         and d.status <> 'draft'
         and (public.app_current_org() = pp.org_id or public.app_current_org() = pp.provider_org_id)
         and (d.org_id = pp.org_id or d.org_id = pp.provider_org_id)
         and public.app_current_org() <> d.org_id)
  );

-- project_document_signatures
drop policy if exists project_document_signatures_counterparty_read on public.project_document_signatures;
create policy project_document_signatures_counterparty_read on public.project_document_signatures for select
  using (
    exists (
      select 1 from public.project_documents d
        join public.project_providers pp on pp.id = d.project_provider_id
       where d.id = project_document_signatures.document_id
         and d.deleted_at is null and pp.deleted_at is null
         and d.status <> 'draft'
         and (public.app_current_org() = pp.org_id or public.app_current_org() = pp.provider_org_id)
         and (d.org_id = pp.org_id or d.org_id = pp.provider_org_id)
         and public.app_current_org() <> d.org_id)
  );
