-- migrate-preview-catchup.sql
-- ---------------------------------------------------------------------------
-- Additive schema catch-up for the PREVIEW + MASTER schemas.
--
-- This is the EXACT delta migrate-schemas.js gained between v2.62 (preview's
-- last sync) and v2.173 (its most recent schema change — v2.173 → v2.376 is
-- all UI, no schema). Everything here is `ADD COLUMN / CREATE TABLE / CREATE
-- INDEX IF NOT EXISTS` — 100% additive + idempotent. NO renames, NO drops, NO
-- TRUNCATE. Safe to re-run.
--
-- WHY this instead of re-running migrate-schemas.js: that script is a
-- forward-build-from-zero (build old shape → evolve). Re-running it against the
-- already-evolved `public`/dev schema collides on ancient UNIFY-01-era steps
-- (v2.47) that public long since moved past. Preview does NOT need that replay —
-- it only needs the ~26 additive statements below.
--
-- SCOPE: preview + master only. `public`/dev already has all of this, so it is
-- deliberately NOT in the write set (zero risk to dev data). Nothing
-- destructive can fire — the only TRUNCATE in the system (UNIFY-01, v2.47) is
-- pre-v2.62 and not reachable from here.
--
-- RUN: via the SESSION-mode Supabase pooler (port 5432 — transaction-mode :6543
-- can misbehave on DDL). Take a DB snapshot first (shared prod-adjacent DB).
--
-- STILL CONFIRM SEPARATELY reached preview (both additive if not — apply their
-- own migrations): `flat_total` (server/src/db/migrate-flat-total.js) and the
-- universal audit-columns/guard (database/migration_universal_audit_columns.sql).
-- ---------------------------------------------------------------------------

BEGIN;

DO $catchup$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['preview', 'master'] LOOP

    -- ── Coachmarks (pV2-COACHMARKS-01, v2.173) — admin-editable help bubbles ──
    EXECUTE format($ddl$
      CREATE TABLE IF NOT EXISTS %I.coachmarks (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        page        VARCHAR(100) NOT NULL,
        name        VARCHAR(100) NOT NULL,
        description TEXT,
        tail        VARCHAR(10) DEFAULT 'up',
        is_active   BOOLEAN DEFAULT true,
        sort_order  INTEGER DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )$ddl$, s);
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %s_coachmarks_page_name_key ON %I.coachmarks (page, name)',
      s, s);

    -- ── project_items — BUILDUP-02/03/04 additive fields ──
    EXECUTE format('ALTER TABLE %I.project_items ADD COLUMN IF NOT EXISTS install_description TEXT', s);
    EXECUTE format('ALTER TABLE %I.project_items ADD COLUMN IF NOT EXISTS margin_pct NUMERIC(5,2)', s);
    EXECUTE format(
      'ALTER TABLE %I.project_items ADD COLUMN IF NOT EXISTS option_of_line_id UUID REFERENCES %I.project_items(id) ON DELETE CASCADE',
      s, s);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS ix_project_items_option_of_line ON %I.project_items(option_of_line_id) WHERE option_of_line_id IS NOT NULL',
      s);
    EXECUTE format('ALTER TABLE %I.project_items ADD COLUMN IF NOT EXISTS details TEXT', s);
    EXECUTE format('ALTER TABLE %I.project_items ADD COLUMN IF NOT EXISTS quote_description TEXT', s);

    -- ── projects — Quote document + SOW fields (BUILDUP-04 / quote-pdf arc) ──
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS quote_theme_mode TEXT', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS quote_theme_color TEXT', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS quote_footer TEXT', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS quote_show_created BOOLEAN', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS quote_show_vat_note BOOLEAN', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS quote_show_page_numbers BOOLEAN', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS quote_show_item_desc BOOLEAN', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS quote_show_overview BOOLEAN', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS quote_show_summary BOOLEAN', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS quote_show_ref BOOLEAN', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS quote_show_address BOOLEAN', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS client_company_number TEXT', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS client_address TEXT', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS sow_timeline TEXT', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS sow_payment_terms TEXT', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS sow_special_terms TEXT', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS default_insurance_pct NUMERIC(5,2)', s);
    EXECUTE format('ALTER TABLE %I.projects ADD COLUMN IF NOT EXISTS default_insurance_amount NUMERIC(12,2)', s);

    -- ── orgs — SOW party details + insurance defaults ──
    EXECUTE format('ALTER TABLE %I.orgs ADD COLUMN IF NOT EXISTS terms_pdf_url TEXT', s);
    EXECUTE format('ALTER TABLE %I.orgs ADD COLUMN IF NOT EXISTS company_number TEXT', s);
    EXECUTE format('ALTER TABLE %I.orgs ADD COLUMN IF NOT EXISTS default_insurance_pct NUMERIC(5,2)', s);
    EXECUTE format('ALTER TABLE %I.orgs ADD COLUMN IF NOT EXISTS default_insurance_amount NUMERIC(12,2)', s);

    RAISE NOTICE 'preview-catchup: applied v2.62→v2.173 additive delta to schema %', s;
  END LOOP;
END
$catchup$;

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFY (run after, expect one row per schema with matching counts):
--
--   SELECT table_schema,
--          count(*) FILTER (WHERE table_name='projects'      AND column_name LIKE 'quote_%')   AS quote_cols,
--          count(*) FILTER (WHERE table_name='project_items' AND column_name='option_of_line_id') AS opt_col,
--          to_regclass(table_schema || '.coachmarks') IS NOT NULL AS has_coachmarks
--     FROM information_schema.columns
--    WHERE table_schema IN ('preview','master')
--    GROUP BY table_schema;
--
-- Expect quote_cols = 11, opt_col = 1, has_coachmarks = true for both schemas.
-- ---------------------------------------------------------------------------
