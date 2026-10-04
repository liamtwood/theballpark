-- Rebuild migration 0003 — USER_ORGS (membership + authority) — completes step 2.
-- Junction (composite PK user_id+org_id) but WITH mutable attributes (role/status
-- change), so it carries full audit. role = member/admin/owner (owner = the new
-- tier, creator/billing/can't-remove). app_is_org_admin updated for role (was is_admin).
-- Seeds the system user as owner of Ballpark #1 so the root org has an owner.

create table public.user_orgs (
  user_id uuid not null references public.users(id),
  org_id  uuid not null references public.orgs(id),
  role    text not null default 'member' check (role in ('member','admin','owner')),
  status  text not null default 'invited' check (status in ('invited','active','suspended','removed')),
  job_title text,
  invited_by_user_id uuid references public.users(id),
  invited_at timestamptz,
  joined_at  timestamptz,
  created_at timestamptz not null default now(), created_by uuid not null references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id),
  primary key (user_id, org_id)
);
create index user_orgs_org_idx on public.user_orgs (org_id) where deleted_at is null;

-- org-admin check, role-based (member<admin<owner); admin OR owner => org admin.
create or replace function public.app_is_org_admin(oid uuid)
  returns boolean language sql stable security definer set search_path to 'public','pg_catalog'
  as $$ select exists (select 1 from user_orgs
          where user_id = public.app_current_user_id() and org_id = oid
            and role in ('admin','owner') and status = 'active' and deleted_at is null) $$;

-- seed: system user owns Ballpark #1
insert into public.user_orgs (user_id, org_id, role, status, joined_at, created_by)
  values ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000001','owner','active', now(),
          '00000000-0000-0000-0000-000000000000');

alter table public.user_orgs enable row level security;
alter table public.user_orgs force row level security;
create policy user_orgs_read on public.user_orgs for select
  using (user_id = public.app_current_user_id() or public.app_is_org_admin(org_id) or public.app_is_admin());
create policy user_orgs_write on public.user_orgs for all
  using (public.app_is_admin() or public.app_is_org_admin(org_id))
  with check (public.app_is_admin() or (public.app_is_org_admin(org_id) and user_id <> public.app_current_user_id()));

grant select, insert, update, delete on public.user_orgs to web_app_user;
