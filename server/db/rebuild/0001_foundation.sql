-- Rebuild migration 0001 — FOUNDATION (step 0, part 1)
-- Security primitives with no table dependencies. Replicated from the live
-- BallPark DB (EP-00020) so the acquisition-grade RLS model carries over.
-- Table-dependent helpers (app_owns_project, app_is_org_admin, …) ship WITH
-- their own tables in later migrations (per-table policy rule).

-- GUC-backed identity. request-context middleware sets these per request from
-- the validated bp_session JWT; names kept identical so the middleware is unchanged.
create or replace function public.app_current_org()
  returns uuid language sql stable set search_path to 'pg_catalog'
  as $$ select nullif(current_setting('app.current_org_id', true), '')::uuid $$;

create or replace function public.app_current_user_id()
  returns uuid language sql stable set search_path to 'pg_catalog'
  as $$ select nullif(current_setting('app.current_user_id', true), '')::uuid $$;

create or replace function public.app_is_admin()
  returns boolean language sql stable set search_path to 'pg_catalog'
  -- NULLIF handles the empty-string GUC the request-context middleware sets when
  -- is_admin is falsy; COALESCE catches an unset GUC. (coalesce(…,'f') alone threw
  -- "invalid input syntax for type boolean" on '' — the ::boolean ran before coalesce.)
  as $$ select coalesce(nullif(current_setting('app.is_admin', true), '')::boolean, false) $$;

-- The app's runtime role: RLS-subject (no bypass). Login + password + per-table
-- grants are wired when the server connection lands; created now so later
-- migrations' policies/grants can reference it.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'web_app_user') then
    create role web_app_user nologin;
  end if;
end $$;

grant usage on schema public to web_app_user;
