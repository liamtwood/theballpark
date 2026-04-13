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
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS preview;
      CREATE SCHEMA IF NOT EXISTS master;
      CREATE SCHEMA IF NOT EXISTS shared;
    `);
    console.log('  Schemas created: preview, master, shared');

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
      CREATE TABLE IF NOT EXISTS preview.estimate_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        estimate_id UUID REFERENCES preview.estimates(id) ON DELETE CASCADE,
        project_category_id UUID REFERENCES preview.project_categories(id),
        item_id UUID REFERENCES preview.items(id),
        name VARCHAR(255),
        description TEXT,
        unit VARCHAR(50),
        quantity NUMERIC(10,2) DEFAULT 1,
        unit_price NUMERIC(12,2) DEFAULT 0,
        total_price NUMERIC(12,2) DEFAULT 0,
        supplier_org_id UUID REFERENCES preview.orgs(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

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
      CREATE TABLE IF NOT EXISTS master.messages           (LIKE preview.messages           INCLUDING ALL);
      CREATE TABLE IF NOT EXISTS master.balls_transactions (LIKE preview.balls_transactions INCLUDING ALL);
    `);
    console.log('  Master schema tables created.');

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
    `);
    console.log('  Shared schema tables created.');

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
