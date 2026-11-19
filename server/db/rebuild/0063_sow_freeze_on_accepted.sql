-- Rebuild migration 0063 — repoint the SOW edit-immutability lock from "a signature
-- exists" to "fully executed" (status='accepted'). pV2-SOW-01.
--
-- The sign flow was retired (0061: send → agent accept → supplier co_approve →
-- accepted). The freeze trigger keyed off a signature existing, which can no longer
-- happen — so an accepted (Fully Executed) contract was immutable only in the UI,
-- not at the DB level. A finalised contract must be tamper-proof server-side too
-- (acquisition-grade). Blocks substance edits once status='accepted'; keeps the
-- signature check for any legacy signed docs. Status-only transitions are unaffected
-- (status isn't in the substance list). (Liam 2026-11-19.)
CREATE OR REPLACE FUNCTION public.project_documents_freeze()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
begin
  if ( old.status = 'accepted'
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
    raise exception 'project_documents %: frozen once fully executed — create a new SOW to amend', old.id;
  end if;
  return new;
end $function$;
