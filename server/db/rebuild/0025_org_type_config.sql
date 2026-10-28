-- 0025_org_type_config.sql
-- Org-type page-settings config (the Settings ▸ Pages store: one row per org_type,
-- the PageConfig stack as JSONB in `payload`).
--
-- This p0021-era table was only ever created by the legacy migrate-schemas.js, so
-- it was MISSING from the rebuild SSOT (server/db/rebuild/*). dev2 happened to have
-- it from its earlier Supabase-MCP provisioning, but a fresh env stood up via run.js
-- (preview, and prod later) never got it. Symptom: page settings LOAD but never SAVE
-- — reads pass org_type_config_read (USING true) while the write hits a missing
-- relation / blocked RLS. Mirrors dev2 exactly: RLS enabled + forced, read-all,
-- write gated on app_is_admin() (the GUC the request-pinned client carries for
-- ballpark members). Idempotent so it is safe on an env that already has the table.

CREATE TABLE IF NOT EXISTS public.org_type_config (
  org_type   text PRIMARY KEY,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

ALTER TABLE public.org_type_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_type_config FORCE  ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_type_config TO web_app_user;

-- Read: any authenticated connection (every org_type consumes its own config).
DROP POLICY IF EXISTS org_type_config_read ON public.org_type_config;
CREATE POLICY org_type_config_read ON public.org_type_config
  FOR SELECT USING (true);

-- Write: platform admins only (app_is_admin() is set on the request-pinned client
-- for ballpark members by requireActiveMembership) — page settings are org_type-wide.
DROP POLICY IF EXISTS org_type_config_write ON public.org_type_config;
CREATE POLICY org_type_config_write ON public.org_type_config
  FOR ALL USING (public.app_is_admin()) WITH CHECK (public.app_is_admin());
