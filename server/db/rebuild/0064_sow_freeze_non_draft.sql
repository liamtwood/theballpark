-- Rebuild migration 0064 — SOW substance is immutable in ANY non-draft state.
-- pV2-SOW-01 (audit #2, Liam 2026-11-19).
--
-- 0063 froze substance on status='accepted', but substance was still editable in the
-- in_review / reviewed / agent_approved window: an author could change content AFTER
-- the agent approved, then co_approve — executing a document the counterparty approved
-- a DIFFERENT version of. Block substance edits whenever the SOW is not a draft (or a
-- legacy signature exists). Status-only transitions are unaffected (status is not in
-- the substance list); the only legitimate substance write, applySuggestions, already
-- requires a draft. To edit, the author pulls it back to draft (Revise).
CREATE OR REPLACE FUNCTION public.project_documents_freeze()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
begin
  if ( old.status <> 'draft'
       or exists (select 1 from public.project_document_signatures s where s.document_id = old.id) )
     and (
          new.content               is distinct from old.content
       or new.deposit_pct           is distinct from old.deposit_pct
       or new.parties_snapshot      is distinct from old.parties_snapshot
       or new.terms_snapshot        is distinct from old.terms_snapshot
       or new.name                  is distinct from old.name
       or new.description           is distinct from old.description
       or new.project_provider_id   is distinct from old.project_provider_id
       or new.project_id            is distinct from old.project_id
       or new.org_id                is distinct from old.org_id
       or new.supersedes_document_id is distinct from old.supersedes_document_id
     ) then
    raise exception 'project_documents %: frozen — only a draft SOW may be edited (Revise it to a draft, or create a new SOW to amend)', old.id;
  end if;
  return new;
end $function$;
