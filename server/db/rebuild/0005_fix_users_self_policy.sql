-- Rebuild migration 0005 — fix users_self visibility for the streamlined model.
--
-- In v2dev, users.org_id is the Ballpark INSTANCE (identity ownership), not the
-- member's functional org — functional membership lives in user_orgs. So 0002's
-- users_self clause `org_id = app_current_org()` (ported from v1, where org_id WAS
-- the functional org, to let org-mates see each other) is now DEAD: it only ever
-- matches the Ballpark org. Symptom: an agency admin could read a new member's
-- user_orgs row but not the member's users row, so GET/POST /api/team 500'd
-- building the member projection.
--
-- Fix: visibility by MEMBERSHIP OVERLAP — you can see a user if they are a member
-- of your current active org. A SECURITY DEFINER helper avoids RLS recursion when
-- the users policy reads user_orgs (mirrors app_is_org_admin in 0003).

create or replace function public.app_can_see_user(target uuid)
  returns boolean language sql stable security definer set search_path to 'public','pg_catalog'
  as $$ select exists (
    select 1 from user_orgs uo
     where uo.user_id = target
       and uo.org_id  = public.app_current_org()
       and uo.deleted_at is null
  ) $$;

drop policy if exists users_self on public.users;
create policy users_self on public.users for all
  using (
    id = public.app_current_user_id()
    or public.app_is_admin()
    or public.app_can_see_user(id)      -- shares my active org (membership overlap)
  )
  with check (id = public.app_current_user_id() or public.app_is_admin());
