/**
 * Ballpark — Multi-Schema Setup
 * 
 * Creates 3 additional schemas alongside public (dev):
 *   public   → dev  (already exists, current data)
 *   preview  → QA / stakeholder demos
 *   master   → production
 *   shared   → cross-environment: backlog, bug tracking, feature flags
 * 
 * Run once against the Railway PostgreSQL database.
 * Safe to re-run — all CREATE statements use IF NOT EXISTS.
 * 
 * Usage:
 *   node server/src/db/migrate-schemas.js
 */

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const migrate = async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    console.log('Creating schemas...');

    // ── 1. Create schemas ────────────────────────────────────────────────
    // marketing  → public welcome page + guestlist signups (single, not per-env)
    // internal   → ops tables (project_log, etc.) — single, not per-env
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS preview;
      CREATE SCHEMA IF NOT EXISTS master;
      CREATE SCHEMA IF NOT EXISTS shared;
      CREATE SCHEMA IF NOT EXISTS marketing;
      CREATE SCHEMA IF NOT EXISTS internal;
    `);
    console.log('  Schemas created: preview, master, shared, marketing, internal');

    // ── 2. Create all tables in preview schema ───────────────────────────
    console.log('  Creating preview schema tables...');
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Statuses
      CREATE TABLE IF NOT EXISTS preview.statuses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        entity_type VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        label VARCHAR(100),
        color VARCHAR(20),
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Orgs
      CREATE TABLE IF NOT EXISTS preview.orgs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL CHECK (type IN ('agency', 'supplier')),
        address TEXT,
        city VARCHAR(100),
        country VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(255),
        website VARCHAR(255),
        logo_url TEXT,
        cover_image_url TEXT,
        image_display VARCHAR(10) DEFAULT 'cover',
        subscription_tier VARCHAR(20) DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'studio', 'agency')),
        balls_balance INTEGER DEFAULT 0,
        balls_monthly_allowance INTEGER DEFAULT 0,
        default_vat_pct NUMERIC(5,2) DEFAULT 20,
        vat_registered BOOLEAN DEFAULT false,
        vat_number VARCHAR(50),
        default_margin_pct NUMERIC(5,2),
        default_contingency_pct NUMERIC(5,2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Users
      CREATE TABLE IF NOT EXISTS preview.users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES preview.orgs(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Clients
      CREATE TABLE IF NOT EXISTS preview.clients (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES preview.orgs(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        contact_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Categories
      CREATE TABLE IF NOT EXISTS preview.categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        sort_order INTEGER DEFAULT 0,
        cover_image_url TEXT,
        card_color VARCHAR(20),
        tags TEXT[],
        enabled BOOLEAN DEFAULT true,
        namespace VARCHAR(20) DEFAULT 'catalogue',
        parent_id UUID REFERENCES preview.categories(id),
        tagline VARCHAR(255),
        model VARCHAR(1) DEFAULT 'A',
        icon_name VARCHAR(50),
        icon_color VARCHAR(30) DEFAULT 'var(--theme-bg)',
        object_type VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Items
      CREATE TABLE IF NOT EXISTS preview.items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES preview.orgs(id),
        category_id UUID REFERENCES preview.categories(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        unit VARCHAR(50),
        time_unit VARCHAR(50),
        derived_from_id UUID REFERENCES preview.items(id),
        parent_item_id UUID REFERENCES preview.items(id),
        attributes JSONB DEFAULT '{}',
        base_price NUMERIC(12,2),
        min_price NUMERIC(12,2),
        max_price NUMERIC(12,2),
        lead_time_days INTEGER,
        coverage_area NUMERIC(10,2),
        tier VARCHAR(20) DEFAULT 'mid' CHECK (tier IN ('basic', 'mid', 'premium')),
        tags TEXT[] DEFAULT '{}',
        image_url VARCHAR,
        external_url VARCHAR,
        image_display VARCHAR(10) DEFAULT 'cover',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Projects
      CREATE TABLE IF NOT EXISTS preview.projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES preview.orgs(id),
        client_id UUID REFERENCES preview.clients(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        event_name VARCHAR(255),
        event_date VARCHAR(255),
        venue_name VARCHAR(255),
        venue_city VARCHAR(255),
        venue_address TEXT,
        guest_count INTEGER,
        stand_size VARCHAR(20),
        stand_width_m NUMERIC(6,2),
        stand_depth_m NUMERIC(6,2),
        stand_type VARCHAR(20),
        project_notes TEXT,
        raw_brief_text TEXT,
        parsed_brief_json JSONB,
        ai_hints TEXT,
        missing_fields TEXT,
        project_budget NUMERIC(12,2),
        share_budget_with_suppliers BOOLEAN DEFAULT false,
        default_margin_pct NUMERIC(5,2),
        default_contingency_pct NUMERIC(5,2),
        default_vat_pct NUMERIC(5,2) DEFAULT 20,
        currency VARCHAR(10) DEFAULT 'GBP',
        total_ballpark_cost NUMERIC(12,2) DEFAULT 0,
        total_base_cost NUMERIC(12,2) DEFAULT 0,
        total_client_cost NUMERIC(12,2) DEFAULT 0,
        tier VARCHAR(20),
        status_id UUID REFERENCES preview.statuses(id),
        cover_image_url TEXT,
        client_logo_url TEXT,
        card_color VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Project Categories
      CREATE TABLE IF NOT EXISTS preview.project_categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES preview.projects(id) ON DELETE CASCADE,
        category_id UUID REFERENCES preview.categories(id),
        name VARCHAR(255),
        description TEXT,
        requirement_brief TEXT,
        requirement_detail TEXT,
        ballpark_cost NUMERIC(12,2) DEFAULT 0,
        base_cost NUMERIC(12,2) DEFAULT 0,
        contingency_pct NUMERIC(5,2) DEFAULT 0,
        contingency_amount NUMERIC(12,2) DEFAULT 0,
        subtotal NUMERIC(12,2) DEFAULT 0,
        margin_pct NUMERIC(5,2) DEFAULT 0,
        margin_amount NUMERIC(12,2) DEFAULT 0,
        net_cost NUMERIC(12,2) DEFAULT 0,
        vat_pct NUMERIC(5,2) DEFAULT 20,
        vat_amount NUMERIC(12,2) DEFAULT 0,
        client_cost NUMERIC(12,2) DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        status_id UUID REFERENCES preview.statuses(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Estimates
      CREATE TABLE IF NOT EXISTS preview.estimates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES preview.projects(id) ON DELETE CASCADE,
        org_id UUID REFERENCES preview.orgs(id),
        name VARCHAR(255),
        version INTEGER DEFAULT 1,
        total_value NUMERIC(12,2) DEFAULT 0,
        balls_cost INTEGER DEFAULT 0,
        status_id UUID REFERENCES preview.statuses(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Estimate Items
      -- NOTE: this CREATE block reflects the v1.13 production schema:
      --   - unit_price renamed to offer_price (deal-specific proposal
      --     editable until approved_at locks it).
      --   - Added budget_price (agency expectation), ballpark_snapshot
      --     (catalogue anchor at request time), inspired_by_item_id (FK
      --     to items, SET NULL on item delete), approved_at + approved_by
      --     (deal lock), duration (time dimension), unit + time_unit
      --     (inherited from item on creation, mutable on the deal), and
      --     attributes JSONB.
      --   - total_price = quantity x duration x offer_price.
      -- The earlier unit and is_active columns were dropped in dev
      -- before v1.13 -- see the idempotent ALTER block below for the
      -- reconciliation applied to older databases.
      CREATE TABLE IF NOT EXISTS preview.estimate_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        estimate_id UUID REFERENCES preview.estimates(id) ON DELETE CASCADE,
        project_category_id UUID REFERENCES preview.project_categories(id),
        item_id UUID REFERENCES preview.items(id),
        name VARCHAR(255),
        description TEXT,
        quantity NUMERIC(10,2) DEFAULT 1,
        offer_price NUMERIC(12,2) DEFAULT 0,
        budget_price NUMERIC(12,2),
        ballpark_snapshot NUMERIC(12,2),
        inspired_by_item_id UUID REFERENCES preview.items(id) ON DELETE SET NULL,
        approved_at TIMESTAMPTZ,
        approved_by UUID,
        duration NUMERIC,
        unit VARCHAR(50),
        time_unit VARCHAR(50),
        attributes JSONB DEFAULT '{}',
        total_price NUMERIC(12,2) DEFAULT 0,
        supplier_org_id UUID REFERENCES preview.orgs(id),
        shortlisted BOOLEAN DEFAULT false,
        status_id UUID REFERENCES preview.statuses(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Project Items — the supplier-facing "cart". Lightweight selection
      -- layer that lives BEFORE pricing exists. selection_type='selected'
      -- = tick (committed), 'liked' = heart (interested). Upsert via the
      -- unique index, so flipping between liked/selected mutates the
      -- existing row rather than creating duplicates.
      CREATE TABLE IF NOT EXISTS preview.project_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES preview.projects(id) ON DELETE CASCADE,
        item_id UUID NOT NULL REFERENCES preview.items(id) ON DELETE CASCADE,
        project_category_id UUID REFERENCES preview.project_categories(id) ON DELETE SET NULL,
        selection_type VARCHAR(20) DEFAULT 'selected'
          CHECK (selection_type IN ('selected', 'liked')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_project_items_project_item
        ON preview.project_items(project_id, item_id);

      -- Messages
      CREATE TABLE IF NOT EXISTS preview.messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES preview.projects(id) ON DELETE CASCADE,
        user_id UUID REFERENCES preview.users(id),
        supplier_org_id UUID REFERENCES preview.orgs(id),
        estimate_item_id UUID REFERENCES preview.estimate_items(id),
        subject VARCHAR(255),
        body TEXT,
        direction VARCHAR(20) CHECK (direction IN ('inbound', 'outbound')),
        status_id UUID REFERENCES preview.statuses(id),
        sender_name VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Balls Transactions
      CREATE TABLE IF NOT EXISTS preview.balls_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES preview.orgs(id),
        project_id UUID REFERENCES preview.projects(id),
        estimate_id UUID REFERENCES preview.estimates(id),
        supplier_org_id UUID REFERENCES preview.orgs(id),
        user_id UUID REFERENCES preview.users(id),
        amount INTEGER NOT NULL,
        direction VARCHAR(20) NOT NULL CHECK (direction IN ('credit', 'debit')),
        reason VARCHAR(20) NOT NULL CHECK (reason IN ('subscription', 'spend', 'referral', 'refund', 'bonus')),
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID
      );

      -- Favourites — polymorphic per-org saved items / suppliers.
      -- ref_id is intentionally NOT a hard FK because it points to
      -- different tables by type ('supplier' → orgs.id, 'item' →
      -- items.id). Toggled via is_active rather than deleted so a
      -- re-heart restores the original row's created_at.
      -- Table already exists in dev (created pre-migration-tracking);
      -- the IF NOT EXISTS makes this idempotent on every env.
      CREATE TABLE IF NOT EXISTS preview.favourites (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES preview.orgs(id),
        type VARCHAR(20) NOT NULL CHECK (type IN ('supplier', 'item')),
        ref_id UUID NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS favourites_org_type_idx_preview
        ON preview.favourites (org_id, type) WHERE is_active = true;
    `);
    console.log('  Preview schema tables created.');

    // ── 3. Create master schema (same structure as preview) ──────────────
    console.log('  Creating master schema tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS master.statuses           (LIKE preview.statuses           INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.orgs               (LIKE preview.orgs               INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.users              (LIKE preview.users              INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.clients            (LIKE preview.clients            INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.categories         (LIKE preview.categories         INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.items              (LIKE preview.items              INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.projects           (LIKE preview.projects           INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.project_categories (LIKE preview.project_categories INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.estimates          (LIKE preview.estimates          INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.estimate_items     (LIKE preview.estimate_items     INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.project_items      (LIKE preview.project_items      INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.messages           (LIKE preview.messages           INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.balls_transactions (LIKE preview.balls_transactions INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.favourites         (LIKE preview.favourites         INCLUDING ALL);
    `);
    console.log('  Master schema tables created.');

    // ── 3b. Idempotent column additions ──────────────────────────────────
    // items.time_unit lets a row store a rental cadence (e.g. unit='pallet',
    // time_unit='month' → "per pallet / month").
    // items.derived_from_id / parent_item_id support the lineage drawer
    // section — "born from" + "variant of a product family" — both FK self.
    // items.attributes is a JSONB bag for future per-item metadata.
    // Applied to all three env schemas so existing tables pick changes up.
    await client.query(`
      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS time_unit       VARCHAR(50);
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS time_unit       VARCHAR(50);
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS time_unit       VARCHAR(50);

      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS derived_from_id UUID REFERENCES public.items(id);
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS derived_from_id UUID REFERENCES preview.items(id);
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS derived_from_id UUID REFERENCES master.items(id);

      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS parent_item_id  UUID REFERENCES public.items(id);
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS parent_item_id  UUID REFERENCES preview.items(id);
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS parent_item_id  UUID REFERENCES master.items(id);

      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS attributes      JSONB DEFAULT '{}';
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS attributes      JSONB DEFAULT '{}';
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS attributes      JSONB DEFAULT '{}';

      -- v1.17: items.images JSONB array — up to 8 images per item, ordered
      -- by sort_order, one flagged is_hero=true. Drives the new Images tab
      -- in the item drawer (8-slot grid). Backward compat: image_url is
      -- still kept in sync with images[0].url on every save so card and
      -- detail surfaces keep working until they migrate to images[].
      --   shape: [{ url, sort_order, is_hero }]
      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS images          JSONB DEFAULT '[]';
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS images          JSONB DEFAULT '[]';
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS images          JSONB DEFAULT '[]';

      -- pV2-STORE-01 (Liam): drop the legacy per-org UNIQUE(org_id, name) on
      -- items. The item identity is the UUID id (items_pkey) — name must NOT be
      -- a uniqueness key. It was a table CONSTRAINT (index-backed), and covered
      -- soft-deleted rows too, so a trashed item still reserved its name and
      -- blocked re-create/duplicate.
      ALTER TABLE public.items  DROP CONSTRAINT IF EXISTS items_org_name_unique_public;
      ALTER TABLE preview.items DROP CONSTRAINT IF EXISTS items_org_name_unique_preview;
      ALTER TABLE master.items  DROP CONSTRAINT IF EXISTS items_org_name_unique_master;

      -- pV2-STORE-01 (Liam): item pricing/detail model. Rename max_price →
      -- install_cost (the installation cost), drop min_price, add currency
      -- (defaults to the supplier's org currency on insert — see item.service),
      -- install_description (UI label "Included Services") and location_coverage
      -- (free text). The rename is guarded so the migration stays idempotent.
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='items' AND column_name='max_price')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='items' AND column_name='install_cost')
        THEN ALTER TABLE public.items RENAME COLUMN max_price TO install_cost; END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='preview' AND table_name='items' AND column_name='max_price')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='preview' AND table_name='items' AND column_name='install_cost')
        THEN ALTER TABLE preview.items RENAME COLUMN max_price TO install_cost; END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='master' AND table_name='items' AND column_name='max_price')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='master' AND table_name='items' AND column_name='install_cost')
        THEN ALTER TABLE master.items RENAME COLUMN max_price TO install_cost; END IF;
      END $$;

      ALTER TABLE public.items  DROP COLUMN IF EXISTS min_price;
      ALTER TABLE preview.items DROP COLUMN IF EXISTS min_price;
      ALTER TABLE master.items  DROP COLUMN IF EXISTS min_price;

      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS currency            VARCHAR(10);
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS currency            VARCHAR(10);
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS currency            VARCHAR(10);

      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS install_description TEXT;
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS install_description TEXT;
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS install_description TEXT;

      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS location_coverage   TEXT;
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS location_coverage   TEXT;
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS location_coverage   TEXT;

      -- pV2-CART-01: how install_cost applies. NULL = per_item (× qty; the
      -- prior behaviour), 'per_order' = one-off flat, 'percentage' = % of the
      -- line's base total. Lets the supplier control the install basis.
      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS install_unit VARCHAR(20);
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS install_unit VARCHAR(20);
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS install_unit VARCHAR(20);

      -- v1.29: projects.currency — ISO-4217 code (drives Event drawer
      -- Currency dropdown via shared.codelists list_name='currency').
      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS currency      VARCHAR(10) DEFAULT 'GBP';
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS currency      VARCHAR(10) DEFAULT 'GBP';
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS currency      VARCHAR(10) DEFAULT 'GBP';

      -- v2.59 (pV2-PROJECTS): projects.client_name — free-text client label
      -- (v2 does not use the legacy clients FK; the client was baked into the
      -- project name). Type-ahead in the About Project form self-populates
      -- suggestions from the org's distinct past client_name values.
      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS client_name TEXT;
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS client_name TEXT;
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS client_name TEXT;

      -- v2.22a (pV2-PROJECTS-01): projects.status — the project_status
      -- CODELIST code (draft/active/completed/archived). Dual-model with
      -- the legacy status_id FK (kept for v1 compat until pV2-11): the v2
      -- ProjectsService dual-writes both. statuses.name for
      -- entity_type='project' maps 1:1 to the codelist codes, so the
      -- backfill is exact; NULL status_id → the codelist default 'draft'.
      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS status TEXT;
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS status TEXT;
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS status TEXT;

      UPDATE public.projects  p SET status = s.name FROM public.statuses  s WHERE p.status_id = s.id AND s.entity_type = 'project' AND p.status IS NULL;
      UPDATE preview.projects p SET status = s.name FROM preview.statuses s WHERE p.status_id = s.id AND s.entity_type = 'project' AND p.status IS NULL;
      UPDATE master.projects  p SET status = s.name FROM master.statuses  s WHERE p.status_id = s.id AND s.entity_type = 'project' AND p.status IS NULL;

      UPDATE public.projects  SET status = 'draft' WHERE status IS NULL;
      UPDATE preview.projects SET status = 'draft' WHERE status IS NULL;
      UPDATE master.projects  SET status = 'draft' WHERE status IS NULL;

      -- Wire the project_status codelist consumer pointer now that the
      -- column exists (was NULL at CODELISTS-01 — the column didn't exist
      -- yet). Drives the deactivation in-use gate in /settings/codelists.
      UPDATE shared.reference_codelists SET consumer_table = 'projects', consumer_column = 'status' WHERE list_name = 'project_status';

      -- Each project carries its own financial defaults (margin/contingency/
      -- VAT), seeded from the org's Profile defaults. AI-created projects
      -- landed NULL (create didn't seed them) → the Estimate fell back to the
      -- house rates instead of the org's. Backfill any NULL from the org,
      -- falling back to the v1 house rates (20/10/20). Only touches NULL rows,
      -- so per-project overrides + already-seeded projects are preserved.
      UPDATE public.projects  p SET
        default_margin_pct      = COALESCE(p.default_margin_pct,      o.default_margin_pct,      20),
        default_contingency_pct = COALESCE(p.default_contingency_pct, o.default_contingency_pct, 10),
        default_vat_pct         = COALESCE(p.default_vat_pct,         o.default_vat_pct,         20)
        FROM public.orgs o WHERE o.id = p.org_id
         AND (p.default_margin_pct IS NULL OR p.default_contingency_pct IS NULL OR p.default_vat_pct IS NULL);
      UPDATE preview.projects p SET
        default_margin_pct      = COALESCE(p.default_margin_pct,      o.default_margin_pct,      20),
        default_contingency_pct = COALESCE(p.default_contingency_pct, o.default_contingency_pct, 10),
        default_vat_pct         = COALESCE(p.default_vat_pct,         o.default_vat_pct,         20)
        FROM preview.orgs o WHERE o.id = p.org_id
         AND (p.default_margin_pct IS NULL OR p.default_contingency_pct IS NULL OR p.default_vat_pct IS NULL);
      UPDATE master.projects  p SET
        default_margin_pct      = COALESCE(p.default_margin_pct,      o.default_margin_pct,      20),
        default_contingency_pct = COALESCE(p.default_contingency_pct, o.default_contingency_pct, 10),
        default_vat_pct         = COALESCE(p.default_vat_pct,         o.default_vat_pct,         20)
        FROM master.orgs o WHERE o.id = p.org_id
         AND (p.default_margin_pct IS NULL OR p.default_contingency_pct IS NULL OR p.default_vat_pct IS NULL);

      -- estimate_items drift reconciliation. The legacy CREATE block had
      -- unit VARCHAR(50) and is_active BOOLEAN columns that were dropped
      -- in dev out-of-band; shortlisted + status_id were added at the
      -- same time. These ALTERs converge any older DB to the new shape
      -- without losing data (the dropped columns held no application data).
      ALTER TABLE public.estimate_items  DROP COLUMN IF EXISTS unit;
      ALTER TABLE preview.estimate_items DROP COLUMN IF EXISTS unit;
      ALTER TABLE master.estimate_items  DROP COLUMN IF EXISTS unit;

      ALTER TABLE public.estimate_items  DROP COLUMN IF EXISTS is_active;
      ALTER TABLE preview.estimate_items DROP COLUMN IF EXISTS is_active;
      ALTER TABLE master.estimate_items  DROP COLUMN IF EXISTS is_active;

      ALTER TABLE public.estimate_items  ADD COLUMN IF NOT EXISTS shortlisted BOOLEAN DEFAULT false;
      ALTER TABLE preview.estimate_items ADD COLUMN IF NOT EXISTS shortlisted BOOLEAN DEFAULT false;
      ALTER TABLE master.estimate_items  ADD COLUMN IF NOT EXISTS shortlisted BOOLEAN DEFAULT false;

      ALTER TABLE public.estimate_items  ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES public.statuses(id);
      ALTER TABLE preview.estimate_items ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES preview.statuses(id);
      ALTER TABLE master.estimate_items  ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES master.statuses(id);

      -- v1.13: estimate_items rename + 9 new columns. RENAME COLUMN has no
      -- IF NOT EXISTS form, so guard it inside DO blocks that check the
      -- information_schema first. Idempotent on re-runs.
      DO $mig$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='estimate_items' AND column_name='unit_price') THEN
          EXECUTE 'ALTER TABLE public.estimate_items RENAME COLUMN unit_price TO offer_price';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='preview' AND table_name='estimate_items' AND column_name='unit_price') THEN
          EXECUTE 'ALTER TABLE preview.estimate_items RENAME COLUMN unit_price TO offer_price';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='master' AND table_name='estimate_items' AND column_name='unit_price') THEN
          EXECUTE 'ALTER TABLE master.estimate_items RENAME COLUMN unit_price TO offer_price';
        END IF;
      END $mig$;

      ALTER TABLE public.estimate_items  ADD COLUMN IF NOT EXISTS budget_price        NUMERIC(12,2);
      ALTER TABLE preview.estimate_items ADD COLUMN IF NOT EXISTS budget_price        NUMERIC(12,2);
      ALTER TABLE master.estimate_items  ADD COLUMN IF NOT EXISTS budget_price        NUMERIC(12,2);

      ALTER TABLE public.estimate_items  ADD COLUMN IF NOT EXISTS ballpark_snapshot   NUMERIC(12,2);
      ALTER TABLE preview.estimate_items ADD COLUMN IF NOT EXISTS ballpark_snapshot   NUMERIC(12,2);
      ALTER TABLE master.estimate_items  ADD COLUMN IF NOT EXISTS ballpark_snapshot   NUMERIC(12,2);

      ALTER TABLE public.estimate_items  ADD COLUMN IF NOT EXISTS inspired_by_item_id UUID REFERENCES public.items(id)  ON DELETE SET NULL;
      ALTER TABLE preview.estimate_items ADD COLUMN IF NOT EXISTS inspired_by_item_id UUID REFERENCES preview.items(id) ON DELETE SET NULL;
      ALTER TABLE master.estimate_items  ADD COLUMN IF NOT EXISTS inspired_by_item_id UUID REFERENCES master.items(id)  ON DELETE SET NULL;

      ALTER TABLE public.estimate_items  ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ;
      ALTER TABLE preview.estimate_items ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ;
      ALTER TABLE master.estimate_items  ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ;

      ALTER TABLE public.estimate_items  ADD COLUMN IF NOT EXISTS approved_by         UUID;
      ALTER TABLE preview.estimate_items ADD COLUMN IF NOT EXISTS approved_by         UUID;
      ALTER TABLE master.estimate_items  ADD COLUMN IF NOT EXISTS approved_by         UUID;

      ALTER TABLE public.estimate_items  ADD COLUMN IF NOT EXISTS duration            NUMERIC;
      ALTER TABLE preview.estimate_items ADD COLUMN IF NOT EXISTS duration            NUMERIC;
      ALTER TABLE master.estimate_items  ADD COLUMN IF NOT EXISTS duration            NUMERIC;

      ALTER TABLE public.estimate_items  ADD COLUMN IF NOT EXISTS unit                VARCHAR(50);
      ALTER TABLE preview.estimate_items ADD COLUMN IF NOT EXISTS unit                VARCHAR(50);
      ALTER TABLE master.estimate_items  ADD COLUMN IF NOT EXISTS unit                VARCHAR(50);

      ALTER TABLE public.estimate_items  ADD COLUMN IF NOT EXISTS time_unit           VARCHAR(50);
      ALTER TABLE preview.estimate_items ADD COLUMN IF NOT EXISTS time_unit           VARCHAR(50);
      ALTER TABLE master.estimate_items  ADD COLUMN IF NOT EXISTS time_unit           VARCHAR(50);

      ALTER TABLE public.estimate_items  ADD COLUMN IF NOT EXISTS attributes          JSONB DEFAULT '{}';
      ALTER TABLE preview.estimate_items ADD COLUMN IF NOT EXISTS attributes          JSONB DEFAULT '{}';
      ALTER TABLE master.estimate_items  ADD COLUMN IF NOT EXISTS attributes          JSONB DEFAULT '{}';

      -- v1.13: project_items new table (cart). CREATE TABLE IF NOT EXISTS
      -- so re-runs are no-ops on the env that already created it via the
      -- CREATE blocks above; this catches any env that pre-dates v1.13.
      CREATE TABLE IF NOT EXISTS public.project_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
        item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
        project_category_id UUID REFERENCES public.project_categories(id) ON DELETE SET NULL,
        selection_type VARCHAR(20) DEFAULT 'selected'
          CHECK (selection_type IN ('selected', 'liked')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_project_items_project_item
        ON public.project_items(project_id, item_id);

      -- ── pV2-QUANTITY-01 ──────────────────────────────────────────────
      -- Quantity becomes a first-class field on the cart/quote line. A v1-era
      -- quantity numeric NULL column pre-exists in some envs, so we ADD it
      -- where missing, backfill NULL/<1 to 1, then normalise to INT NOT NULL
      -- DEFAULT 1 (no NULLs, no fractional quantities — the spec guarantee).
      ALTER TABLE public.project_items  ADD COLUMN IF NOT EXISTS quantity INT;
      ALTER TABLE preview.project_items ADD COLUMN IF NOT EXISTS quantity INT;
      ALTER TABLE master.project_items  ADD COLUMN IF NOT EXISTS quantity INT;

      UPDATE public.project_items  SET quantity = 1 WHERE quantity IS NULL OR quantity < 1;
      UPDATE preview.project_items SET quantity = 1 WHERE quantity IS NULL OR quantity < 1;
      UPDATE master.project_items  SET quantity = 1 WHERE quantity IS NULL OR quantity < 1;

      ALTER TABLE public.project_items  ALTER COLUMN quantity TYPE INT USING ROUND(quantity)::int, ALTER COLUMN quantity SET DEFAULT 1, ALTER COLUMN quantity SET NOT NULL;
      ALTER TABLE preview.project_items ALTER COLUMN quantity TYPE INT USING ROUND(quantity)::int, ALTER COLUMN quantity SET DEFAULT 1, ALTER COLUMN quantity SET NOT NULL;
      ALTER TABLE master.project_items  ALTER COLUMN quantity TYPE INT USING ROUND(quantity)::int, ALTER COLUMN quantity SET DEFAULT 1, ALTER COLUMN quantity SET NOT NULL;

      -- pV2-QUANTITY-01c: snapshot the item's category onto the quote line.
      -- We snapshot the category_id ONLY (no FK — a snapshot must survive
      -- independent of the catalogue) and live-join categories for the
      -- name/visuals. This keeps a line in the category it was added under if
      -- the item is later RECATEGORISED, while a category RENAME still
      -- propagates (live name). Relies on categories being soft-delete-only.
      ALTER TABLE public.project_items  ADD COLUMN IF NOT EXISTS category_id UUID;
      ALTER TABLE preview.project_items ADD COLUMN IF NOT EXISTS category_id UUID;
      ALTER TABLE master.project_items  ADD COLUMN IF NOT EXISTS category_id UUID;

      UPDATE public.project_items  pi SET category_id = i.category_id FROM public.items  i WHERE i.id = pi.item_id AND pi.category_id IS NULL;
      UPDATE preview.project_items pi SET category_id = i.category_id FROM preview.items i WHERE i.id = pi.item_id AND pi.category_id IS NULL;
      UPDATE master.project_items  pi SET category_id = i.category_id FROM master.items  i WHERE i.id = pi.item_id AND pi.category_id IS NULL;

      -- Smart auto-fill mapping on the units codelist: a unit can point at a
      -- project field so add-to-cart seeds a sensible default quantity
      -- (per-head → guest_count, per-day → duration_days). Nullable — most
      -- units (flat / dimensional) have no mapping and default to 1.
      ALTER TABLE shared.reference_codelist_values ADD COLUMN IF NOT EXISTS auto_fill_field TEXT;

      -- pV2-QUANTITY-01b: per-item pack size. How many guests ONE unit serves
      -- (a platter that "feeds 10", a "coffee for 50"). Nullable — most items
      -- have no pack size. On add-to-quote, qty = ceil(guest_count / serves)
      -- when set, so a platter serving 10 lands at 25 for a 250-guest event.
      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS serves INT;
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS serves INT;
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS serves INT;

      -- Rocket Food catering unit/serves corrections (Liam, 2026-06-14).
      -- Idempotent + safe: the org subselect is NULL where Rocket Food is
      -- absent (preview/master), so those UPDATEs match nothing.
      UPDATE public.items  SET unit = 'head' WHERE org_id = (SELECT id FROM public.orgs  WHERE name = 'Rocket Food') AND name IN ('Sit-Down Dinner (3 course)', 'Soda with Lunch', 'Soft Drinks the whole day', 'Wine & Beer with Dinner');
      UPDATE preview.items SET unit = 'head' WHERE org_id = (SELECT id FROM preview.orgs WHERE name = 'Rocket Food') AND name IN ('Sit-Down Dinner (3 course)', 'Soda with Lunch', 'Soft Drinks the whole day', 'Wine & Beer with Dinner');
      UPDATE master.items  SET unit = 'head' WHERE org_id = (SELECT id FROM master.orgs  WHERE name = 'Rocket Food') AND name IN ('Sit-Down Dinner (3 course)', 'Soda with Lunch', 'Soft Drinks the whole day', 'Wine & Beer with Dinner');

      UPDATE public.items  SET unit = 'each', serves = 50 WHERE org_id = (SELECT id FROM public.orgs  WHERE name = 'Rocket Food') AND name = 'Breakfast & Coffee (50 guests)';
      UPDATE preview.items SET unit = 'each', serves = 50 WHERE org_id = (SELECT id FROM preview.orgs WHERE name = 'Rocket Food') AND name = 'Breakfast & Coffee (50 guests)';
      UPDATE master.items  SET unit = 'each', serves = 50 WHERE org_id = (SELECT id FROM master.orgs  WHERE name = 'Rocket Food') AND name = 'Breakfast & Coffee (50 guests)';

      UPDATE public.items  SET serves = 10 WHERE org_id = (SELECT id FROM public.orgs  WHERE name = 'Rocket Food') AND name = 'Working Lunch Platters';
      UPDATE preview.items SET serves = 10 WHERE org_id = (SELECT id FROM preview.orgs WHERE name = 'Rocket Food') AND name = 'Working Lunch Platters';
      UPDATE master.items  SET serves = 10 WHERE org_id = (SELECT id FROM master.orgs  WHERE name = 'Rocket Food') AND name = 'Working Lunch Platters';

      -- Units consolidation (Liam 2026-06-14, single-list model). The dead
      -- item_time_unit list/column (150/152 NULL) is retired; its live codes
      -- already leaked into items.unit (event 41, day 25), so we adopt
      -- items.unit as the single source of truth and fold day/event/hour in.
      -- Codelist rule: deactivate + merge, never DROP.
      INSERT INTO shared.reference_codelist_values
        (list_name, code, label, sort_order, is_active, is_system, is_default, meta, auto_fill_field)
      VALUES
        ('item_unit', 'day',   'Day',   2, true, true, false, '{}'::jsonb, 'duration_days'),
        ('item_unit', 'event', 'Event', 3, true, true, false, '{}'::jsonb, NULL),
        ('item_unit', 'hour',  'Hour',  4, true, true, false, '{}'::jsonb, NULL)
      ON CONFLICT (list_name, code) DO NOTHING;

      -- Keeper set: head, day, event, hour, each, sqm — give them a clean
      -- sort order + the auto_fill mapping. (Re-runnable: same values.)
      UPDATE shared.reference_codelist_values SET sort_order = 1, auto_fill_field = 'guest_count'  WHERE list_name = 'item_unit' AND code = 'head';
      UPDATE shared.reference_codelist_values SET sort_order = 2, auto_fill_field = 'duration_days' WHERE list_name = 'item_unit' AND code = 'day';
      UPDATE shared.reference_codelist_values SET sort_order = 3, auto_fill_field = NULL            WHERE list_name = 'item_unit' AND code = 'event';
      UPDATE shared.reference_codelist_values SET sort_order = 4, auto_fill_field = NULL            WHERE list_name = 'item_unit' AND code = 'hour';
      UPDATE shared.reference_codelist_values SET sort_order = 5, auto_fill_field = NULL            WHERE list_name = 'item_unit' AND code = 'each';
      UPDATE shared.reference_codelist_values SET sort_order = 6, auto_fill_field = NULL            WHERE list_name = 'item_unit' AND code = 'sqm';

      -- Deactivate the merged-away long tail (countable → each, project →
      -- event) and the deactivated dimensionals (sqft/linear_m/cbm). Values
      -- stay in the table (reactivate if a real item resurfaces).
      UPDATE shared.reference_codelist_values SET is_active = false
       WHERE list_name = 'item_unit'
         AND code IN ('unit','cover','sqft','linear_m','package','set','project','item','pair','panel','platter','letter','load','pallet','cbm','table');

      -- Retire the item_time_unit parent (single-list model). Its values are
      -- left intact; an inactive parent hides the list from the admin UI.
      UPDATE shared.reference_codelists SET is_active = false WHERE list_name = 'item_time_unit';

      -- Re-point affected items.unit rows to the canonical code (one pass per
      -- merge target). After this every active item sits on head/day/event/
      -- each/sqm — all active item_unit codes. Idempotent: merged codes no
      -- longer exist on items after the first run.
      UPDATE public.items  SET unit = 'each' WHERE unit IS NULL OR unit IN ('unit','cover','sqft','linear_m','package','set','item','pair','panel','platter','letter','load','pallet','cbm','table');
      UPDATE preview.items SET unit = 'each' WHERE unit IS NULL OR unit IN ('unit','cover','sqft','linear_m','package','set','item','pair','panel','platter','letter','load','pallet','cbm','table');
      UPDATE master.items  SET unit = 'each' WHERE unit IS NULL OR unit IN ('unit','cover','sqft','linear_m','package','set','item','pair','panel','platter','letter','load','pallet','cbm','table');

      UPDATE public.items  SET unit = 'event' WHERE unit = 'project';
      UPDATE preview.items SET unit = 'event' WHERE unit = 'project';
      UPDATE master.items  SET unit = 'event' WHERE unit = 'project';
      -- ── end pV2-QUANTITY-01 ──────────────────────────────────────────

      -- v1.13: orgs.auto_publish_items. Controls whether approved
      -- estimate items auto-publish back to the supplier catalogue.
      ALTER TABLE public.orgs  ADD COLUMN IF NOT EXISTS auto_publish_items BOOLEAN DEFAULT true;
      ALTER TABLE preview.orgs ADD COLUMN IF NOT EXISTS auto_publish_items BOOLEAN DEFAULT true;
      ALTER TABLE master.orgs  ADD COLUMN IF NOT EXISTS auto_publish_items BOOLEAN DEFAULT true;

      -- v1.39: org project-ref prefix + counter, and the resulting
      -- auto-generated project ref column. The create-project modal
      -- now stamps every new project with "{prefix}-{counter:03}"
      -- (e.g. WA-014). Counter is incremented atomically server-side
      -- on every successful project create. ref_prefix defaults to
      -- 'BP' if the org owner hasn't customised it in Settings.
      ALTER TABLE public.orgs  ADD COLUMN IF NOT EXISTS ref_prefix    VARCHAR(10) DEFAULT 'BP';
      ALTER TABLE preview.orgs ADD COLUMN IF NOT EXISTS ref_prefix    VARCHAR(10) DEFAULT 'BP';
      ALTER TABLE master.orgs  ADD COLUMN IF NOT EXISTS ref_prefix    VARCHAR(10) DEFAULT 'BP';

      ALTER TABLE public.orgs  ADD COLUMN IF NOT EXISTS ref_counter   INTEGER DEFAULT 0;
      ALTER TABLE preview.orgs ADD COLUMN IF NOT EXISTS ref_counter   INTEGER DEFAULT 0;
      ALTER TABLE master.orgs  ADD COLUMN IF NOT EXISTS ref_counter   INTEGER DEFAULT 0;

      -- v2.19a (pV2-CODELISTS-02): the org's default currency — Profile
      -- "Financial defaults" select, fed by the currency codelist. ISO
      -- 4217 alpha-3 code; GBP matches the platform's v1-era assumption.
      ALTER TABLE public.orgs  ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) DEFAULT 'GBP';
      ALTER TABLE preview.orgs ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) DEFAULT 'GBP';
      ALTER TABLE master.orgs  ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) DEFAULT 'GBP';

      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS ref VARCHAR(20);
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS ref VARCHAR(20);
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS ref VARCHAR(20);

      -- pV2-MEDIA-01b: project media. cover_image_url / client_logo_url /
      -- card_color already exist; add the Lucide icon fallback (cover-less
      -- projects), the cover focal point (object-position %, SMALLINT DEFAULT
      -- 50 = centre, MEDIA.md lock §10), and the mandatory Unsplash
      -- attribution (lock §4). focal/attribution columns repeat on items +
      -- orgs in later MEDIA slices.
      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS icon_name VARCHAR(100);
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS icon_name VARCHAR(100);
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS icon_name VARCHAR(100);
      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS icon_color VARCHAR(50);
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS icon_color VARCHAR(50);
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS icon_color VARCHAR(50);
      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS cover_focal_x SMALLINT DEFAULT 50;
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS cover_focal_x SMALLINT DEFAULT 50;
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS cover_focal_x SMALLINT DEFAULT 50;
      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS cover_focal_y SMALLINT DEFAULT 50;
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS cover_focal_y SMALLINT DEFAULT 50;
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS cover_focal_y SMALLINT DEFAULT 50;
      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS unsplash_photographer_name TEXT;
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS unsplash_photographer_name TEXT;
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS unsplash_photographer_name TEXT;
      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS unsplash_photo_url TEXT;
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS unsplash_photo_url TEXT;
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS unsplash_photo_url TEXT;

      -- pV2-MEDIA-01c: project gallery — ordered JSONB array of
      -- { url, focalX, focalY, attribution? }. The multi-image strip on the
      -- Details tab. "Set as primary" copies the chosen image into
      -- cover_image_url / cover_focal_x/y / unsplash_* (MEDIA.md §12), so the
      -- card still renders from cover_*; this column is purely the gallery.
      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

      -- pV2-MEDIA-01d: org gallery (profile + supplier shopfront). logo_url,
      -- cover_image_url, image_display already exist on orgs; add the gallery
      -- strip. The supplier card already renders cover_image_url, so a supplier
      -- setting their profile cover becomes the card image automatically.
      ALTER TABLE public.orgs  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE preview.orgs ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE master.orgs  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

      -- v1.39f: bring preview + master categories schemas in line
      -- with public — the namespace + model + icon_name/color +
      -- object_type columns were added to public over time but
      -- never carried across, so the Photography seed below would
      -- otherwise fail on master.
      ALTER TABLE preview.categories ADD COLUMN IF NOT EXISTS namespace   VARCHAR(20)  DEFAULT 'catalogue';
      ALTER TABLE master.categories  ADD COLUMN IF NOT EXISTS namespace   VARCHAR(20)  DEFAULT 'catalogue';
      ALTER TABLE preview.categories ADD COLUMN IF NOT EXISTS model       VARCHAR(50);
      ALTER TABLE master.categories  ADD COLUMN IF NOT EXISTS model       VARCHAR(50);
      ALTER TABLE preview.categories ADD COLUMN IF NOT EXISTS icon_name   VARCHAR(50);
      ALTER TABLE master.categories  ADD COLUMN IF NOT EXISTS icon_name   VARCHAR(50);
      ALTER TABLE preview.categories ADD COLUMN IF NOT EXISTS icon_color  VARCHAR(20);
      ALTER TABLE master.categories  ADD COLUMN IF NOT EXISTS icon_color  VARCHAR(20);
      ALTER TABLE preview.categories ADD COLUMN IF NOT EXISTS object_type VARCHAR(20) DEFAULT 'category';
      ALTER TABLE master.categories  ADD COLUMN IF NOT EXISTS object_type VARCHAR(20) DEFAULT 'category';

      -- v1.39f: Photography catalogue category. AI parser returns
      -- "photography" as a categoryId — without a matching row the
      -- modal silently drops those categories on save. Idempotent
      -- INSERT ... WHERE NOT EXISTS so re-runs are no-ops.
      INSERT INTO public.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Photography', 'Stills, video, content capture and earned-media coverage.',
             'Camera', 12, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM public.categories
         WHERE name = 'Photography' AND namespace = 'catalogue' AND parent_id IS NULL
      );
      INSERT INTO preview.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Photography', 'Stills, video, content capture and earned-media coverage.',
             'Camera', 12, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM preview.categories
         WHERE name = 'Photography' AND namespace = 'catalogue' AND parent_id IS NULL
      );
      INSERT INTO master.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Photography', 'Stills, video, content capture and earned-media coverage.',
             'Camera', 12, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM master.categories
         WHERE name = 'Photography' AND namespace = 'catalogue' AND parent_id IS NULL
      );

      -- v1.42: "Set Build" was retired here — the Taxonomy v2 migration
      -- (migrate-taxonomy-v2.js) merges it into Stand Structure. Only
      -- Event Accessories + Other remain as standalone v2 categories;
      -- both are seeded below (idempotent WHERE NOT EXISTS).
      INSERT INTO public.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Event Accessories', 'Red carpets, gift bags, lanyards, table dressing, scent design and other event accessories.',
             'Sparkles', 14, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM public.categories
         WHERE name = 'Event Accessories' AND namespace = 'catalogue' AND parent_id IS NULL
      );
      INSERT INTO preview.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Event Accessories', 'Red carpets, gift bags, lanyards, table dressing, scent design and other event accessories.',
             'Sparkles', 14, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM preview.categories
         WHERE name = 'Event Accessories' AND namespace = 'catalogue' AND parent_id IS NULL
      );
      INSERT INTO master.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Event Accessories', 'Red carpets, gift bags, lanyards, table dressing, scent design and other event accessories.',
             'Sparkles', 14, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM master.categories
         WHERE name = 'Event Accessories' AND namespace = 'catalogue' AND parent_id IS NULL
      );

      INSERT INTO public.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Other', 'Project management fees, design fees, contingency, travel and other admin lines.',
             'MoreHorizontal', 15, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM public.categories
         WHERE name = 'Other' AND namespace = 'catalogue' AND parent_id IS NULL
      );
      INSERT INTO preview.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Other', 'Project management fees, design fees, contingency, travel and other admin lines.',
             'MoreHorizontal', 15, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM preview.categories
         WHERE name = 'Other' AND namespace = 'catalogue' AND parent_id IS NULL
      );
      INSERT INTO master.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Other', 'Project management fees, design fees, contingency, travel and other admin lines.',
             'MoreHorizontal', 15, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM master.categories
         WHERE name = 'Other' AND namespace = 'catalogue' AND parent_id IS NULL
      );
    `);

    // v1.42: ensure the tag table exists in all 3 schemas with the v2
    // shape — a `dimension` column and UNIQUE(category_id, dimension,
    // label) so values like "Both"/"Yes" can recur across dimensions.
    // The actual taxonomy + tag VALUES are seeded by
    // migrate-taxonomy-v2.js (run per schema after this script).
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.tag (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          category_id UUID NOT NULL REFERENCES ${schema}.categories(id) ON DELETE CASCADE,
          dimension   VARCHAR(50),
          label       TEXT NOT NULL,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE ${schema}.tag ADD COLUMN IF NOT EXISTS dimension VARCHAR(50);
        CREATE UNIQUE INDEX IF NOT EXISTS ${schema}_tag_cat_dim_label_key
          ON ${schema}.tag (category_id, dimension, label);
      `);
    }

    // ─────────────────────────────────────────────────────────────────
    // SUPERSEDED (v1.42) — the v1.40 taxonomy array below is kept for
    // history only. It is NOT executed: the loops that consumed it were
    // removed when Taxonomy v2 landed. The live taxonomy is defined in
    // FINAL_TAXONOMY_v2.md and seeded by migrate-taxonomy-v2.js.
    // ─────────────────────────────────────────────────────────────────
    const TAXONOMY = [
      // Stand Structure
      ['Stand Structure', 'Shell Scheme', 1],
      ['Stand Structure', 'Space Only / Custom Build', 2],
      ['Stand Structure', 'Modular / Reusable Systems', 3],
      ['Stand Structure', 'Pop-Up / Activation Structures', 4],
      ['Stand Structure', 'Bespoke Fabrication', 5],
      ['Stand Structure', 'Inflatables', 6],
      ['Stand Structure', 'Tensile / Canopy / Tent', 7],
      ['Stand Structure', 'Container / Portacabin Conversion', 8],
      ['Stand Structure', 'Stage / Platform Build', 9],
      ['Stand Structure', 'Outdoor Structure', 10],
      // Set Build (new)
      ['Set Build', 'Set Dressing / Styling', 1],
      ['Set Build', 'Scenic Painting', 2],
      ['Set Build', 'Props & Theming', 3],
      ['Set Build', 'Window Display', 4],
      ['Set Build', 'Shop / Retail Fit-Out', 5],
      ['Set Build', 'Immersive Environment', 6],
      ['Set Build', 'Photo Moment / Selfie Wall', 7],
      ['Set Build', 'Green Room / Backstage Build', 8],
      // Flooring
      ['Flooring', 'Carpet / Carpet Tile', 1],
      ['Flooring', 'Vinyl / Lino', 2],
      ['Flooring', 'Raised Floor / Platform', 3],
      ['Flooring', 'Outdoor Flooring / Trackway', 4],
      ['Flooring', 'Dance Floor', 5],
      ['Flooring', 'Branded Floor Graphics', 6],
      // Lighting
      ['Lighting', 'Architectural / Wash Lighting', 1],
      ['Lighting', 'Spot / Feature Lighting', 2],
      ['Lighting', 'Festoon / Fairy Lights', 3],
      ['Lighting', 'Neon / LED Signage', 4],
      ['Lighting', 'Gobo Projection', 5],
      ['Lighting', 'Uplighting', 6],
      ['Lighting', 'Intelligent / Moving Head', 7],
      ['Lighting', 'Outdoor / Weatherproof Lighting', 8],
      ['Lighting', 'Ambient / Mood Lighting', 9],
      // AV & Technology
      ['AV & Technology', 'PA & Sound System', 1],
      ['AV & Technology', 'Microphones', 2],
      ['AV & Technology', 'Mixing & Playback', 3],
      ['AV & Technology', 'LED Wall & Screens', 4],
      ['AV & Technology', 'TV & Monitors', 5],
      ['AV & Technology', 'Projection', 6],
      ['AV & Technology', 'Streaming & Recording', 7],
      ['AV & Technology', 'Control & Infrastructure', 8],
      ['AV & Technology', 'Interactive / Touchscreen', 9],
      ['AV & Technology', 'VR / AR Experience', 10],
      ['AV & Technology', 'WiFi & Connectivity', 11],
      // Furniture & Fixtures
      ['Furniture & Fixtures', 'Seating', 1],
      ['Furniture & Fixtures', 'Tables', 2],
      ['Furniture & Fixtures', 'Bar & Counter Units', 3],
      ['Furniture & Fixtures', 'Shelving & Display Units', 4],
      ['Furniture & Fixtures', 'Outdoor Furniture', 5],
      ['Furniture & Fixtures', 'Lounge & Breakout Sets', 6],
      ['Furniture & Fixtures', 'Plinths & Pedestals', 7],
      ['Furniture & Fixtures', 'Reception / Registration Desk', 8],
      ['Furniture & Fixtures', 'Retail Fixtures', 9],
      ['Furniture & Fixtures', 'Storage / Containers / Bins', 10],
      // Catering & Hospitality
      ['Catering & Hospitality', 'Catering Company / Chef', 1],
      ['Catering & Hospitality', 'Drinks & Mixology', 2],
      ['Catering & Hospitality', 'Coffee & Hot Drinks', 3],
      ['Catering & Hospitality', 'Afternoon Tea & Canapés', 4],
      ['Catering & Hospitality', 'Catering Equipment Hire', 5],
      ['Catering & Hospitality', 'Staffing (F&B)', 6],
      ['Catering & Hospitality', 'Product Sampling', 7],
      ['Catering & Hospitality', 'Food Truck / Street Food', 8],
      ['Catering & Hospitality', 'Ice Cream / Dessert', 9],
      ['Catering & Hospitality', 'Dietary & Allergen Management', 10],
      // Florals
      ['Florals', 'Table Centrepieces', 1],
      ['Florals', 'Entrance & Arch Florals', 2],
      ['Florals', 'Hanging Installations', 3],
      ['Florals', 'Potted Plants & Greenery', 4],
      ['Florals', 'Dried & Artificial Botanicals', 5],
      ['Florals', 'Branded / Colour-Matched Arrangements', 6],
      ['Florals', 'Sustainable / Seasonal Florals', 7],
      // Graphics & Signage
      ['Graphics & Signage', 'Large Format Print', 1],
      ['Graphics & Signage', 'Vinyl & Wraps', 2],
      ['Graphics & Signage', 'Fabric / Tension Graphics', 3],
      ['Graphics & Signage', 'Wayfinding & Directional', 4],
      ['Graphics & Signage', 'A-Frames / Freestanding', 5],
      ['Graphics & Signage', 'Step & Repeat / Press Wall', 6],
      ['Graphics & Signage', 'Vehicle / Fleet Wraps', 7],
      ['Graphics & Signage', 'Window Graphics', 8],
      ['Graphics & Signage', 'Digital Print / Packaging', 9],
      ['Graphics & Signage', 'Branded Merchandise / Collateral', 10],
      // Health & Safety
      ['Health & Safety', 'Risk Assessment / RAMS', 1],
      ['Health & Safety', 'Public Liability Insurance', 2],
      ['Health & Safety', 'Fire Safety / Marshal', 3],
      ['Health & Safety', 'First Aid Cover', 4],
      ['Health & Safety', 'Crowd Management / Barriers', 5],
      ['Health & Safety', 'Food Safety / Hygiene', 6],
      ['Health & Safety', 'Structural Certification', 7],
      ['Health & Safety', 'DBS / Safeguarding', 8],
      ['Health & Safety', 'Licensing / Permits', 9],
      // Logistics & Transport
      ['Logistics & Transport', 'Transport & Delivery', 1],
      ['Logistics & Transport', 'Load-In / Load-Out Crew', 2],
      ['Logistics & Transport', 'Storage & Warehousing', 3],
      ['Logistics & Transport', 'Generator / Temp Power', 4],
      ['Logistics & Transport', 'Water & Plumbing', 5],
      ['Logistics & Transport', 'Waste Management / Recycling', 6],
      ['Logistics & Transport', 'Freight / International Shipping', 7],
      ['Logistics & Transport', 'Site Survey / Recce', 8],
      ['Logistics & Transport', 'Event Insurance', 9],
      ['Logistics & Transport', 'Parking / Traffic Management', 10],
      // Entertainment
      ['Entertainment', 'Live Band / Musician', 1],
      ['Entertainment', 'DJ', 2],
      ['Entertainment', 'MC / Host', 3],
      ['Entertainment', 'Comedian / Speaker', 4],
      ['Entertainment', 'Performance Act', 5],
      ['Entertainment', 'Interactive Experience', 6],
      ['Entertainment', "Children's Entertainment", 7],
      ['Entertainment', 'Roaming / Ambient Acts', 8],
      // Staffing  (← Prompt 1's "Talent & Staffing")
      ['Staffing', 'Brand Ambassador', 1],
      ['Staffing', 'Event Manager / Producer', 2],
      ['Staffing', 'Registration / Front of House', 3],
      ['Staffing', 'Technical Crew', 4],
      ['Staffing', 'Runners / General Staff', 5],
      ['Staffing', 'Promotional Staff', 6],
      ['Staffing', 'Specialist Staff (DBS, First Aid)', 7],
      ['Staffing', 'Influencer / KOL Coordination', 8],
      ['Staffing', 'Interpreter / Multilingual Staff', 9],
      // Photography  (← Prompt 1's "Photography & Content")
      ['Photography', 'Event Photographer', 1],
      ['Photography', 'Videographer / Film Crew', 2],
      ['Photography', 'Drone Photography', 3],
      ['Photography', 'Social Media Content', 4],
      ['Photography', 'Live Streaming Crew', 5],
      ['Photography', 'Photo Booth / Activation', 6],
      ['Photography', 'Same-Day Edit / Highlights', 7],
      ['Photography', '360° / VR Capture', 8],
      // Event Accessories (new)
      ['Event Accessories', 'Red Carpet / Rope & Post', 1],
      ['Event Accessories', 'Gift Bags / Welcome Packs', 2],
      ['Event Accessories', 'Lanyards / Badges / Wristbands', 3],
      ['Event Accessories', 'Table Dressing / Linen', 4],
      ['Event Accessories', 'Glassware / Crockery Hire', 5],
      ['Event Accessories', 'Branded Uniforms / Workwear', 6],
      ['Event Accessories', 'Balloons / Confetti / Pyro', 7],
      ['Event Accessories', 'Scent / Aroma Design', 8],
      // Venue  (← Prompt 1's "Venues")
      ['Venue', 'Exhibition Centre', 1],
      ['Venue', 'Hotel / Conference', 2],
      ['Venue', 'Museum / Gallery', 3],
      ['Venue', 'Outdoor / Park / Garden', 4],
      ['Venue', 'Warehouse / Industrial', 5],
      ['Venue', 'Restaurant / Bar', 6],
      ['Venue', 'Unique / Non-Traditional', 7],
      ['Venue', 'Festival Site / Field', 8],
      ['Venue', 'Retail Unit / Pop-Up Shop', 9],
      ['Venue', 'Studio / Broadcast', 10],
      // Other (new)
      ['Other', 'Project Management Fee', 1],
      ['Other', 'Design & Creative Fee', 2],
      ['Other', 'Contingency', 3],
      ['Other', 'Client Hospitality', 4],
      ['Other', 'Travel & Accommodation', 5],
      ['Other', 'Miscellaneous', 6],
    ];
    void TAXONOMY; // referenced only by the superseded loops removed below.

    // v1.42 — the v1.40 tag seed + v1.41 child-category promotion that
    // used the TAXONOMY array above are REMOVED. They seeded the old
    // (pre-v2) taxonomy and the old tag shape, and the
    // `ON CONFLICT (category_id,label)` they relied on no longer exists
    // (the constraint moved to (category_id,dimension,label)). The
    // canonical v2 taxonomy + tag dimensions are seeded by
    // migrate-taxonomy-v2.js, run per schema after this script.
    console.log('  items columns ensured (time_unit, derived_from_id, parent_item_id, attributes, images).');
    console.log('  estimate_items drift reconciled (drop unit + is_active; add shortlisted + status_id).');
    console.log('  estimate_items v1.13 columns ensured (offer_price + 9 deal/approval fields).');
    console.log('  project_items table + unique index ensured.');
    console.log('  orgs.auto_publish_items ensured.');
    console.log('  orgs.ref_prefix + ref_counter and projects.ref ensured (v1.39).');
    console.log('  Photography / Event Accessories / Other catalogue categories ensured.');
    console.log('  tag table (v2 shape) ensured — taxonomy seeded separately by migrate-taxonomy-v2.js.');

    // ─────────────────────────────────────────────────────────────────
    // v1.41 — two-field subcategory model on items.
    //   items.category_id    = ALWAYS a parent category (parent_id IS NULL)
    //   items.subcategory_id = NULL or a child category (parent_id set)
    // Plus a BEFORE INSERT/UPDATE trigger that rejects rows where the
    // subcategory's parent_id doesn't match the row's category_id.
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.categories(id);
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES preview.categories(id);
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES master.categories(id);
    `);

    // Idempotent migration: any item whose category_id currently
    // points at a CHILD category gets split — move category_id up to
    // the parent, set subcategory_id to the original child. Re-runs
    // are no-ops (items already on parents won't match the JOIN).
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        UPDATE ${schema}.items i
           SET subcategory_id = i.category_id,
               category_id    = c.parent_id
          FROM ${schema}.categories c
         WHERE c.id = i.category_id
           AND c.parent_id IS NOT NULL;
      `);
    }

    // Subcategory ↔ category validation trigger. The function is
    // schema-qualified to keep public/preview/master functions
    // independent. CREATE OR REPLACE + DROP TRIGGER IF EXISTS makes
    // both safe to re-run.
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        CREATE OR REPLACE FUNCTION ${schema}.check_item_subcategory()
        RETURNS TRIGGER AS $body$
        BEGIN
          IF NEW.subcategory_id IS NOT NULL THEN
            IF NOT EXISTS (
              SELECT 1 FROM ${schema}.categories
               WHERE id = NEW.subcategory_id
                 AND parent_id = NEW.category_id
            ) THEN
              RAISE EXCEPTION 'Subcategory % does not belong to category %',
                NEW.subcategory_id, NEW.category_id;
            END IF;
          END IF;
          RETURN NEW;
        END;
        $body$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_check_item_subcategory ON ${schema}.items;
        CREATE TRIGGER trg_check_item_subcategory
          BEFORE INSERT OR UPDATE ON ${schema}.items
          FOR EACH ROW EXECUTE FUNCTION ${schema}.check_item_subcategory();
      `);
    }
    console.log('  items.subcategory_id column ensured + 15 items migrated + trg_check_item_subcategory installed (v1.41).');

    // ─────────────────────────────────────────────────────────────────
    // v1.43 — Taxonomy v2 Part 2: AI classification + pending suggestions.
    //   items.pending_classification JSONB — the latest unaccepted AI
    //     classification suggestion ({category, subcategory, tags,
    //     confidence}); NULL once the supplier accepts or skips it.
    //   supplier_item_tag                  — junction items ↔ tag, the
    //     structured (dimension-scoped) tag system. Eventually replaces
    //     the legacy free-text items.tags[] (migrated in Part 3).
    //   trg_check_item_tag_category        — rejects a junction row whose
    //     tag.category_id ≠ item.category_id (mirrors the subcategory
    //     trigger; this constraint drove the Option-A decision to
    //     duplicate the event-type dimension across categories).
    // All additive + IF NOT EXISTS — safe to re-run on every schema.
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      ALTER TABLE public.items  ADD COLUMN IF NOT EXISTS pending_classification JSONB;
      ALTER TABLE preview.items ADD COLUMN IF NOT EXISTS pending_classification JSONB;
      ALTER TABLE master.items  ADD COLUMN IF NOT EXISTS pending_classification JSONB;
    `);
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.supplier_item_tag (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          item_id    UUID NOT NULL REFERENCES ${schema}.items(id) ON DELETE CASCADE,
          tag_id     UUID NOT NULL REFERENCES ${schema}.tag(id)   ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (item_id, tag_id)
        );
        CREATE INDEX IF NOT EXISTS ${schema}_supplier_item_tag_item_idx
          ON ${schema}.supplier_item_tag (item_id);
        CREATE INDEX IF NOT EXISTS ${schema}_supplier_item_tag_tag_idx
          ON ${schema}.supplier_item_tag (tag_id);

        CREATE OR REPLACE FUNCTION ${schema}.check_item_tag_category()
        RETURNS TRIGGER AS $body$
        DECLARE
          tag_cat  UUID;
          item_cat UUID;
        BEGIN
          SELECT category_id INTO tag_cat  FROM ${schema}.tag   WHERE id = NEW.tag_id;
          SELECT category_id INTO item_cat FROM ${schema}.items WHERE id = NEW.item_id;
          IF tag_cat IS DISTINCT FROM item_cat THEN
            RAISE EXCEPTION 'Tag % (category %) does not match item % (category %)',
              NEW.tag_id, tag_cat, NEW.item_id, item_cat;
          END IF;
          RETURN NEW;
        END;
        $body$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_check_item_tag_category ON ${schema}.supplier_item_tag;
        CREATE TRIGGER trg_check_item_tag_category
          BEFORE INSERT OR UPDATE ON ${schema}.supplier_item_tag
          FOR EACH ROW EXECUTE FUNCTION ${schema}.check_item_tag_category();
      `);
    }
    console.log('  items.pending_classification + supplier_item_tag table + trg_check_item_tag_category installed (v1.43).');

    // ─────────────────────────────────────────────────────────────────
    // v1.46 — Part 3 Brief tab: AI item matching.
    //   project_items.source           — 'catalogue' | 'ai_proposed'
    //   project_items.ai_confidence    — 1-10 score from the matcher
    //   project_items.ai_match_reason  — one-line rationale
    //   project_items.ai_estimated_price — AI price for proposed items
    //   ai_search_hints                — captures the AI's search terms
    //     + the user's "I'd have looked for…" hint (training data).
    // All additive + IF NOT EXISTS — safe on every schema.
    // ─────────────────────────────────────────────────────────────────
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        ALTER TABLE ${schema}.project_items ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'catalogue';
        ALTER TABLE ${schema}.project_items ADD COLUMN IF NOT EXISTS ai_confidence INTEGER;
        ALTER TABLE ${schema}.project_items ADD COLUMN IF NOT EXISTS ai_match_reason TEXT;
        ALTER TABLE ${schema}.project_items ADD COLUMN IF NOT EXISTS ai_estimated_price NUMERIC(12,2);

        CREATE TABLE IF NOT EXISTS ${schema}.ai_search_hints (
          id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id      UUID REFERENCES ${schema}.projects(id) ON DELETE CASCADE,
          category_id     UUID REFERENCES ${schema}.categories(id),
          ai_search_terms TEXT[],
          user_hint       TEXT,
          created_at      TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    }
    console.log('  project_items AI-match columns + ai_search_hints table installed (v1.46).');

    // ─────────────────────────────────────────────────────────────────
    // v1.48 — refreshed user-facing descriptions for the 15 v2 catalogue
    // parent categories. The old seed copy predated Taxonomy v2 and was
    // inconsistent with it (e.g. Lighting still claimed "electrical
    // distribution", which is now AV's). Idempotent — plain UPDATE on name.
    // ─────────────────────────────────────────────────────────────────
    const CATEGORY_DESCRIPTIONS = {
      'Stand Structure':       'Exhibition stands, custom builds and the trades behind them — joinery, metalwork, scenic finishes, flooring and install.',
      'Lighting':              'Lighting design and fixtures — architectural wash, feature spots, uplighting, moving heads, festoon, neon and ambient effects.',
      'AV & Technology':       'Sound, screens and show technology — PA, LED walls, projection, interactive, streaming, connectivity, rigging and power.',
      'Furniture & Fixtures':  'Hired furniture and display units — seating, tables, lounge sets, bars, plinths, shelving and reception desks.',
      'Catering':              'Food and drink — canapés, bowl food, buffets, street food, live stations, sampling, desserts, bars and coffee.',
      'Florals':               'Event floristry and botanical installations — centrepieces, arches, hanging features, feature walls, greenery and bouquets.',
      'Graphics & Signage':    'Printed and branded materials — banners, wayfinding, vinyl, large-format print, portable displays, stationery and merchandise.',
      'Staffing':              'Event crew and talent — producers, brand ambassadors, hospitality, technical crew, specialists and multilingual staff.',
      'Health & Safety':       'Risk, compliance and safety services — RAMS, insurance, fire and first-aid cover, crowd management, certification and permits.',
      'Logistics & Transport': 'Moving and supporting the event — transport, crew, storage, temporary power, water, waste, freight and traffic.',
      'Entertainment':         'Live performance and hosted experiences — bands, DJs, hosts, speakers, performers, interactive and roaming acts.',
      'Photography':           'Capture and content — event photography, videography, drone, social content, photo booths and immersive capture.',
      'Event Accessories':     'The finishing touches — red carpet, gift bags, lanyards, linen, glassware hire, branded uniforms, pyro and scent.',
      'Venue':                 'Spaces to hire — exhibition centres, hotels, museums, outdoor sites, warehouses, restaurants and unique venues.',
      'Other':                 'Agency line items — project management and design fees, contingency, client hospitality, travel and site surveys.'
    };
    for (const schema of ['public', 'preview', 'master']) {
      for (const [name, desc] of Object.entries(CATEGORY_DESCRIPTIONS)) {
        await client.query(
          `UPDATE ${schema}.categories SET description = $1
            WHERE name = $2 AND parent_id IS NULL AND namespace = 'catalogue'`,
          [desc, name]
        );
      }
    }
    console.log('  v2 category descriptions refreshed on all schemas (v1.48).');

    // ─────────────────────────────────────────────────────────────────
    // v1.49e — Brief tab: persist the AI "Find items" result so it
    // re-displays after the user navigates away. match_result_json holds
    // the full matcher payload plus the brief text it was searched
    // against (used to decide when "Find again" should re-enable),
    // keyed by the project_categories (project_id, category_id) row.
    // Additive + IF NOT EXISTS — safe on every schema.
    // ─────────────────────────────────────────────────────────────────
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(
        `ALTER TABLE ${schema}.project_categories
           ADD COLUMN IF NOT EXISTS match_result_json JSONB`
      );
    }
    console.log('  project_categories.match_result_json column installed (v1.49e).');

    // ─────────────────────────────────────────────────────────────────
    // v1.49k — items.approval_status. AI-proposed items (created when an
    // agency picks a Brief-tab "proposed" match) must NOT enter the live
    // catalogue until the supplier approves them. They are inserted
    // is_active = false + approval_status = 'pending' — hidden from every
    // catalogue query (all filter is_active = true) yet still usable on
    // the project that proposed them. Existing + supplier-created items
    // default to 'approved'. Values: pending | approved | rejected.
    // ─────────────────────────────────────────────────────────────────
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(
        `ALTER TABLE ${schema}.items
           ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved'`
      );
    }
    console.log('  items.approval_status column installed (v1.49k).');

    // ─────────────────────────────────────────────────────────────────
    // v1.50 — quote_requests: the RFQ status tracker. When an agency
    // sends a Brief-tab requirement out for competitive quotes, one row
    // per (requirement item × supplier) tracks where each ask stands.
    // It sits ON TOP of existing infrastructure — it does NOT replace it:
    //   • the conversation     → messages   (message_thread_id → the
    //                            anchor / opening message of the thread)
    //   • the quote line items → message_items
    //   • the Ball spend       → balls_transactions (ONE debit per
    //                            project/category outreach, shared by
    //                            every quote_request in that batch)
    // quote_requests only carries status + the links to those records.
    // ─────────────────────────────────────────────────────────────────
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.quote_requests (
          id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id          UUID NOT NULL REFERENCES ${schema}.projects(id) ON DELETE CASCADE,
          project_category_id UUID REFERENCES ${schema}.project_categories(id) ON DELETE SET NULL,
          category_id         UUID REFERENCES ${schema}.categories(id),
          item_id             UUID REFERENCES ${schema}.items(id) ON DELETE SET NULL,
          supplier_org_id     UUID NOT NULL REFERENCES ${schema}.orgs(id),
          status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','quoted','declined','won','cancelled')),
          message_thread_id   UUID REFERENCES ${schema}.messages(id) ON DELETE SET NULL,
          ball_transaction_id UUID REFERENCES ${schema}.balls_transactions(id) ON DELETE SET NULL,
          created_at          TIMESTAMPTZ DEFAULT NOW(),
          updated_at          TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS ${schema}_quote_requests_supplier_idx
          ON ${schema}.quote_requests (supplier_org_id, status);
        CREATE INDEX IF NOT EXISTS ${schema}_quote_requests_project_idx
          ON ${schema}.quote_requests (project_id);
      `);
    }
    console.log('  quote_requests table installed (v1.50).');

    // ─────────────────────────────────────────────────────────────────
    // v1.53 — Brief tab: category form upgrades.
    //  • ballpark_budget — historically added only by the standalone
    //    migrate-v1.12-brief-tab.js, which targets APP_SCHEMA (dev only),
    //    so preview + master were missing it. Folded in here, idempotent.
    //  • status_code — per-category workflow status (Draft, Briefed,
    //    Out for Quote, Confirmed, …). Drives the Brief-tab status pill +
    //    dropdown and the Client-Managed / N-A card behaviour. Codes come
    //    from the category_status codelist seeded in shared.codelists.
    // Additive + IF NOT EXISTS — safe on every schema.
    // ─────────────────────────────────────────────────────────────────
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(
        `ALTER TABLE ${schema}.project_categories
           ADD COLUMN IF NOT EXISTS ballpark_budget NUMERIC DEFAULT 0`
      );
      await client.query(
        `ALTER TABLE ${schema}.project_categories
           ADD COLUMN IF NOT EXISTS status_code VARCHAR(30) DEFAULT 'draft'`
      );
    }
    console.log('  project_categories.ballpark_budget + status_code installed (v1.53).');

    // ── 4. Create shared schema ──────────────────────────────────────────
    console.log('  Creating shared schema tables...');
    await client.query(`
      -- Backlog items (replaces BACKLOG.csv)
      CREATE TABLE IF NOT EXISTS shared.backlog (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        area VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'wont_do')),
        environment VARCHAR(20) DEFAULT 'all' CHECK (environment IN ('all', 'dev', 'preview', 'master')),
        reported_by VARCHAR(255),
        assigned_to VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Bug reports
      CREATE TABLE IF NOT EXISTS shared.bugs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        steps_to_reproduce TEXT,
        expected_behaviour TEXT,
        actual_behaviour TEXT,
        severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix', 'duplicate')),
        environment VARCHAR(20) CHECK (environment IN ('dev', 'preview', 'master')),
        reported_by VARCHAR(255),
        assigned_to VARCHAR(255),
        commit_ref VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Feedback (cross-environment capture)
      CREATE TABLE IF NOT EXISTS shared.feedback (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_id UUID,
        subcategory_id UUID,
        title VARCHAR(255) NOT NULL,
        notes TEXT,
        page_url VARCHAR(500),
        submitted_by VARCHAR(100),
        environment VARCHAR(20) DEFAULT 'preview',
        owner VARCHAR(100),
        due_date DATE,
        meeting_date DATE,
        parent_id UUID REFERENCES shared.feedback(id),
        agenda TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Feature flags (cross-environment config)
      CREATE TABLE IF NOT EXISTS shared.feature_flags (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        key VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        enabled_dev BOOLEAN DEFAULT false,
        enabled_preview BOOLEAN DEFAULT false,
        enabled_master BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Feedback categories (cross-environment, single source of truth for
      -- folder types like Minutes/Sprint and issue types like Bug/Prompt)
      CREATE TABLE IF NOT EXISTS shared.feedback_categories (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        VARCHAR(100) NOT NULL UNIQUE,
        object_type VARCHAR(20) CHECK (object_type IN ('folder','issue')),
        icon_name   VARCHAR(50),
        icon_color  VARCHAR(30) DEFAULT 'var(--theme-bg)',
        tagline     VARCHAR(255),
        description TEXT,
        parent_id   UUID REFERENCES shared.feedback_categories(id),
        sort_order  INTEGER DEFAULT 0,
        namespace   VARCHAR(20) DEFAULT 'feedback',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE shared.feedback
        ADD COLUMN IF NOT EXISTS feedback_category_id UUID
          REFERENCES shared.feedback_categories(id);

      ALTER TABLE shared.feedback
        ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

      ALTER TABLE shared.feedback
        ADD COLUMN IF NOT EXISTS version VARCHAR(10);

      ALTER TABLE shared.feedback
        ADD COLUMN IF NOT EXISTS shipped_date DATE;

      ALTER TABLE shared.feedback
        ADD COLUMN IF NOT EXISTS area VARCHAR(50);

      -- priority is INTEGER 1-5 (1 = highest). Older deploys had a VARCHAR
      -- column ('critical'/'high'/'medium'/'low') — see
      -- migrate-feedback-priority-int.js for the conversion. This statement
      -- only adds the column on a brand-new deploy.
      ALTER TABLE shared.feedback
        ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3
        CHECK (priority IS NULL OR (priority BETWEEN 1 AND 5));

      ALTER TABLE shared.feedback
        ADD COLUMN IF NOT EXISTS target_version VARCHAR(10);

      ALTER TABLE shared.feedback
        ADD COLUMN IF NOT EXISTS pages TEXT[] DEFAULT '{}';

      -- shared.feedback_categories now holds 3 namespaces: folder, issue, area.
      -- Drop the single-column UNIQUE(name) constraint (auto-named
      -- feedback_categories_name_key) and replace with UNIQUE(name, namespace)
      -- so we can have e.g. 'Feedback' both as an issue category and an area.
      ALTER TABLE shared.feedback_categories
        DROP CONSTRAINT IF EXISTS feedback_categories_name_key;

      CREATE UNIQUE INDEX IF NOT EXISTS feedback_categories_name_namespace_key
        ON shared.feedback_categories (name, namespace);

      ALTER TABLE shared.feedback
        ADD COLUMN IF NOT EXISTS area_category_id UUID
          REFERENCES shared.feedback_categories(id);

      -- Normalise legacy type values that pre-date the check constraint:
      -- 'action'/'agenda' were in-meeting child rows (now 'note'); 'Call'
      -- and 'Meeting' were ad-hoc folder labels (now 'minutes').
      UPDATE shared.feedback SET type = 'note'
        WHERE type IN ('action', 'agenda');
      UPDATE shared.feedback SET type = 'minutes'
        WHERE type IN ('Call', 'Meeting');

      -- Type constraint — extended for test_case + acceptance_criteria
      -- (children of issues used by the test-cases drawer section).
      ALTER TABLE shared.feedback
        DROP CONSTRAINT IF EXISTS feedback_type_check;
      ALTER TABLE shared.feedback
        ADD CONSTRAINT feedback_type_check
          CHECK (type IS NULL OR type IN (
            'bug', 'enhancement', 'question', 'prompt', 'note',
            'minutes', 'test_run', 'sprint', 'workshop',
            'test_case', 'acceptance_criteria'
          ));

      -- Status constraint — extended with pass/fail/skip (test cases) and
      -- draft/agreed (acceptance criteria) on top of the existing issue
      -- statuses.
      ALTER TABLE shared.feedback
        DROP CONSTRAINT IF EXISTS feedback_status_check;
      ALTER TABLE shared.feedback
        ADD CONSTRAINT feedback_status_check
          CHECK (status IS NULL OR status IN (
            'open', 'in_progress', 'done', 'wont_fix',
            'pass', 'fail', 'skip', 'todo', 'draft', 'agreed'
          ));

      -- pV2-CODELISTS-01: the v1 single table shared.codelists became
      -- shared.reference_codelist_values (RCV). The reference_ prefix is
      -- deliberate (see docs/CODELISTS.md) — rename BEFORE the idempotent
      -- create below so live DBs carry their data across and fresh DBs
      -- simply create the new name.
      DO $rcv$
      BEGIN
        IF to_regclass('shared.codelists') IS NOT NULL
           AND to_regclass('shared.reference_codelist_values') IS NULL THEN
          ALTER TABLE shared.codelists RENAME TO reference_codelist_values;
        END IF;
      END $rcv$;

      -- Codelist VALUES (RCV) — one row per (list_name, code); the parent
      -- reference_codelists table (RC) is created in section 4f below.
      CREATE TABLE IF NOT EXISTS shared.reference_codelist_values (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        list_name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NOT NULL,
        label VARCHAR(100) NOT NULL,
        symbol VARCHAR(20),
        meta JSONB DEFAULT '{}',
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(list_name, code)
      );

      INSERT INTO shared.reference_codelist_values (list_name, code, label, symbol, sort_order, is_system) VALUES
        ('item_unit',      'unit',      'Units',          NULL, 1, true),
        ('item_unit',      'cover',     'Covers',         NULL, 2, true),
        ('item_unit',      'head',      'Head',           NULL, 3, true),
        ('item_unit',      'sqm',       'Square Metres',  'm²', 4, true),
        ('item_unit',      'sqft',      'Square Feet',    'ft²', 5, true),
        ('item_unit',      'linear_m',  'Linear Metres',  'm',  6, true),
        ('item_unit',      'each',      'Each',           'ea', 7, true),
        ('item_unit',      'package',   'Package',        NULL, 8, true),
        ('item_unit',      'set',       'Set',            NULL, 9, true),
        ('item_unit',      'project',   'Project',        NULL, 10, true),
        ('item_unit',      'item',      'Item',           NULL, 11, true),
        ('item_unit',      'pair',      'Pair',           NULL, 12, true),
        ('item_unit',      'panel',     'Panel',          NULL, 13, true),
        ('item_unit',      'platter',   'Platter',        NULL, 14, true),
        ('item_unit',      'letter',    'Letter',         NULL, 15, true),
        ('item_unit',      'load',      'Load',           NULL, 16, true),
        ('item_unit',      'pallet',    'Pallet',         NULL, 17, true),
        ('item_unit',      'cbm',       'Cubic Metres',   'm³', 18, true),
        ('item_unit',      'table',     'Table',          NULL, 19, true),
        ('item_time_unit', 'day',       'Days',           NULL, 1, true),
        ('item_time_unit', 'hour',      'Hours',          'hr', 2, true),
        ('item_time_unit', 'event',     'Event',          NULL, 3, true),
        ('item_time_unit', 'half_day',  'Half Day',       NULL, 4, true),
        ('item_time_unit', 'month',     'Month',          NULL, 5, true),
        -- v1.29: currency codelist drives the Event drawer's Currency
        -- dropdown. ISO-4217 code stored on projects.currency.
        ('currency',       'GBP',       'GBP (£)',         '£',   1, true),
        ('currency',       'USD',       'USD ($)',         '$',   2, true),
        ('currency',       'EUR',       'EUR (€)',         '€',   3, true),
        ('currency',       'AED',       'AED (د.إ)',       'د.إ', 4, true),
        ('currency',       'CHF',       'CHF (Fr)',        'Fr',  5, true),
        ('currency',       'SEK',       'SEK (kr)',        'kr',  6, true),
        -- v1.30: budget_tier drives the Event drawer's Tier dropdown.
        -- The rule-based brief parser also writes one of these codes
        -- straight to projects.tier (no mapping to older item tiers).
        ('budget_tier',    'starter',      'Starter',      NULL, 1, true),
        ('budget_tier',    'professional', 'Professional', NULL, 2, true),
        ('budget_tier',    'premium',      'Premium',      NULL, 3, true),
        ('budget_tier',    'unknown',      'Unknown',      NULL, 4, true)
      ON CONFLICT (list_name, code) DO NOTHING;

      -- v1.31: project_status drives the Event drawer's Status dropdown
      -- and the dashboard project-card pill colour. Colour is stored on
      -- meta JSONB so the consumer reads it via
      -- CodelistService.getMeta('project_status', code).color.
      -- v2.19a (RP-09): token refs, not hex — each app's styles.css owns
      -- the hue (--color-state-* set, identical hex in v1 + v2 today).
      INSERT INTO shared.reference_codelist_values (list_name, code, label, sort_order, meta, is_system) VALUES
        ('project_status', 'draft',     'Draft',     1, '{"color":"--color-state-amber"}'::jsonb, true),
        ('project_status', 'active',    'Active',    2, '{"color":"--color-state-emerald"}'::jsonb, true),
        ('project_status', 'completed', 'Completed', 3, '{"color":"--color-state-gray"}'::jsonb, true),
        ('project_status', 'archived',  'Archived',  4, '{"color":"--color-state-gray-light"}'::jsonb, true)
      ON CONFLICT (list_name, code) DO NOTHING;

      -- v1.53: category_status drives the Brief-tab per-category status
      -- pill + dropdown. meta.color is read by the pill via
      -- CodelistService.getMeta('category_status', code).color.
      INSERT INTO shared.reference_codelist_values (list_name, code, label, sort_order, meta, is_system) VALUES
        ('category_status', 'draft',          'Draft',           1, '{"color":"--color-state-gray"}'::jsonb, true),
        ('category_status', 'briefed',        'Briefed',         2, '{"color":"--color-state-blue"}'::jsonb, true),
        ('category_status', 'need_supplier',  'Need Supplier',   3, '{"color":"--color-state-orange"}'::jsonb, true),
        ('category_status', 'out_for_quote',  'Out for Quote',   4, '{"color":"--color-state-indigo"}'::jsonb, true),
        ('category_status', 'quoted',         'Quoted',          5, '{"color":"--color-state-sky"}'::jsonb, true),
        ('category_status', 'confirmed',      'Confirmed',       6, '{"color":"--color-state-green"}'::jsonb, true),
        ('category_status', 'awaiting',       'Awaiting Client', 7, '{"color":"--color-state-amber"}'::jsonb, true),
        ('category_status', 'client_managed', 'Client Managed',  8, '{"color":"--color-state-violet"}'::jsonb, true),
        ('category_status', 'na',             'N/A',             9, '{"color":"--color-state-gray-light"}'::jsonb, true)
      ON CONFLICT (list_name, code) DO NOTHING;
    `);
    console.log('  Shared schema tables created.');

    // ── 4c. Backfill namespace on the original folder/issue rows ─────────
    await client.query(`
      UPDATE shared.feedback_categories
         SET namespace = 'folder'
       WHERE object_type = 'folder' AND namespace IS DISTINCT FROM 'folder';
      UPDATE shared.feedback_categories
         SET namespace = 'issue'
       WHERE object_type = 'issue' AND namespace IS DISTINCT FROM 'issue';
    `);

    // ── 4d. Seed area rows in shared.feedback_categories (idempotent) ────
    console.log('  Seeding shared.feedback_categories area rows...');
    const AREA_CATEGORIES = [
      { name: 'Auth',           icon_name: 'shield',           sort_order: 1 },
      { name: 'Settings',       icon_name: 'settings',          sort_order: 2 },
      { name: 'Dashboard',      icon_name: 'layout-dashboard',  sort_order: 3 },
      { name: 'Projects',       icon_name: 'folder-open',       sort_order: 4 },
      { name: 'Catalogue',      icon_name: 'layers',            sort_order: 5 },
      { name: 'Suppliers',      icon_name: 'building-2',        sort_order: 6 },
      { name: 'Balls',          icon_name: 'circle-dot',        sort_order: 7 },
      { name: 'Payments',       icon_name: 'credit-card',       sort_order: 8 },
      { name: 'Feedback',       icon_name: 'message-square',    sort_order: 9 },
      { name: 'Mobile',         icon_name: 'smartphone',        sort_order: 10 },
      { name: 'Notifications',  icon_name: 'bell',              sort_order: 11 },
      { name: 'Technical',      icon_name: 'wrench',            sort_order: 12 },
      { name: 'Marketing',      icon_name: 'globe',             sort_order: 13 },
      { name: 'Design System',  icon_name: 'palette',           sort_order: 14 }
    ];
    for (const ac of AREA_CATEGORIES) {
      await client.query(
        `INSERT INTO shared.feedback_categories
           (name, namespace, object_type, icon_name, icon_color, sort_order)
         VALUES ($1, 'area', NULL, $2, 'var(--theme-bg)', $3)
         ON CONFLICT (name, namespace) DO NOTHING`,
        [ac.name, ac.icon_name, ac.sort_order]
      );
    }
    console.log('  Area rows seeded.');

    // ── 4e. Backfill shared.feedback.area_category_id ────────────────────
    //       Maps the legacy area string (e.g. 'design') to the canonical
    //       area name (e.g. 'Design System') via a small alias table, then
    //       resolves to the row id. Leaves rows whose area is NULL or
    //       unmapped (e.g. legacy 'categories') with area_category_id NULL.
    await client.query(`
      WITH alias AS (
        SELECT * FROM (VALUES
          ('design', 'Design System')
        ) AS t(token, canonical)
      )
      UPDATE shared.feedback f
         SET area_category_id = fc.id
        FROM shared.feedback_categories fc
        LEFT JOIN alias a ON LOWER(a.token) = LOWER(fc.name)
       WHERE fc.namespace = 'area'
         AND (LOWER(f.area) = LOWER(fc.name)
              OR LOWER(f.area) = LOWER(a.token))
         AND f.area_category_id IS NULL
    `);
    console.log('  shared.feedback.area_category_id backfilled.');

    // ── 4a. Seed shared.feedback_categories (idempotent via UNIQUE name) ─
    console.log('  Seeding shared.feedback_categories...');
    const FEEDBACK_CATEGORIES = [
      // Folders
      { name: 'Minutes',     object_type: 'folder', icon_name: 'calendar',      icon_color: 'var(--theme-bg)',        tagline: 'Meeting notes and decisions',     description: 'Record meetings, decisions and follow-up actions.',           sort_order: 1 },
      { name: 'Sprint',      object_type: 'folder', icon_name: 'zap',            icon_color: 'var(--theme-bg)',        tagline: 'Development sprint tracker',      description: 'Plan and track work across a development sprint.',            sort_order: 2 },
      { name: 'Test Run',    object_type: 'folder', icon_name: 'flask-conical',  icon_color: 'var(--theme-bg)',        tagline: 'QA and testing sessions',         description: 'Record bugs and observations from a testing session.',        sort_order: 3 },
      { name: 'Workshop',    object_type: 'folder', icon_name: 'users',          icon_color: 'var(--theme-bg)',        tagline: 'Working sessions and discovery',  description: 'Capture outputs from workshops and working sessions.',        sort_order: 4 },
      { name: 'Note',        object_type: 'folder', icon_name: 'file-text',      icon_color: 'var(--theme-bg)',        tagline: 'General notes and documents',     description: 'A free-form note or reference document.',                     sort_order: 5 },
      // Issues
      { name: 'Bug',         object_type: 'issue',  icon_name: 'bug',            icon_color: 'var(--color-danger-bg)', tagline: 'Something is broken',             description: 'Log anything broken, inconsistent or behaving unexpectedly.', sort_order: 6 },
      { name: 'Enhancement', object_type: 'issue',  icon_name: 'lightbulb',      icon_color: 'var(--theme-bg)',        tagline: 'Make it better',                  description: 'Feature requests, improvements and nice-to-haves.',           sort_order: 7 },
      { name: 'Question',    object_type: 'issue',  icon_name: 'circle-help',    icon_color: 'var(--theme-bg)',        tagline: 'Something to discuss',            description: 'Open questions about the product, process or pricing.',      sort_order: 8 },
      { name: 'Prompt',      object_type: 'issue',  icon_name: 'clipboard-pen',  icon_color: 'var(--theme-bg)',        tagline: 'A requirement or instruction',    description: 'Capture specific requirements and build instructions.',       sort_order: 9 },
      { name: 'Test Case',   object_type: 'issue',  icon_name: 'check-square',   icon_color: 'var(--theme-bg)',        tagline: 'Test result on an issue',         description: 'A pass/fail/skip observation logged against an issue.',       sort_order: 10 }
    ];
    for (const fc of FEEDBACK_CATEGORIES) {
      await client.query(
        `INSERT INTO shared.feedback_categories
           (name, object_type, icon_name, icon_color, tagline, description, sort_order, namespace)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (name, namespace) DO NOTHING`,
        [fc.name, fc.object_type, fc.icon_name, fc.icon_color, fc.tagline, fc.description, fc.sort_order, fc.object_type]
      );
    }
    console.log('  Feedback categories seeded.');

    // ── 4b. Backfill feedback_category_id on existing rows (best-effort
    //       lowercase match on name, with underscore→space normalisation
    //       so 'test_run' → 'Test Run'). Leaves rows whose `type` does not
    //       map (e.g. 'agenda', 'action') with feedback_category_id NULL.
    await client.query(`
      UPDATE shared.feedback f
      SET feedback_category_id = fc.id
      FROM shared.feedback_categories fc
      WHERE LOWER(REPLACE(f.type, '_', ' ')) = LOWER(fc.name)
        AND f.feedback_category_id IS NULL
    `);
    console.log('  shared.feedback.feedback_category_id backfilled.');

    // ── 5. Internal schema (ops tables, single instance) ─────────────────
    console.log('  Creating internal schema tables...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS internal.project_log (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type        VARCHAR(20) NOT NULL,
        area        VARCHAR(50),
        title       TEXT NOT NULL,
        description TEXT,
        status      VARCHAR(20) DEFAULT 'done',
        commit_ref  VARCHAR(40),
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS project_log_commit_ref_idx
        ON internal.project_log (commit_ref);
      CREATE INDEX IF NOT EXISTS project_log_created_idx
        ON internal.project_log (created_at DESC);
    `);
    console.log('  Internal schema tables created.');

    // ── 6. Marketing schema (public welcome page + signups) ──────────────
    console.log('  Creating marketing schema tables...');
    await client.query(`
      -- Guestlist signups from /welcome (pV2-EA-01: first/last name split,
      -- role + company dropped, source_environment added).
      CREATE TABLE IF NOT EXISTS marketing.guestlist_signup (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        first_name  TEXT NOT NULL,
        last_name   TEXT NOT NULL DEFAULT '',
        email       TEXT NOT NULL,
        -- Inferred from the Origin header at signup (marketing schema is
        -- single-instance across envs, so we tag where each row came from).
        -- Default 'unknown' — a row only becomes dev/preview/master when the
        -- signup endpoint infers it (pre-EA-01 rows have no recorded origin).
        source_environment TEXT NOT NULL DEFAULT 'unknown',
        ip_address  TEXT,
        user_agent  TEXT,
        notified_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- v1.65gZ32 — soft-delete column. NULL = active. Soft-deleted
        -- rows are filtered out of listSignups + stats; partial unique
        -- index below means the same email can sign up again.
        deleted_at  TIMESTAMPTZ
      );
      ALTER TABLE marketing.guestlist_signup
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

      -- pV2-EA-01 migration for EXISTING DBs (idempotent). RENAME has no
      -- IF EXISTS, so guard it; the rest use IF [NOT] EXISTS.
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='marketing' AND table_name='guestlist_signup' AND column_name='name')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='marketing' AND table_name='guestlist_signup' AND column_name='first_name') THEN
          ALTER TABLE marketing.guestlist_signup RENAME COLUMN name TO first_name;
        END IF;
      END $$;
      ALTER TABLE marketing.guestlist_signup DROP COLUMN IF EXISTS role;
      ALTER TABLE marketing.guestlist_signup DROP COLUMN IF EXISTS company;
      ALTER TABLE marketing.guestlist_signup ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE marketing.guestlist_signup ADD COLUMN IF NOT EXISTS source_environment TEXT NOT NULL DEFAULT 'unknown';
      -- Backfill: split the legacy single name on the first space. Single-word
      -- names keep an empty last_name. Idempotent — rows already split (last_name
      -- non-empty) are skipped; single-word rows re-run as a no-op.
      UPDATE marketing.guestlist_signup
         SET last_name  = COALESCE(NULLIF(SPLIT_PART(first_name, ' ', 2), ''), ''),
             first_name = SPLIT_PART(first_name, ' ', 1)
       WHERE last_name = '' AND first_name LIKE '% %';
      -- v1.65gZ32 — replace the unconditional unique index with a
      -- partial one that only enforces uniqueness on active rows.
      DROP INDEX IF EXISTS marketing.guestlist_signup_email_uniq;
      CREATE UNIQUE INDEX IF NOT EXISTS guestlist_signup_email_active_uniq
        ON marketing.guestlist_signup (lower(email))
        WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS guestlist_signup_created_idx
        ON marketing.guestlist_signup (created_at DESC);
      CREATE INDEX IF NOT EXISTS guestlist_signup_active_created_idx
        ON marketing.guestlist_signup (created_at DESC)
        WHERE deleted_at IS NULL;

      -- Editable copy on the welcome page
      CREATE TABLE IF NOT EXISTS marketing.welcome_content (
        key           TEXT PRIMARY KEY,
        value         TEXT NOT NULL,
        field_type    TEXT NOT NULL CHECK (field_type IN ('text', 'longtext', 'list')),
        label         TEXT NOT NULL,
        help_text     TEXT,
        slide         INT  NOT NULL CHECK (slide BETWEEN 1 AND 4),
        display_order INT  NOT NULL,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by    UUID
      );
      CREATE INDEX IF NOT EXISTS welcome_content_slide_order_idx
        ON marketing.welcome_content (slide, display_order);

      -- Single-row settings table for notification config
      CREATE TABLE IF NOT EXISTS marketing.welcome_settings (
        id                  INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        notify_recipients   TEXT[] NOT NULL DEFAULT ARRAY['beth@theballpark.ai', 'megan@theballpark.ai'],
        email_subject       TEXT NOT NULL DEFAULT '🎟 New Ballpark guestlist signup: {{name}}',
        email_body_template TEXT NOT NULL,
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by          UUID
      );
    `);
    console.log('  Marketing schema tables created.');

    // ── 7. is_admin() function (referenced by RLS + Express middleware) ──
    // Each env has its own users table. The function returns true if the
    // user id has role='admin' in ANY env's users table — this is fine for
    // the marketing schema which is cross-env. Express middleware uses the
    // search_path-aware "users" table directly for per-env enforcement.
    console.log('  Creating is_admin() function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
      RETURNS BOOLEAN
      LANGUAGE SQL STABLE
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.users  WHERE id = uid AND role = 'admin'
          UNION ALL
          SELECT 1 FROM preview.users WHERE id = uid AND role = 'admin'
          UNION ALL
          SELECT 1 FROM master.users  WHERE id = uid AND role = 'admin'
        );
      $$;
    `);
    console.log('  is_admin() function created.');

    // ── 8. RLS policies on marketing tables ──────────────────────────────
    // Note: the Node server connects as the DB owner (bypasses RLS), so
    // these policies are advisory until proper Supabase auth lands. They
    // document intent and will activate the moment we switch to anon/auth
    // tokens. Server-side admin enforcement is done via Express middleware.
    console.log('  Applying RLS policies...');
    await client.query(`
      ALTER TABLE marketing.guestlist_signup ENABLE ROW LEVEL SECURITY;
      ALTER TABLE marketing.welcome_content  ENABLE ROW LEVEL SECURITY;
      ALTER TABLE marketing.welcome_settings ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "public can insert signups" ON marketing.guestlist_signup;
      CREATE POLICY "public can insert signups" ON marketing.guestlist_signup
        FOR INSERT TO anon, authenticated WITH CHECK (true);

      DROP POLICY IF EXISTS "public can read content" ON marketing.welcome_content;
      CREATE POLICY "public can read content" ON marketing.welcome_content
        FOR SELECT TO anon, authenticated USING (true);

      DROP POLICY IF EXISTS "admins read signups" ON marketing.guestlist_signup;
      CREATE POLICY "admins read signups" ON marketing.guestlist_signup
        FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

      DROP POLICY IF EXISTS "admins write content" ON marketing.welcome_content;
      CREATE POLICY "admins write content" ON marketing.welcome_content
        FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

      DROP POLICY IF EXISTS "admins read settings" ON marketing.welcome_settings;
      CREATE POLICY "admins read settings" ON marketing.welcome_settings
        FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

      DROP POLICY IF EXISTS "admins write settings" ON marketing.welcome_settings;
      CREATE POLICY "admins write settings" ON marketing.welcome_settings
        FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
    `);
    console.log('  RLS policies applied.');

    // ── 9. Seed marketing.welcome_content + welcome_settings ─────────────
    // Re-runnable: ON CONFLICT DO NOTHING preserves any admin edits.
    console.log('  Seeding marketing content + settings...');
    // v1.65gY — copy updated per client design review (see screenshots
    // in the dev/v1.65gY change set). Existing rows are preserved by
    // the ON CONFLICT DO NOTHING below; to apply these to an already-
    // seeded DB run server/src/db/update-welcome-v1.65gY.js.
    const SEED_CONTENT = [
      // Slide 1 — Hero
      ['hero.eyebrow',           'text',     'Coming soon · Event production reimagined', 'Eyebrow tag',  null, 1, 10],
      ['hero.headline',           'longtext', 'REAL COSTS\nREAL FAST',                     'Headline',     'Use \\n for line breaks', 1, 20],
      ['hero.subtitle',           'longtext', 'Turn your event into an accurate estimate in moments.', 'Subtitle', null, 1, 30],
      ['hero.cta',                'text',     'Get on the guestlist',                      'Hero CTA label', null, 1, 40],

      // Slide 2 — Suppliers
      ['suppliers.eyebrow',       'text',     'The network',                                                       'Eyebrow tag', null, 2, 10],
      ['suppliers.headline',      'longtext', 'AI Powered by real costs from our network of incredible suppliers.','Headline',    null, 2, 20],
      ['suppliers.subtitle',      'longtext', 'The best suppliers in the UK with quotes in minutes.',              'Subtitle',    null, 2, 25],
      ['suppliers.categories',    'list',     'DESIGN,BUILD,VENUES,FURNITURE,AV,GRAPHICS,CATERING',                'Categories (marquee)', 'Comma-separated. Order = marquee order.', 2, 30],

      // Slide 3 — Producers
      ['producers.headline',      'longtext', "A PRODUCERS BEST FRIEND.",                                                  'Headline', null, 3, 10],
      ['producers.tagline',       'text',     'By producers for creators',                                                  'Italic tagline', null, 3, 20],
      ['producers.body_1',        'longtext', 'Costing events can be a grind. Endless quotes, supplier chasing, tight turnarounds.', 'Body paragraph 1', null, 3, 30],
      ['producers.body_2',        'longtext', 'Ballpark makes it easy. Instant, accurate costs. Incredible suppliers. Everything in one place.', 'Body paragraph 2', null, 3, 40],

      // Slide 4 — Guestlist
      ['guestlist.eyebrow',          'text',     'You made it',                                              'Eyebrow tag',     null, 4, 10],
      ['guestlist.headline',         'longtext', 'THOSE WHO GET IN EARLY,\nGET AHEAD',                       'Headline',        'Use \\n for line breaks', 4, 20],
      ['guestlist.subtitle',         'longtext', "Get on the guestlist",                                     'Subtitle',        null, 4, 30],
      ['guestlist.footer_text',      'longtext', "Get on the guestlist. The moment we're live you'll be the first to know.", 'Footer text below form', null, 4, 35],
      ['guestlist.cta_label',        'text',     'APPLY',                                                    'Submit button label', null, 4, 40],
      ['guestlist.success_headline', 'text',     "You're on the guestlist.",                                  'Success headline', null, 4, 50],
      ['guestlist.success_body',     'longtext', "We'll be in touch the moment Ballpark goes live, {{firstName}}.", 'Success body', "Use {{firstName}} for the registrant's first name", 4, 60],
    ];
    for (const [key, field_type, value, label, help_text, slide, display_order] of SEED_CONTENT) {
      await client.query(
        `INSERT INTO marketing.welcome_content (key, value, field_type, label, help_text, slide, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (key) DO NOTHING`,
        [key, value, field_type, label, help_text, slide, display_order]
      );
    }

    const DEFAULT_EMAIL_BODY = [
      'A new person joined the Ballpark guestlist.',
      '',
      'Name:     {{name}}',
      'Email:    {{email}}',
      '',
      'Registered: {{created_at}}',
      '',
      'View all signups → {{admin_url}}'
    ].join('\n');

    await client.query(
      `INSERT INTO marketing.welcome_settings (id, email_body_template)
       VALUES (1, $1)
       ON CONFLICT (id) DO NOTHING`,
      [DEFAULT_EMAIL_BODY]
    );
    console.log('  Marketing seed complete.');

    // ─────────────────────────────────────────────────────────────────
    // v1.65 back-port section — schema work that was originally
    // landed via standalone migrate-vX.Y.js files (one per change)
    // is consolidated here so a single `node migrate-schemas.js` run
    // brings public + preview + master all the way up to current dev.
    //
    // RULE: any ALTER/CREATE shipped via a versioned migration file
    // MUST be mirrored here, applied to ALL THREE schemas. The
    // standalone files stay in tree as the documented history of
    // when the change landed, but they are NOT the source of truth.
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      -- v1.65f2: project_items.quantity (mirror of migrate-v1.65f2)
      ALTER TABLE public.project_items  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE preview.project_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE master.project_items  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

      -- v1.65fA: project_items snapshot columns (mirror of migrate-v1.65fA)
      ALTER TABLE public.project_items  ADD COLUMN IF NOT EXISTS name        VARCHAR(255);
      ALTER TABLE public.project_items  ADD COLUMN IF NOT EXISTS base_price  NUMERIC(12,2);
      ALTER TABLE public.project_items  ADD COLUMN IF NOT EXISTS unit        VARCHAR(50);
      ALTER TABLE public.project_items  ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE preview.project_items ADD COLUMN IF NOT EXISTS name        VARCHAR(255);
      ALTER TABLE preview.project_items ADD COLUMN IF NOT EXISTS base_price  NUMERIC(12,2);
      ALTER TABLE preview.project_items ADD COLUMN IF NOT EXISTS unit        VARCHAR(50);
      ALTER TABLE preview.project_items ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE master.project_items  ADD COLUMN IF NOT EXISTS name        VARCHAR(255);
      ALTER TABLE master.project_items  ADD COLUMN IF NOT EXISTS base_price  NUMERIC(12,2);
      ALTER TABLE master.project_items  ADD COLUMN IF NOT EXISTS unit        VARCHAR(50);
      ALTER TABLE master.project_items  ADD COLUMN IF NOT EXISTS description TEXT;

      -- v1.65fJ: project_items.image_url. Was only ever applied via
      -- the older migrate.js (public only), which is why preview +
      -- master Railway both 500'd on the listing query until the
      -- preview-sync caught it. Adding here so the canonical runner
      -- now covers all three schemas.
      ALTER TABLE public.project_items  ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE preview.project_items ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE master.project_items  ADD COLUMN IF NOT EXISTS image_url TEXT;

      -- pV2-BUILDUP-02: the supplier's "Services" text on the customized line
      -- (editable on the Customize item card, sent to the agent).
      ALTER TABLE public.project_items  ADD COLUMN IF NOT EXISTS install_description TEXT;
      ALTER TABLE preview.project_items ADD COLUMN IF NOT EXISTS install_description TEXT;
      ALTER TABLE master.project_items  ADD COLUMN IF NOT EXISTS install_description TEXT;

      -- pV2-CART-01: per-line Install choice. NULL = default (assumed on when
      -- the catalogue item carries an install_cost); true/false = explicit.
      ALTER TABLE public.project_items  ADD COLUMN IF NOT EXISTS installed BOOLEAN;
      ALTER TABLE preview.project_items ADD COLUMN IF NOT EXISTS installed BOOLEAN;
      ALTER TABLE master.project_items  ADD COLUMN IF NOT EXISTS installed BOOLEAN;
    `);
    console.log('  v1.65f* project_items column back-port ensured.');

    // v1.65fH: project_item_suppliers per-cart-item roster
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.project_item_suppliers (
        project_item_id UUID NOT NULL REFERENCES public.project_items(id) ON DELETE CASCADE,
        supplier_org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (project_item_id, supplier_org_id)
      );
      CREATE INDEX IF NOT EXISTS ix_project_item_suppliers_pi
        ON public.project_item_suppliers(project_item_id);

      CREATE TABLE IF NOT EXISTS preview.project_item_suppliers (
        project_item_id UUID NOT NULL REFERENCES preview.project_items(id) ON DELETE CASCADE,
        supplier_org_id UUID NOT NULL REFERENCES preview.orgs(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (project_item_id, supplier_org_id)
      );
      CREATE INDEX IF NOT EXISTS ix_project_item_suppliers_pi
        ON preview.project_item_suppliers(project_item_id);

      CREATE TABLE IF NOT EXISTS master.project_item_suppliers (
        project_item_id UUID NOT NULL REFERENCES master.project_items(id) ON DELETE CASCADE,
        supplier_org_id UUID NOT NULL REFERENCES master.orgs(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (project_item_id, supplier_org_id)
      );
      CREATE INDEX IF NOT EXISTS ix_project_item_suppliers_pi
        ON master.project_item_suppliers(project_item_id);
    `);
    console.log('  v1.65fH project_item_suppliers table ensured.');

    // v1.65fW: message_item_decisions satellite. Uses gen_random_uuid()
    // (PG13+ built-in) instead of uuid_generate_v4() so we don't
    // depend on the uuid-ossp extension being in the active schema.
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.message_item_decisions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_item_id UUID NOT NULL REFERENCES public.message_items(id) ON DELETE CASCADE,
        side            VARCHAR(20) NOT NULL,
        decision        VARCHAR(20) NOT NULL,
        user_id         UUID REFERENCES public.users(id),
        note            TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ix_mid_latest
        ON public.message_item_decisions(message_item_id, side, created_at DESC);

      CREATE TABLE IF NOT EXISTS preview.message_item_decisions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_item_id UUID NOT NULL REFERENCES preview.message_items(id) ON DELETE CASCADE,
        side            VARCHAR(20) NOT NULL,
        decision        VARCHAR(20) NOT NULL,
        user_id         UUID REFERENCES preview.users(id),
        note            TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ix_mid_latest
        ON preview.message_item_decisions(message_item_id, side, created_at DESC);

      CREATE TABLE IF NOT EXISTS master.message_item_decisions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_item_id UUID NOT NULL REFERENCES master.message_items(id) ON DELETE CASCADE,
        side            VARCHAR(20) NOT NULL,
        decision        VARCHAR(20) NOT NULL,
        user_id         UUID REFERENCES master.users(id),
        note            TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ix_mid_latest
        ON master.message_item_decisions(message_item_id, side, created_at DESC);
    `);
    console.log('  v1.65fW message_item_decisions table ensured.');

    // ── pV2-UNIFY-01: one line-state table ───────────────────────────────
    // The same conceptual line lived in two tables (project_items = cart:
    // qty/install/base_price; message_items = brief: price_ref/current/status)
    // read by two formulas — an inevitable drift class (the inbox rendered
    // £/head where the Final Quote rendered £/head × qty + install). Merge:
    //   • project_items GAINS the negotiation state (status/price_ref/
    //     price_current/decline_reason) → one row per (project, item) since an
    //     item has exactly one owner-supplier (items.org_id).
    //   • message_items DEMOTES to a stripped tag join (message_id +
    //     project_item_id) — "which items this message references".
    //   • the audit satellites (events + decisions) REPOINT to project_items(id).
    // Dev-mode: no backfill, one-time wipe of the negotiation graph. project_items
    // rows (the cart) survive; only their negotiation state resets. The wipe +
    // rename is guarded on the OLD shape (message_items.status still present) so
    // re-runs are no-ops and a future deploy never re-wipes live threads.
    for (const s of ['public', 'preview', 'master']) {
      // Additive on project_items — idempotent.
      await client.query(`
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS status         VARCHAR(40);
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS price_ref      NUMERIC(12,2);
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS price_current  NUMERIC(12,2);
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS decline_reason TEXT;
        -- Negotiable install cost/basis, per line — NULL falls back to the
        -- catalogue items.install_cost/unit (mirrors the base_price snapshot).
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS install_cost   NUMERIC(12,2);
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS install_unit   VARCHAR(30);
        -- pV2-UNIFY-01a: restore the per-supplier row model (UNIFY-01 locked
        -- decision #1 — one row per (project, line, supplier) — was collapsed to
        -- (project, item), which breaks competing quotes: N suppliers asked to
        -- quote one line each need their own price_current). supplier_org_id =
        -- who we asked (source of truth for a row's supplier post-send; NULL
        -- pre-send). logical_line_id groups the N supplier rows for one logical
        -- line; the cart/estimate collapse to one entry per group, the inbox
        -- shows the per-supplier rows. Backfill each existing row to its own id
        -- (every current row is its own single-supplier group).
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS supplier_org_id UUID REFERENCES ${s}.orgs(id);
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS logical_line_id UUID;
        UPDATE ${s}.project_items SET logical_line_id = id WHERE logical_line_id IS NULL;
        CREATE INDEX IF NOT EXISTS ix_project_items_logical_line
          ON ${s}.project_items(logical_line_id);
        -- The old (project_id, item_id) uniqueness is incompatible with the
        -- per-supplier row model (N rows per item) AND with CUSTOMS-01's NULL
        -- item_id. addItem's SELECT ... FOR UPDATE revive doesn't need it.
        DROP INDEX IF EXISTS ${s}.uq_project_items_project_item;
        -- pV2-CUSTOMS-01: a custom "Add Your Own Line Item" is a pure
        -- project_items row with NO catalogue backing — item_id NULL, all data
        -- (name/price/unit/install/description) on the row. is_custom is the
        -- explicit marker (item_id IS NULL is equivalent; the column reads
        -- better in code + audits).
        ALTER TABLE ${s}.project_items ALTER COLUMN item_id DROP NOT NULL;
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT false;
        -- audit trigger columns — the shared audit.stamp_audit trigger stamps
        -- these on every INSERT/UPDATE and ERRORS if absent. Ensure them here so
        -- project_items writes don't break on a drifted schema (preview lacked
        -- these — surfaced pre-preview-promotion, 2026-07-09).
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS created_by UUID;
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS updated_by UUID;
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS deleted_by UUID;
        -- audit M-5: restore double-add safety for addItem's revive without
        -- blocking the per-supplier fan-out clones (supplier_org_id set) or
        -- custom lines (item_id NULL) — a PARTIAL unique index over just the
        -- live, canonical, catalogue rows.
        CREATE UNIQUE INDEX IF NOT EXISTS uq_project_items_canonical
          ON ${s}.project_items(project_id, item_id)
          WHERE supplier_org_id IS NULL AND item_id IS NOT NULL AND deleted_at IS NULL;
      `);
      // The stripped tag join keeps the shared audit columns — the audit.*
      // BEFORE INSERT/UPDATE trigger stamps created_by/updated_*/deleted_* and
      // errors if they're missing. Re-add is idempotent (also restores them on
      // a schema where an earlier draft over-dropped them).
      await client.query(`
        ALTER TABLE ${s}.message_items ADD COLUMN IF NOT EXISTS created_by UUID;
        ALTER TABLE ${s}.message_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
        ALTER TABLE ${s}.message_items ADD COLUMN IF NOT EXISTS updated_by UUID;
        ALTER TABLE ${s}.message_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
        ALTER TABLE ${s}.message_items ADD COLUMN IF NOT EXISTS deleted_by UUID;
      `);
      // One-time destructive slim-down + FK repoint (guarded on old shape).
      await client.query(`
        DO $unify$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='${s}' AND table_name='message_items'
                         AND column_name='status') THEN
            -- Dev wipe: the rename swaps a catalogue-item ref for a project_item
            -- ref; existing rows can't convert, so clear the negotiation graph.
            TRUNCATE ${s}.messages, ${s}.message_items, ${s}.message_item_events,
                     ${s}.message_item_decisions, ${s}.quote_requests
                     RESTART IDENTITY CASCADE;
            UPDATE ${s}.project_items
               SET status = NULL, price_ref = NULL, price_current = NULL, decline_reason = NULL;

            -- message_items → tag join: keep id/message_id/project_item_id +
            -- the audit columns (trigger-stamped); drop only the state columns.
            ALTER TABLE ${s}.message_items RENAME COLUMN item_id TO project_item_id;
            ALTER TABLE ${s}.message_items
              DROP COLUMN IF EXISTS name,           DROP COLUMN IF EXISTS description,
              DROP COLUMN IF EXISTS price,          DROP COLUMN IF EXISTS accepted,
              DROP COLUMN IF EXISTS accepted_at,    DROP COLUMN IF EXISTS price_ref,
              DROP COLUMN IF EXISTS price_current,  DROP COLUMN IF EXISTS unit,
              DROP COLUMN IF EXISTS status,         DROP COLUMN IF EXISTS adjusted_by,
              DROP COLUMN IF EXISTS decline_reason, DROP COLUMN IF EXISTS decline_note,
              DROP COLUMN IF EXISTS next_action_by, DROP COLUMN IF EXISTS metadata;
            ALTER TABLE ${s}.message_items
              ADD CONSTRAINT message_items_project_item_id_fkey
              FOREIGN KEY (project_item_id) REFERENCES ${s}.project_items(id) ON DELETE CASCADE;

            -- Audit satellites repoint message_items(id) → project_items(id).
            ALTER TABLE ${s}.message_item_events
              DROP CONSTRAINT IF EXISTS message_item_events_message_item_id_fkey;
            ALTER TABLE ${s}.message_item_events RENAME COLUMN message_item_id TO project_item_id;
            ALTER TABLE ${s}.message_item_events
              ADD CONSTRAINT message_item_events_project_item_id_fkey
              FOREIGN KEY (project_item_id) REFERENCES ${s}.project_items(id) ON DELETE CASCADE;

            ALTER TABLE ${s}.message_item_decisions
              DROP CONSTRAINT IF EXISTS message_item_decisions_message_item_id_fkey;
            ALTER TABLE ${s}.message_item_decisions RENAME COLUMN message_item_id TO project_item_id;
            ALTER TABLE ${s}.message_item_decisions
              ADD CONSTRAINT message_item_decisions_project_item_id_fkey
              FOREIGN KEY (project_item_id) REFERENCES ${s}.project_items(id) ON DELETE CASCADE;
          END IF;
        END
        $unify$;
      `);
    }
    console.log('  pV2-UNIFY-01: project_items unified (message_items → tag join).');

    // ── 10. RLS / grant hardening (v1.65gZ27) ────────────────────────────
    // Supabase Linter flagged public-schema tables as RLS-disabled +
    // anon-grantable (rls_disabled_in_public + sensitive_columns_exposed).
    // Our app doesn't use PostgREST — supabaseAnonKey is empty in every
    // environment.*.ts and all DB access goes through Express using the
    // postgres connection string. So we can safely:
    //   (a) revoke anon / authenticated grants on public/preview/master/marketing
    //   (b) revoke default privileges so future tables don't regrant
    //   (c) enable RLS on every existing table
    // Postgres owner-bypass means our server still has full access.
    // Idempotent — re-running writes the same state back.
    //
    // `marketing` is included (TECH-DEBT-01 ride-along): section 8 above leaves
    // advisory anon INSERT/SELECT policies on its tables, but the grants were
    // never revoked, so the guestlist_signup PII would be anon-reachable the
    // moment PostgREST/anon access is ever enabled. Revoking here closes that
    // latent gap; the public welcome page is unaffected (it reads/inserts via
    // Express on the owner connection, not anon). If anon access is ever turned
    // on, the public welcome path must be re-granted explicitly.
    console.log('  Hardening RLS + grants on public/preview/master/marketing...');
    for (const schema of ['public', 'preview', 'master', 'marketing']) {
      await client.query(`REVOKE USAGE ON SCHEMA ${schema} FROM anon, authenticated`);
      await client.query(`REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA ${schema} FROM anon, authenticated`);
      await client.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${schema} FROM anon, authenticated`);
      await client.query(`REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${schema} FROM anon, authenticated`);
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON TABLES    FROM anon, authenticated`);
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON SEQUENCES FROM anon, authenticated`);
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON FUNCTIONS FROM anon, authenticated`);
      await client.query(`
        DO $do$
        DECLARE r RECORD;
        BEGIN
          FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = '${schema}'
          LOOP
            EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
                           '${schema}', r.tablename);
          END LOOP;
        END
        $do$;
      `);
    }
    console.log('  v1.65gZ27 RLS + grant hardening applied.');

    // ── Items convergence backfill (v1.68b) — ONE-TIME, per schema ──────
    // Before the hide-vs-delete split, the ONLY operation that set
    // items.is_active=false was the old soft-delete. After the split,
    // is_active=false means "hidden" (reversible) and deleted_at means
    // "deleted" — and the two are INDISTINGUISHABLE by column values
    // (both are is_active=false / deleted_at IS NULL for a hidden item).
    // So reclassifying legacy is_active=false rows to deleted_at MUST run
    // exactly once per schema: a blind re-run of the UPDATE would
    // soft-delete legitimately-hidden items. Guarded by a marker in
    // shared.migration_flags, plus a deleted_at column-exists check (the
    // 6 audit columns are added by the Item 1 audit migration, which may
    // run after this script on a fresh build — skip cleanly until then).
    // Production note: master is empty today, so the UPDATE is a no-op
    // there; the marker still records it so the rule is encoded for any
    // future env that inherits the old convention.
    await client.query(`
      CREATE TABLE IF NOT EXISTS shared.migration_flags (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (
                SELECT 1 FROM information_schema.columns
                 WHERE table_schema = '${schema}' AND table_name = 'items'
                   AND column_name = 'deleted_at')
             AND NOT EXISTS (
                SELECT 1 FROM shared.migration_flags
                 WHERE name = 'items_is_active_to_deleted_at:${schema}')
          THEN
            UPDATE ${schema}.items
               SET deleted_at = NOW()
             WHERE is_active = false AND deleted_at IS NULL;
            INSERT INTO shared.migration_flags (name)
              VALUES ('items_is_active_to_deleted_at:${schema}');
          END IF;
        END $$;
      `);
    }
    console.log('  items is_active=false → deleted_at backfill applied (once per schema, guarded).');

    // ─────────────────────────────────────────────────────────────────
    // v2.03a (pV2-01e) — bp_brand_config: key/value brand registry read
    // by client-v2's BrandConfigService via GET /api/brand (public). The
    // values land on the --bp-* CSS tokens at client bootstrap, so brand
    // font / gradient / text color are DB-changeable without a redeploy.
    // Config registry: rows never go away → no deleted_at (per the
    // WORKING_STANDARDS registry exemption). Seeded with the pV2-01f
    // vivid brand values (matches client-v2/styles.css fallbacks — no
    // visual change on first load).
    // ─────────────────────────────────────────────────────────────────
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.bp_brand_config (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by UUID,
          updated_by UUID
        );
      `);
      await client.query(`
        INSERT INTO ${schema}.bp_brand_config (key, value) VALUES
          ('font_pair',  'ui-sans-serif, system-ui, -apple-system, ''Segoe UI'', Roboto, sans-serif'),
          ('gradient',   'linear-gradient(135deg, #d63384 0%, #16a34a 100%)'),
          ('text_color', '#1f2937')
        ON CONFLICT (key) DO NOTHING;
      `);
    }
    console.log('  bp_brand_config table + seeds installed (v2.03a, all schemas).');

    // ─────────────────────────────────────────────────────────────────
    // v2.04a (pV2-02) — auth: users reshape + user_orgs membership.
    // The v1 `users` table ALREADY EXISTS (id/org_id/name/email/role/…),
    // so the reshape is ADDITIVE — new columns only, v1 rows + reads
    // untouched (criterion: v1 on 4200 keeps working). New columns:
    //   · google_sub  — Google's stable subject id. NULLABLE (dev-seed
    //     users have none — the prompt's NOT NULL contradicts its own
    //     seed spec); uniqueness via partial index WHERE NOT NULL.
    //   · display_name, default_org_id — per the auth plan.
    // user_orgs = role-per-membership (is_admin flag; effective role is
    // derived from (orgs.type, is_admin) at session time). Soft-delete
    // cols kept — richer membership, not a pure FK junction.
    // ─────────────────────────────────────────────────────────────────
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS google_sub TEXT;
        ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS display_name TEXT;
        ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS default_org_id UUID;
      `);
      // preview/master users predate the audit sweep — ensure the 6 audit
      // cols (incl. deleted_at, referenced by the email index) exist first.
      await client.query(`SELECT audit.add_audit_columns('${schema}', 'users')`);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uidx
          ON ${schema}.users (google_sub)
          WHERE google_sub IS NOT NULL AND deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS users_email_uidx
          ON ${schema}.users (lower(email)) WHERE deleted_at IS NULL;
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.user_orgs (
          user_id   UUID NOT NULL REFERENCES ${schema}.users(id),
          org_id    UUID NOT NULL REFERENCES ${schema}.orgs(id),
          is_admin  BOOLEAN NOT NULL DEFAULT false,
          job_title TEXT,
          status    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended')),
          invited_by_user_id UUID REFERENCES ${schema}.users(id),
          invited_at TIMESTAMPTZ,
          joined_at  TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ,
          created_by UUID,
          updated_by UUID,
          deleted_by UUID,
          PRIMARY KEY (user_id, org_id)
        );
        CREATE INDEX IF NOT EXISTS user_orgs_user_id_idx ON ${schema}.user_orgs (user_id);
        CREATE INDEX IF NOT EXISTS user_orgs_org_id_idx  ON ${schema}.user_orgs (org_id);
      `);
      // Audit stamping + hard-delete guard via the universal helper.
      await client.query(`SELECT audit.add_audit_columns('${schema}', 'user_orgs')`);
    }
    console.log('  users reshape (google_sub/display_name/default_org_id) + user_orgs installed (v2.04a, all schemas).');

    // ─────────────────────────────────────────────────────────────────
    // v2.07a (pV2-02b QC) — users: free soft-deleted identifiers for
    // re-signup.
    // A soft-deleted users row still occupied its email (legacy
    // NON-partial users_email_key constraint, pre-dates soft-delete) and
    // google_sub (the v2.04a index above originally shipped without a
    // deleted_at filter), so upsertUserFromGoogle step 3's INSERT hit a
    // unique violation and the OAuth callback 500'd — a soft-deleted
    // user could never sign up again (caught in pV2-02b QC). Fix: drop
    // users_email_key (live-row uniqueness is still enforced — and
    // case-insensitively, which the old constraint wasn't — by
    // users_email_uidx) and rebuild users_google_sub_uidx with the
    // deleted_at IS NULL predicate; the v2.04a CREATE above now carries
    // the same shape for fresh databases. Deliberately NOT
    // tombstone-scrubbing (renaming email / nulling google_sub on
    // delete): the partial indexes free the identifiers while the
    // tombstone keeps its real values for audit. Idempotent — the
    // conditional drop fires only while the old index shape exists; the
    // drop + recreate run in one client.query() call, so they share one
    // implicit transaction and uniqueness never has a gap. The only
    // consumer of users_email_key was seed-v1.65e9-persona-users.js's
    // ON CONFLICT (email) — repointed at users_email_uidx in the same
    // commit.
    // ─────────────────────────────────────────────────────────────────
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        ALTER TABLE ${schema}.users DROP CONSTRAINT IF EXISTS users_email_key;
        DO $fix$ BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_indexes
             WHERE schemaname = '${schema}' AND tablename = 'users'
               AND indexname = 'users_google_sub_uidx'
               AND indexdef NOT LIKE '%deleted_at IS NULL%'
          ) THEN
            EXECUTE 'DROP INDEX ${schema}.users_google_sub_uidx';
          END IF;
        END $fix$;
        CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uidx
          ON ${schema}.users (google_sub)
          WHERE google_sub IS NOT NULL AND deleted_at IS NULL;
      `);
    }
    console.log('  users re-signup unblock: users_email_key dropped; google_sub uidx rebuilt with deleted_at filter (v2.07a QC fix, all schemas).');

    // ─────────────────────────────────────────────────────────────────
    // v2.09c (pV2-04b) — org_type_config: per-org_type page-settings
    // payload (JSONB). The p0021 migration file existed in database/ but
    // was NEVER applied — ConfigService has been degrading to {} via its
    // 42P01 catch since p0021 (v1 page settings silently rode
    // localStorage). org_type uses the v2 vocabulary ('ballpark', not
    // legacy 'admin'); the service normalises v1's 'admin' to 'ballpark'
    // at the boundary so both apps share one row. v2 home config nests
    // under payload.v2Home so v1's flat payload fields are never
    // clobbered by v2 writes (and vice versa). Full audit columns per
    // the universal standard.
    // ─────────────────────────────────────────────────────────────────
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.org_type_config (
          org_type   TEXT PRIMARY KEY
                       CHECK (org_type IN ('agency', 'supplier', 'ballpark')),
          payload    JSONB       NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by UUID,
          updated_by UUID,
          deleted_at TIMESTAMPTZ,
          deleted_by UUID
        );
      `);
      await client.query(`
        INSERT INTO ${schema}.org_type_config (org_type, payload) VALUES
          ('agency', '{}'::jsonb), ('supplier', '{}'::jsonb), ('ballpark', '{}'::jsonb)
        ON CONFLICT (org_type) DO NOTHING;
      `);
      // Universal audit triggers (stamp + forbid-hard-delete) when the audit
      // helper is installed in this database.
      await client.query(`
        DO $audit$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'audit' AND p.proname = 'add_audit_columns'
          ) THEN
            PERFORM audit.add_audit_columns('${schema}', 'org_type_config');
          END IF;
        END $audit$;
      `);
    }
    console.log('  org_type_config installed + seeded (v2.09c — p0021 migration finally applied, all schemas).');

    // ── pV2-06-subcats (v2.16b) — taxonomy browse indexes ─────────────────
    // chat audit (RP-01 continuation): GET /categories/:id/subcategories
    // filters WHERE parent_id = ? (seq-scan without this — Liam's
    // "very slow first time" on the subcat strip), and the items count
    // joins through items.subcategory_id. Partial indexes keep them tight.
    // Guarded per schema/table/column — preview/master carry older table
    // shapes (some lack deleted_at); index only where the columns exist.
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        DO $idx$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = '${schema}' AND table_name = 'categories'
                        AND column_name = 'deleted_at')
             AND EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = '${schema}' AND table_name = 'categories'
                        AND column_name = 'parent_id') THEN
            CREATE INDEX IF NOT EXISTS ${schema}_categories_parent_id_idx
              ON ${schema}.categories (parent_id) WHERE deleted_at IS NULL;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = '${schema}' AND table_name = 'items'
                        AND column_name = 'deleted_at')
             AND EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = '${schema}' AND table_name = 'items'
                        AND column_name = 'subcategory_id') THEN
            CREATE INDEX IF NOT EXISTS ${schema}_items_subcategory_id_idx
              ON ${schema}.items (subcategory_id) WHERE deleted_at IS NULL;
          END IF;
        END $idx$;
      `);
    }
    console.log('  taxonomy browse indexes installed (v2.16b — categories.parent_id + items.subcategory_id, all schemas).');

    // ── 4f. pV2-CODELISTS-01 — RC/RCV split + the locked 12-list seed ────
    // Table rename happened in section 4b (before the idempotent create).
    // The inventory + meta + three-layer integrity posture live in
    // db/codelists-seed.js (reviewable without scrolling this file).
    console.log('  Seeding reference codelists (pV2-CODELISTS-01)...');
    const { seedCodelists } = require('./codelists-seed');
    const parentCount = await seedCodelists(client);
    console.log(`  reference_codelists installed — ${parentCount} parents seeded, default invariant asserted (v2.18a).`);

    // ── pV2-BUILDUP-01 (step 1) — recursive line-item buildup: additive columns.
    // `kind` classifies a catalogue item (component / product / option) and a
    // project line (cost-part / option / plain). `parent_id` nests one project
    // line under another (Sofa → Woodwork; Family Room → sections). All nullable
    // and UNUSED until the buildup logic lands — pure additive, zero behaviour
    // change. The key-constraint relax that lets the same item appear twice is a
    // SEPARATE step (not here) — it carries the only regression risk.
    for (const s of ['public', 'preview', 'master']) {
      await client.query(`
        ALTER TABLE ${s}.items         ADD COLUMN IF NOT EXISTS kind      VARCHAR(20);
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS kind      VARCHAR(20);
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES ${s}.project_items(id);
        CREATE INDEX IF NOT EXISTS ix_project_items_parent ON ${s}.project_items(parent_id);
      `);
    }
    console.log('  pV2-BUILDUP-01 columns installed (items.kind, project_items.kind + parent_id, all schemas).');

    // ── pV2-BUILDUP-02 (Customize) — the supplier's line-level margin. Saved on
    // the parent (per-supplier) line so re-opening the Customize estimate shows
    // the same margin; seeds from the org default on a fresh line. Nullable,
    // additive — NULL means "not set, fall back to the org default".
    for (const s of ['public', 'preview', 'master']) {
      await client.query(`
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS margin_pct NUMERIC(5,2);
      `);
    }
    console.log('  pV2-BUILDUP-02 column installed (project_items.margin_pct, all schemas).');

    // ── pV2-BUILDUP-03 (item options) — a picked option links to the parent
    // quote line it belongs to, so the Final Quote nests it under that item and
    // the item card lists it. Distinct from parent_id (the private cost-buildup
    // children, excluded from totals): an option is a visible, counted line.
    // Nullable, additive — NULL means a standalone line, not an option.
    for (const s of ['public', 'preview', 'master']) {
      await client.query(`
        ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS option_of_line_id UUID REFERENCES ${s}.project_items(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS ix_project_items_option_of_line
          ON ${s}.project_items(option_of_line_id) WHERE option_of_line_id IS NOT NULL;
      `);
    }
    console.log('  pV2-BUILDUP-03 column installed (project_items.option_of_line_id, all schemas).');

    // ── pV2-BUILDUP-04 (Details) — a clean free-text (markdown) field on the
    // line, like Description/Services. Nullable, additive.
    for (const s of ['public', 'preview', 'master']) {
      await client.query(`ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS details TEXT;`);
      // The AGENT's client-facing line description (Quote document). Agent-owned
      // on any line; defaults to the supplier text when NULL. Nullable, additive.
      await client.query(`ALTER TABLE ${s}.project_items ADD COLUMN IF NOT EXISTS quote_description TEXT;`);
      // Quote document options (per project): colour theme + footer text. All
      // nullable/additive; NULL = the house default ('default' theme, "Excludes VAT.").
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS quote_theme_mode TEXT;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS quote_theme_color TEXT;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS quote_footer TEXT;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS quote_show_created BOOLEAN;`);
      // Quote document show/hide toggles. NULL = house default: ON for all
      // except page_numbers (OFF; the PDF tool renders those).
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS quote_show_vat_note BOOLEAN;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS quote_show_page_numbers BOOLEAN;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS quote_show_item_desc BOOLEAN;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS quote_show_overview BOOLEAN;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS quote_show_summary BOOLEAN;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS quote_show_ref BOOLEAN;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS quote_show_address BOOLEAN;`);
      // The agency's standard Terms & Conditions PDF (SOW Annex A), org-level.
      await client.query(`ALTER TABLE ${s}.orgs ADD COLUMN IF NOT EXISTS terms_pdf_url TEXT;`);
      // SOW parties — the agency's company number + the client's company number
      // and address (Buyer details). All nullable/additive.
      await client.query(`ALTER TABLE ${s}.orgs ADD COLUMN IF NOT EXISTS company_number TEXT;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS client_company_number TEXT;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS client_address TEXT;`);
      // SOW content sections (free-text markdown) — timeline / payment / special.
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS sow_timeline TEXT;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS sow_payment_terms TEXT;`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS sow_special_terms TEXT;`);
      // Insurance is a % of project costs (default_insurance_amount was an earlier
      // fixed-£ take, left dormant.)
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS default_insurance_pct NUMERIC(5,2);`);
      await client.query(`ALTER TABLE ${s}.orgs     ADD COLUMN IF NOT EXISTS default_insurance_pct NUMERIC(5,2);`);
      await client.query(`ALTER TABLE ${s}.projects ADD COLUMN IF NOT EXISTS default_insurance_amount NUMERIC(12,2);`);
      await client.query(`ALTER TABLE ${s}.orgs     ADD COLUMN IF NOT EXISTS default_insurance_amount NUMERIC(12,2);`);
    }
    console.log('  pV2-BUILDUP-04 columns installed (project_items.details + quote_description, projects/orgs insurance defaults, all schemas).');

    console.log('\n✅ Schema setup complete.');
    console.log('   public  → dev  (existing data unchanged)');
    console.log('   preview → run npm run db:seed:preview to populate');
    console.log('   master  → empty, ready for production');
    console.log('   shared  → ready for backlog/bugs/flags');

  } catch (err) {
    console.error('Schema migration failed:', err.message);
    throw err;
  } finally {
    await client.end();
  }
};

migrate().catch(err => { console.error('Fatal:', err); process.exit(1); });
