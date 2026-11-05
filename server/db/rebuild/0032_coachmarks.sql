-- 0032_coachmarks.sql
-- Legacy-only table gap (table-gap audit 2026-11-04): coachmarks is CREATEd by
-- the legacy migrate-schemas.js but was never ported to server/db/rebuild/*, so
-- it's missing on run.js envs → coachmark.service.js / routes/coachmarks.js break
-- ("relation \"coachmarks\" does not exist") when the endpoint is hit.
-- A GLOBAL UI-hint registry (page+name unique). POST /api/coachmarks/resolve is
-- register-if-missing for any ACTIVE member (every route already requires one);
-- GET list + PATCH edit are platform-admin. So: reads PUBLIC, INSERT by any
-- authenticated session (resolve), UPDATE platform-admin only. Idempotent.

create table if not exists public.coachmarks (
  id          uuid primary key default gen_random_uuid(),
  page        varchar(100) not null,
  name        varchar(100) not null,
  description text,
  tail        varchar(10) default 'up',
  is_active   boolean default true,
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create unique index if not exists coachmarks_page_name_key on public.coachmarks (page, name);

alter table public.coachmarks enable row level security;
alter table public.coachmarks force row level security;

drop policy if exists coachmarks_read on public.coachmarks;
create policy coachmarks_read on public.coachmarks for select using (true);

-- register-if-missing: any authenticated session (the route gate requires an
-- active member; the per-request user GUC is set on the pooled connection).
drop policy if exists coachmarks_insert on public.coachmarks;
create policy coachmarks_insert on public.coachmarks for insert
  with check (public.app_current_user_id() is not null);

drop policy if exists coachmarks_update on public.coachmarks;
create policy coachmarks_update on public.coachmarks for update
  using (public.app_is_admin()) with check (public.app_is_admin());

grant select, insert, update on public.coachmarks to web_app_user;
