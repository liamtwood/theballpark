-- Rebuild migration 0066 — orgs.handle: a stable, human, URL-safe slug per org so
-- supplier URLs read /suppliers/sk-projections instead of a raw UUID (EP-00021 /
-- pV2-BPIN-01 sibling; items use their bpin, suppliers use this handle). Additive:
-- the server resolvers accept the handle OR the UUID, so existing UUID URLs keep
-- working. (Liam 2026-11-20.)

ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS handle text;

-- Slugify: lowercase, non-alphanumerics → single hyphen, trimmed. NULL when empty.
CREATE OR REPLACE FUNCTION public.slugify_org_name(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(trim(both '-' from regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '-', 'g')), '');
$$;

-- A unique handle for a name: base slug, then -2, -3 … until free (excludes the
-- row's own id so an UPDATE keyed on the same handle is a no-op).
CREATE OR REPLACE FUNCTION public.gen_org_handle(p_name text, p_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE base text; cand text; n int := 1;
BEGIN
  base := coalesce(public.slugify_org_name(p_name), 'supplier');
  cand := base;
  WHILE EXISTS (SELECT 1 FROM public.orgs o
                 WHERE o.handle = cand AND o.deleted_at IS NULL
                   AND (p_id IS NULL OR o.id <> p_id)) LOOP
    n := n + 1; cand := base || '-' || n;
  END LOOP;
  RETURN cand;
END $$;

-- Auto-assign on INSERT when not supplied; handles stay STABLE afterwards (a rename
-- does not repoint the URL — EP-00021 back-compat).
CREATE OR REPLACE FUNCTION public.set_org_handle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.handle IS NULL AND NEW.deleted_at IS NULL THEN
    NEW.handle := public.gen_org_handle(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orgs_set_handle ON public.orgs;
CREATE TRIGGER orgs_set_handle BEFORE INSERT ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.set_org_handle();

-- Backfill existing orgs (dedupe within the batch by name-slug).
WITH ranked AS (
  SELECT id,
         coalesce(public.slugify_org_name(name), 'supplier') AS base,
         row_number() OVER (PARTITION BY coalesce(public.slugify_org_name(name), 'supplier')
                            ORDER BY created_at, id) AS rn
    FROM public.orgs
   WHERE handle IS NULL AND deleted_at IS NULL
)
UPDATE public.orgs o
   SET handle = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || r.rn END
  FROM ranked r WHERE o.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS orgs_handle_unique
  ON public.orgs (handle) WHERE handle IS NOT NULL AND deleted_at IS NULL;

-- Expose handle on the owner-run supplier_directory view (cross-org reads bypass
-- orgs RLS — project_supplier_directory_pattern).
-- handle appended at the END (CREATE OR REPLACE VIEW can only add trailing columns).
CREATE OR REPLACE VIEW public.supplier_directory AS
  SELECT o.id, o.ref, o.name, o.description, o.website, o.logo_url,
         o.cover_image_url, o.image_display, o.images, loc.city, loc.country, o.handle
    FROM public.orgs o
    LEFT JOIN LATERAL address_locality(o.primary_address_id) loc(city, country) ON true
   WHERE o.type = 'supplier'::text AND o.status = 'active'::text AND o.deleted_at IS NULL;
