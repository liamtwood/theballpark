-- 0014 — catalogue_extract_job (pV2-STORE-EXTRACT-01). v2dev was missing the
-- extractor's job table (items/categories exist, this did not), so AI Assist's
-- Pull / whole-site Analyse would fail. Canonical shape copied from the main
-- migrate-schemas.js block, single public schema (v2dev is one DB).
--
-- RLS: tenant-isolated like every v2dev content table (FR-00215). Reads/writes
-- are own-org (org_id = app_current_org()) OR admin (app_is_admin()). That admin
-- branch is what the background pull runner uses — it re-establishes an admin GUC
-- context (withAdminContext → is_admin='t') for its progress writes — and what the
-- admin cross-org Pull uses; self-serve own-org Pull matches on app_current_org().

CREATE TABLE IF NOT EXISTS public.catalogue_extract_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'pull',   -- 'pull' | 'analyse' (fan-out discovery)
  status text NOT NULL DEFAULT 'running',
  mode text,
  selected integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_cat_extract_job_org
  ON public.catalogue_extract_job (org_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogue_extract_job TO web_app_user;
GRANT ALL ON public.catalogue_extract_job TO service_role;

ALTER TABLE public.catalogue_extract_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_extract_job FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cat_extract_job_all ON public.catalogue_extract_job;
CREATE POLICY cat_extract_job_all ON public.catalogue_extract_job FOR ALL
  USING      (org_id = app_current_org() OR app_is_admin())
  WITH CHECK (org_id = app_current_org() OR app_is_admin());
