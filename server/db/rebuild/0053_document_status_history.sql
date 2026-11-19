-- 0053_document_status_history.sql — SOW status history (pV2-SOW-01, Liam 2026-11-18).
-- A row per status change (who + when), so the panel can show a "History" of the
-- review lifecycle. Captured by an AFTER trigger on project_documents, so EVERY path
-- that changes status (document_review, sign, create) is logged uniformly — no caller
-- has to remember to write it. changed_by = the session user GUC (null for a
-- migration/backfill write). Readable by the engagement parties (same resolver as
-- the comment thread; counterparty only once status<>'draft').

create table if not exists public.document_status_history (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.project_documents(id) on delete cascade,
  status      text not null,
  changed_by  uuid references public.users(id),
  changed_at  timestamptz not null default now()
);
create index if not exists document_status_history_doc_idx
  on public.document_status_history (document_id, changed_at);

comment on table public.document_status_history is
  'Append-only SOW status-change log (pV2-SOW-01, 0053). One row per status change via the project_documents trigger; read by engagement parties.';

-- Trigger fn (SECURITY DEFINER so it writes past RLS; logs the session user GUC).
create or replace function public.log_document_status() returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
begin
  if NEW.type <> 'sow' then return NEW; end if;
  if TG_OP = 'INSERT' or NEW.status is distinct from OLD.status then
    insert into public.document_status_history (document_id, status, changed_by)
    values (NEW.id, NEW.status, public.app_current_user_id());
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_log_document_status on public.project_documents;
create trigger trg_log_document_status
  after insert or update of status on public.project_documents
  for each row execute function public.log_document_status();

-- RLS: parties read; no direct insert grant (the SECURITY DEFINER trigger writes).
alter table public.document_status_history enable row level security;
grant select on public.document_status_history to web_app_user;
drop policy if exists document_status_history_party_read on public.document_status_history;
create policy document_status_history_party_read on public.document_status_history for select
  using (public.review_comment_is_party('sow', document_id));

-- Backfill: seed each existing SOW's current status so History isn't empty for them.
insert into public.document_status_history (document_id, status, changed_by, changed_at)
select d.id, d.status, null, d.updated_at
  from public.project_documents d
 where d.type = 'sow'
   and not exists (select 1 from public.document_status_history h where h.document_id = d.id);
