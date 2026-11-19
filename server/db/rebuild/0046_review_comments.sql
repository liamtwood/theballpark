-- 0046_review_comments.sql — generic review/approval COMMENT machine (pV2-SOW-01).
--
-- ONE table + lifecycle shared by two surfaces (Liam 2026-11-17):
--   • SOW review  — entity_type='sow',   entity_id=project_documents.id, anchor_id=SOW node id
--   • item images — entity_type='image', entity_id=<image>,              anchor_id=null (FUTURE)
-- The "machine" = post (either party) → read (both parties) → the OWNING side
-- resolves/closes. v1 is comments only; the document stays author-owned and
-- immutable-by-the-counterparty (the SOW section tree is never written by the
-- agent — this thread is the one place the counterparty can write).
--
-- SECURITY (acquisition-grade, mirrors the 0040/0042 SOW pattern): a per-entity
-- party resolver, SECURITY DEFINER + fail-closed (NULLIF→NULL GUC → deny). For a
-- 'sow' the parties come from the engagement (project_providers: agency=org_id,
-- supplier=provider_org_id); the COUNTERPARTY is admitted only once status<>'draft'
-- (the owner always, so they can triage a draft's thread). 'image' is denied until
-- its resolver is written (the item-image entity isn't a table with ids yet — images
-- live in items.images jsonb; wiring owed when image approvals are built).
-- Coverage test owed alongside this (same class as the SOW cluster's 31/31).

-- ── table ────────────────────────────────────────────────────────────────────
create table if not exists public.review_comments (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null check (entity_type in ('sow', 'image')),
  entity_id      uuid not null,
  anchor_id      text,                       -- SOW node id; null = whole-doc / image
  author_org_id  uuid not null references public.orgs(id),
  author_user_id uuid not null references public.users(id),
  body           text not null check (length(btrim(body)) > 0),
  status         text not null default 'open' check (status in ('open', 'resolved')),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references public.users(id)
);
create index if not exists review_comments_entity_idx on public.review_comments (entity_type, entity_id);
create index if not exists review_comments_open_idx   on public.review_comments (entity_type, entity_id) where status = 'open';

comment on table public.review_comments is
  'Generic review/approval comment thread (pV2-SOW-01, 0046). entity_type sow|image; anchor_id = SOW node id. Both engagement parties read+insert; the owning side resolves. RLS via review_comment_is_party / _is_owner (SECURITY DEFINER, per-entity).';

-- ── party / owner resolvers (SECURITY DEFINER, fail-closed) ──────────────────
-- is_party: may this caller SEE / POST on this entity's thread?
create or replace function public.review_comment_is_party(p_entity_type text, p_entity_id uuid)
  returns boolean
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select case p_entity_type
    when 'sow' then exists (
      select 1
        from public.project_documents d
        join public.project_providers pp on pp.id = d.project_provider_id
       where d.id = p_entity_id
         and d.deleted_at is null
         and pp.deleted_at is null
         and public.app_current_org() in (pp.org_id, pp.provider_org_id)   -- a party to the engagement
         and (public.app_current_org() = d.org_id or d.status <> 'draft')) -- counterparty only once sent
    -- 'image' resolver owed (items.images jsonb has no id table yet) → deny for now.
    else false
  end;
$$;
revoke all on function public.review_comment_is_party(text, uuid) from public;
grant execute on function public.review_comment_is_party(text, uuid) to web_app_user;

-- is_owner: may this caller RESOLVE/close a comment on this entity? (the author side)
create or replace function public.review_comment_is_owner(p_entity_type text, p_entity_id uuid)
  returns boolean
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select case p_entity_type
    when 'sow' then exists (
      select 1 from public.project_documents d
       where d.id = p_entity_id
         and d.deleted_at is null
         and d.org_id = public.app_current_org())   -- the AUTHOR owns the thread
    else false
  end;
$$;
revoke all on function public.review_comment_is_owner(text, uuid) from public;
grant execute on function public.review_comment_is_owner(text, uuid) to web_app_user;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.review_comments enable row level security;
alter table public.review_comments force  row level security;
grant select, insert, update on public.review_comments to web_app_user;  -- no delete (append-only + resolve)

-- SELECT — either party to the entity.
drop policy if exists review_comments_party_read on public.review_comments;
create policy review_comments_party_read on public.review_comments for select
  using (public.review_comment_is_party(entity_type, entity_id));

-- INSERT — a party, posting AS themselves (org + user pinned to the session).
drop policy if exists review_comments_party_insert on public.review_comments;
create policy review_comments_party_insert on public.review_comments for insert
  with check (
    public.review_comment_is_party(entity_type, entity_id)
    and author_org_id  = public.app_current_org()
    and author_user_id = public.app_current_user_id()
  );

-- UPDATE — only the owning (author) side, to resolve. USING + WITH CHECK both pin
-- to the owner so a comment can't be re-homed to another entity on update.
drop policy if exists review_comments_owner_update on public.review_comments;
create policy review_comments_owner_update on public.review_comments for update
  using      (public.review_comment_is_owner(entity_type, entity_id))
  with check (public.review_comment_is_owner(entity_type, entity_id));
