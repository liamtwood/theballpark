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

      -- v1.29: projects.currency — ISO-4217 code (drives Event drawer
      -- Currency dropdown via shared.codelists list_name='currency').
      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS currency      VARCHAR(10) DEFAULT 'GBP';
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS currency      VARCHAR(10) DEFAULT 'GBP';
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS currency      VARCHAR(10) DEFAULT 'GBP';

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

      ALTER TABLE public.projects  ADD COLUMN IF NOT EXISTS ref VARCHAR(20);
      ALTER TABLE preview.projects ADD COLUMN IF NOT EXISTS ref VARCHAR(20);
      ALTER TABLE master.projects  ADD COLUMN IF NOT EXISTS ref VARCHAR(20);

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

      -- v1.40: three new catalogue categories required by the full
      -- subcategory taxonomy.
      --   Set Build         — scenic, dressing, theming (distinct
      --                       from Stand Structure which is the
      --                       physical build)
      --   Event Accessories — red carpets, gift bags, lanyards,
      --                       scent design, etc.
      --   Other             — PM fees, contingency, design fees and
      --                       other admin lines that don't fit a
      --                       supplier category.
      INSERT INTO public.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Set Build', 'Scenic painting, props, theming, set dressing and window displays.',
             'Paintbrush', 13, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM public.categories
         WHERE name = 'Set Build' AND namespace = 'catalogue' AND parent_id IS NULL
      );
      INSERT INTO preview.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Set Build', 'Scenic painting, props, theming, set dressing and window displays.',
             'Paintbrush', 13, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM preview.categories
         WHERE name = 'Set Build' AND namespace = 'catalogue' AND parent_id IS NULL
      );
      INSERT INTO master.categories (name, description, icon, sort_order, namespace, parent_id)
      SELECT 'Set Build', 'Scenic painting, props, theming, set dressing and window displays.',
             'Paintbrush', 13, 'catalogue', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM master.categories
         WHERE name = 'Set Build' AND namespace = 'catalogue' AND parent_id IS NULL
      );

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

    // v1.40: ensure tag table exists in preview + master. It was
    // created in public via a one-off migration (migration_category_tags
    // .sql) but never carried across. Mirror the public schema exactly
    // so the same INSERTs below work uniformly.
    for (const schema of ['preview', 'master']) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.tag (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          category_id UUID NOT NULL REFERENCES ${schema}.categories(id) ON DELETE CASCADE,
          label       TEXT NOT NULL,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ${schema}_tag_category_id_label_key
          ON ${schema}.tag (category_id, label);
      `);
    }

    // v1.40: seed the complete subcategory taxonomy. ~140 tags across
    // 17 catalogue groupings. Idempotent — `ON CONFLICT (category_id,
    // label) DO NOTHING` thanks to the unique constraint on
    // (category_id, label). Lookup is by category name so the same
    // SQL works across public/preview/master (UUIDs differ per schema).
    //
    // Mapping decisions (Liam, v1.40 brief):
    //   - "Set Build" → new category (NOT Stand Structure)
    //   - "Talent & Staffing" tags → existing "Staffing" (no rename)
    //   - "Photography & Content" tags → existing "Photography"
    //   - "Event Accessories" → new category
    //   - "Venues" tags → existing "Venue" (singular)
    //   - "Other" → new category
    //   - Construction & Build left as-is (its 5 existing tags untouched)
    //
    // No dedupe — if a label already exists with slight variation
    // (e.g. "Outdoor Structures" vs "Outdoor Structure") both stay.
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
    // Render the VALUES list once. Single-quotes need doubling for SQL.
    const valuesSql = TAXONOMY
      .map(([cat, label, ord]) => `(${"'"}${cat.replace(/'/g, "''")}${"'"}, ${"'"}${label.replace(/'/g, "''")}${"'"}, ${ord})`)
      .join(',\n        ');
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        WITH src(cat_name, label, sort_order) AS (
          VALUES
            ${valuesSql}
        )
        INSERT INTO ${schema}.tag (category_id, label, sort_order)
        SELECT c.id, src.label, src.sort_order
          FROM src
          JOIN ${schema}.categories c
            ON c.name = src.cat_name
           AND c.namespace = 'catalogue'
           AND c.parent_id IS NULL
        ON CONFLICT (category_id, label) DO NOTHING;
      `);
    }
    console.log('  items columns ensured (time_unit, derived_from_id, parent_item_id, attributes, images).');
    console.log('  estimate_items drift reconciled (drop unit + is_active; add shortlisted + status_id).');
    console.log('  estimate_items v1.13 columns ensured (offer_price + 9 deal/approval fields).');
    console.log('  project_items table + unique index ensured.');
    console.log('  orgs.auto_publish_items ensured.');
    console.log('  orgs.ref_prefix + ref_counter and projects.ref ensured (v1.39).');
    console.log('  Photography catalogue category ensured (v1.39f).');
    console.log('  Set Build / Event Accessories / Other catalogue categories ensured (v1.40).');
    console.log(`  Subcategory taxonomy seeded — ${TAXONOMY.length} tags × 3 schemas (v1.40).`);

    // ─────────────────────────────────────────────────────────────────
    // v1.41 — promote the TAXONOMY labels into CHILD CATEGORY rows so
    // the categories table is the canonical subcategory source (the
    // two-field model on items uses categories.parent_id, not the tag
    // table). Tag table stays seeded for a future use.
    //
    // Idempotent: only inserts labels that don't already exist as a
    // child of the same parent. Preserves the 27 existing Catering
    // children (Working Lunch, Canapes, etc.) — they coexist with
    // the new ones from the taxonomy.
    // ─────────────────────────────────────────────────────────────────
    for (const schema of ['public', 'preview', 'master']) {
      await client.query(`
        WITH src(cat_name, label, sort_order) AS (
          VALUES
            ${valuesSql}
        )
        INSERT INTO ${schema}.categories (name, parent_id, sort_order, namespace, icon, icon_name)
        SELECT src.label, p.id, src.sort_order, 'catalogue', NULL, NULL
          FROM src
          JOIN ${schema}.categories p
            ON p.name = src.cat_name
           AND p.namespace = 'catalogue'
           AND p.parent_id IS NULL
         WHERE NOT EXISTS (
            SELECT 1 FROM ${schema}.categories c
             WHERE c.name = src.label
               AND c.parent_id = p.id
         );
      `);
    }
    console.log('  Child categories promoted from taxonomy (v1.41).');

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

      -- Codelists — shared key/value lookup table for platform-wide reference
      -- data (item units, time units, future: event_type, tier, visibility).
      CREATE TABLE IF NOT EXISTS shared.codelists (
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

      INSERT INTO shared.codelists (list_name, code, label, symbol, sort_order, is_system) VALUES
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
      INSERT INTO shared.codelists (list_name, code, label, sort_order, meta, is_system) VALUES
        ('project_status', 'draft',     'Draft',     1, '{"color":"#F59E0B"}'::jsonb, true),
        ('project_status', 'active',    'Active',    2, '{"color":"#10B981"}'::jsonb, true),
        ('project_status', 'completed', 'Completed', 3, '{"color":"#6B7280"}'::jsonb, true),
        ('project_status', 'archived',  'Archived',  4, '{"color":"#9CA3AF"}'::jsonb, true)
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
      -- Guestlist signups from /welcome
      CREATE TABLE IF NOT EXISTS marketing.guestlist_signup (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        TEXT NOT NULL,
        email       TEXT NOT NULL,
        company     TEXT,
        role        TEXT NOT NULL,
        ip_address  TEXT,
        user_agent  TEXT,
        notified_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS guestlist_signup_email_uniq
        ON marketing.guestlist_signup (lower(email));
      CREATE INDEX IF NOT EXISTS guestlist_signup_created_idx
        ON marketing.guestlist_signup (created_at DESC);

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
    const SEED_CONTENT = [
      // Slide 1 — Hero
      ['hero.eyebrow',           'text',     'Coming soon · Event production reimagined', 'Eyebrow tag',  null, 1, 10],
      ['hero.headline',           'longtext', 'REAL COSTS,\nREAL FAST.',                   'Headline',     'Use \\n for line breaks', 1, 20],
      ['hero.subtitle',           'longtext', 'Turn your event brief into an accurate estimate in moments.', 'Subtitle', null, 1, 30],

      // Slide 2 — Suppliers
      ['suppliers.eyebrow',       'text',     'The network',                                                       'Eyebrow tag', null, 2, 10],
      ['suppliers.headline',      'longtext', 'Powered by real costs from our network of incredible suppliers.',   'Headline',    null, 2, 20],
      ['suppliers.categories',    'list',     'DESIGN,BUILD,VENUES,FURNITURE,AV,GRAPHICS,CATERING',                'Categories (marquee)', 'Comma-separated. Order = marquee order.', 2, 30],

      // Slide 3 — Producers
      ['producers.headline',      'longtext', "A PRODUCER'S BEST FRIEND.",                                                 'Headline', null, 3, 10],
      ['producers.tagline',       'text',     'By producers, for creators.',                                                'Italic tagline', null, 3, 20],
      ['producers.body_1',        'longtext', 'Costing events can be a grind. Endless quotes, supplier chasing, tight turnarounds.', 'Body paragraph 1', null, 3, 30],
      ['producers.body_2',        'longtext', 'Ballpark makes it easy. Instant, accurate costs. Incredible suppliers. Everything in one place.', 'Body paragraph 2', null, 3, 40],

      // Slide 4 — Guestlist
      ['guestlist.eyebrow',          'text',     'You made it',                                              'Eyebrow tag',     null, 4, 10],
      ['guestlist.headline',         'longtext', 'Those who get in early, get ahead.',                       'Headline',        null, 4, 20],
      ['guestlist.subtitle',         'longtext', "Get on the guestlist and the moment we're live you'll be the first to know.", 'Subtitle', null, 4, 30],
      ['guestlist.cta_label',        'text',     'Add me to the guestlist',                                  'Submit button label', null, 4, 40],
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
      'Company:  {{company}}',
      'Role:     {{role}}',
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
