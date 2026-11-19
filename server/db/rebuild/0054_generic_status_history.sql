-- 0054_generic_status_history.sql — generalise the SOW status log (0053) into a
-- GENERIC status_history keyed by (entity_type, entity_id), so the SAME History view
-- serves SOW review AND admin item approvals (Liam 2026-11-18). Adds an `event` label
-- (e.g. 'Send for review', 'Approved') so a status reads as the action taken, and
-- records the creator (project_documents.created_by) as the first 'Created' event.
--
-- review_comments is already generic (entity_type/entity_id), so per-person comment
-- tallies compose with this over the same keys.

-- Drop the 0053 document-specific objects (dev-only, never promoted).
drop trigger  if exists trg_log_document_status on public.project_documents;
drop function if exists public.log_document_status();
drop table    if exists public.document_status_history;

create table if not exists public.status_history (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,                 -- 'sow' | 'item' | …
  entity_id   uuid not null,
  status      text not null,                 -- the new status code
  event       text,                          -- display label of the action
  changed_by  uuid references public.users(id),
  changed_at  timestamptz not null default now()
);
create index if not exists status_history_entity_idx
  on public.status_history (entity_type, entity_id, changed_at);

comment on table public.status_history is
  'Generic append-only status-change log (pV2-SOW-01, 0054). (entity_type,entity_id) = sow|item + id; event = action label. Read by the entity''s parties; written by per-entity triggers.';

-- SOW trigger: derive the action label from the transition, write to status_history.
create or replace function public.log_sow_status() returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare v_event text;
begin
  if NEW.type <> 'sow' then return NEW; end if;
  if TG_OP = 'INSERT' then
    v_event := 'Created';
  elsif NEW.status is distinct from OLD.status then
    v_event := case NEW.status
      when 'in_review'           then 'Send for review'
      when 'reviewed'            then 'Reviewed'
      when 'accepted'            then 'Approved'
      when 'declined'            then 'Rejected'
      when 'draft'               then 'Revised'
      when 'counterparty_signed' then 'Signed'
      when 'executed'            then 'Executed'
      else initcap(replace(NEW.status, '_', ' '))
    end;
  else
    return NEW;
  end if;
  insert into public.status_history (entity_type, entity_id, status, event, changed_by)
  values ('sow', NEW.id, NEW.status, v_event, public.app_current_user_id());
  return NEW;
end;
$$;

drop trigger if exists trg_log_sow_status on public.project_documents;
create trigger trg_log_sow_status
  after insert or update of status on public.project_documents
  for each row execute function public.log_sow_status();

-- RLS: parties read (resolver switches on entity_type; 'item' denied until wired).
alter table public.status_history enable row level security;
grant select on public.status_history to web_app_user;
drop policy if exists status_history_party_read on public.status_history;
create policy status_history_party_read on public.status_history for select
  using (public.review_comment_is_party(entity_type, entity_id));

-- Backfill from project_documents (deterministic; not from the dropped 0053 table).
-- 1) a 'Created' event (draft) by the real creator at created_at.
insert into public.status_history (entity_type, entity_id, status, event, changed_by, changed_at)
select 'sow', d.id, 'draft', 'Created', d.created_by, d.created_at
  from public.project_documents d
 where d.type = 'sow'
   and not exists (select 1 from public.status_history h
                    where h.entity_type = 'sow' and h.entity_id = d.id and h.event = 'Created');
-- 2) the current status (if past draft) at updated_at — actor unknown for history before 0054.
insert into public.status_history (entity_type, entity_id, status, event, changed_by, changed_at)
select 'sow', d.id, d.status,
       case d.status
         when 'in_review' then 'Send for review'
         when 'reviewed'  then 'Reviewed'
         when 'accepted'  then 'Approved'
         when 'declined'  then 'Rejected'
         else initcap(replace(d.status, '_', ' '))
       end,
       null, d.updated_at
  from public.project_documents d
 where d.type = 'sow' and d.status <> 'draft'
   and not exists (select 1 from public.status_history h
                    where h.entity_type = 'sow' and h.entity_id = d.id and h.status = d.status);
