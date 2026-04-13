const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const migrate = async () => {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    console.log('Running migrations...');

    await client.query(`
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Statuses
      CREATE TABLE IF NOT EXISTS statuses (
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
      CREATE TABLE IF NOT EXISTS orgs (
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
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES orgs(id),
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
      CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES orgs(id),
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
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Items (supplier catalogue)
      CREATE TABLE IF NOT EXISTS items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES orgs(id),
        category_id UUID REFERENCES categories(id),
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
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Projects
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES orgs(id),
        client_id UUID REFERENCES clients(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        event_name VARCHAR(255),
        event_date VARCHAR(255),
        venue_name VARCHAR(255),
        venue_city VARCHAR(255),
        venue_address TEXT,
        guest_count INTEGER,
        stand_size VARCHAR(20) CHECK (stand_size IN ('small', 'medium', 'large', 'xl', 'custom')),
        stand_width_m NUMERIC(6,2),
        stand_depth_m NUMERIC(6,2),
        stand_type VARCHAR(20) CHECK (stand_type IN ('shell_scheme', 'space_only')),
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
        tier VARCHAR(20) CHECK (tier IN ('starter', 'professional', 'premium')),
        status_id UUID REFERENCES statuses(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Project Categories
      CREATE TABLE IF NOT EXISTS project_categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        category_id UUID REFERENCES categories(id),
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
        status_id UUID REFERENCES statuses(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Estimates
      CREATE TABLE IF NOT EXISTS estimates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255),
        description TEXT,
        version INTEGER DEFAULT 1,
        total_value NUMERIC(12,2) DEFAULT 0,
        balls_cost INTEGER DEFAULT 1,
        status_id UUID REFERENCES statuses(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Estimate Items
      CREATE TABLE IF NOT EXISTS estimate_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
        project_category_id UUID REFERENCES project_categories(id),
        item_id UUID REFERENCES items(id),
        name VARCHAR(255),
        description TEXT,
        quantity NUMERIC(10,2) DEFAULT 1,
        unit_price NUMERIC(12,2) DEFAULT 0,
        total_price NUMERIC(12,2) DEFAULT 0,
        supplier_org_id UUID REFERENCES orgs(id),
        shortlisted BOOLEAN DEFAULT false,
        status_id UUID REFERENCES statuses(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Messages
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        supplier_org_id UUID REFERENCES orgs(id),
        estimate_item_id UUID REFERENCES estimate_items(id),
        subject VARCHAR(255),
        body TEXT,
        direction VARCHAR(20) CHECK (direction IN ('inbound', 'outbound')),
        status_id UUID REFERENCES statuses(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );

      -- Balls Transactions
      CREATE TABLE IF NOT EXISTS balls_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES orgs(id),
        project_id UUID REFERENCES projects(id),
        estimate_id UUID REFERENCES estimates(id),
        supplier_org_id UUID REFERENCES orgs(id),
        user_id UUID REFERENCES users(id),
        amount INTEGER NOT NULL,
        direction VARCHAR(20) NOT NULL CHECK (direction IN ('credit', 'debit')),
        reason VARCHAR(20) NOT NULL CHECK (reason IN ('subscription', 'spend', 'referral', 'refund', 'bonus')),
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID
      );

      -- Add image columns to projects
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_logo_url TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS card_color VARCHAR(20);

      -- Add cover image column to orgs (suppliers)
      ALTER TABLE orgs ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
      ALTER TABLE orgs ADD COLUMN IF NOT EXISTS image_display VARCHAR(10) DEFAULT 'cover';

      -- Add image_display to items
      ALTER TABLE items ADD COLUMN IF NOT EXISTS image_display VARCHAR(10) DEFAULT 'cover';

      -- Add image/config columns to categories
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS card_color VARCHAR(20);
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS tags TEXT[];
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;

      -- Namespace + hierarchy columns for categories
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS namespace VARCHAR(20) DEFAULT 'catalogue';
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id);
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS tagline VARCHAR(255);
    `);

    console.log('All tables created successfully.');

    // ── Seed feedback categories (idempotent) ────────────────────────────
    const feedbackParents = [
      { name: 'Bug', tagline: "Something isn't working", description: 'Log anything broken, inconsistent or behaving unexpectedly. No detail too small.', tags: '{UI Glitch,Data Issue,Performance,Crash}', sort: 0, children: ['UI Glitch', 'Data Issue', 'Performance', 'Crash'] },
      { name: 'Enhancement', tagline: 'Make it better', description: 'Feature requests, improvements and nice-to-haves. How should Ballpark work better for you?', tags: '{Feature Request,Improvement,Nice to Have}', sort: 1, children: ['Feature Request', 'Improvement', 'Nice to Have'] },
      { name: 'Question', tagline: 'Something we need to discuss', description: 'Open questions about the product, process or pricing. Log it here and we\'ll work through it together.', tags: '{Product Question,Pricing Question,Process Question}', sort: 2, children: ['Product Question', 'Pricing Question', 'Process Question', 'Technical Question'] },
      { name: 'Prompt', tagline: 'A requirement or instruction for the build', description: 'Capture specific requirements, design directions and build instructions directly from the session.', tags: '{Requirement,Instruction,Design Direction}', sort: 3, children: ['Requirement', 'Instruction', 'Design Direction'] }
    ];
    for (const fp of feedbackParents) {
      const r = await client.query(
        `INSERT INTO categories (name, tagline, description, tags, sort_order, namespace)
         SELECT $1, $2, $3, $4::text[], $5, 'feedback'
         WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = $1 AND namespace = 'feedback' AND parent_id IS NULL)
         RETURNING id`,
        [fp.name, fp.tagline, fp.description, fp.tags, fp.sort]
      );
      if (r.rows.length) {
        const parentId = r.rows[0].id;
        for (let i = 0; i < fp.children.length; i++) {
          await client.query(
            `INSERT INTO categories (name, parent_id, sort_order, namespace)
             SELECT $1, $2, $3, 'feedback'
             WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = $1 AND parent_id = $2 AND namespace = 'feedback')`,
            [fp.children[i], parentId, i]
          );
        }
      }
    }
    console.log('Feedback categories ensured.');

  } catch (err) {
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    await client.end();
  }
};

migrate().catch((err) => { console.error('Fatal:', err); process.exit(1); });
