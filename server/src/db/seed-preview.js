/**
 * Ballpark — Preview Schema Seed
 * 
 * Populates the preview schema with clean, curated demo data
 * for stakeholder demos (Beth Pizey, Megan Goodwin).
 * 
 * Completely separate from public (dev) data.
 * Safe to re-run — truncates preview tables first.
 * 
 * Usage:
 *   node server/src/db/seed-preview.js
 */

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const seed = async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    await client.query('BEGIN');
    console.log('Seeding preview schema...');

    // ── Clear existing preview data ──────────────────────────────────────
    await client.query(`
      TRUNCATE preview.balls_transactions, preview.messages, preview.estimate_items,
               preview.estimates, preview.project_categories, preview.projects,
               preview.items, preview.categories, preview.clients,
               preview.users, preview.orgs, preview.statuses
      RESTART IDENTITY CASCADE;
    `);
    console.log('  Preview tables cleared.');

    // ── Statuses ─────────────────────────────────────────────────────────
    const statusRows = [
      ['project',          'draft',       'Draft',       '#6B7280', 0],
      ['project',          'active',      'Active',      '#3B82F6', 1],
      ['project',          'costing',     'Costing',     '#F59E0B', 2],
      ['project',          'completed',   'Completed',   '#10B981', 3],
      ['estimate',         'draft',       'Draft',       '#6B7280', 0],
      ['estimate',         'sent',        'Sent',        '#F59E0B', 1],
      ['estimate',         'accepted',    'Accepted',    '#10B981', 2],
      ['message',          'unread',      'Unread',      '#3B82F6', 0],
      ['message',          'read',        'Read',        '#6B7280', 1],
      ['project_category', 'pending',     'Pending',     '#6B7280', 0],
      ['project_category', 'in_progress', 'In Progress', '#F59E0B', 1],
      ['project_category', 'quoted',      'Quoted',      '#3B82F6', 2],
      ['project_category', 'confirmed',   'Confirmed',   '#10B981', 3],
    ];
    const statusIds = {};
    for (const [entity_type, name, label, color, sort_order] of statusRows) {
      const res = await client.query(
        `INSERT INTO preview.statuses (entity_type, name, label, color, sort_order)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [entity_type, name, label, color, sort_order]
      );
      statusIds[`${entity_type}_${name}`] = res.rows[0].id;
    }
    console.log('  Statuses seeded.');

    // ── Agency org ───────────────────────────────────────────────────────
    const agencyRes = await client.query(
      `INSERT INTO preview.orgs
         (name, description, type, address, city, country, phone, email, website,
          subscription_tier, balls_balance, balls_monthly_allowance,
          default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [
        'Apex Exhibition Planning',
        'Full-service exhibition design and event production agency specialising in UK and European trade shows.',
        'agency',
        '14 Great Marlborough Street',
        'London',
        'United Kingdom',
        '+44 20 7946 0958',
        'hello@apexexhibitions.co.uk',
        'https://www.apexexhibitions.co.uk',
        'agency', 25, 10, 20, true, 'GB 123 4567 89', 15, 5,
      ]
    );
    const agencyId = agencyRes.rows[0].id;

    // ── Supplier orgs ────────────────────────────────────────────────────
    const supplier1Res = await client.query(
      `INSERT INTO preview.orgs (name, type, city, country, subscription_tier, vat_registered)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Construct & Co.', 'supplier', 'London', 'United Kingdom', 'studio', true]
    );
    const supplier1Id = supplier1Res.rows[0].id;

    const supplier2Res = await client.query(
      `INSERT INTO preview.orgs (name, type, city, country, subscription_tier, vat_registered)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Volta AV London', 'supplier', 'London', 'United Kingdom', 'studio', true]
    );
    const supplier2Id = supplier2Res.rows[0].id;

    const supplier3Res = await client.query(
      `INSERT INTO preview.orgs (name, type, city, country, subscription_tier, vat_registered)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Greenhouse London', 'supplier', 'London', 'United Kingdom', 'starter', true]
    );
    const supplier3Id = supplier3Res.rows[0].id;
    console.log('  Orgs seeded.');

    // ── Users ────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO preview.users (org_id, name, email, role)
       VALUES ($1,$2,$3,$4)`,
      [agencyId, 'Sarah Mitchell', 'sarah@apexexhibitions.co.uk', 'admin']
    );
    await client.query(
      `INSERT INTO preview.users (org_id, name, email, role)
       VALUES ($1,$2,$3,$4)`,
      [agencyId, 'James Cooper', 'james@apexexhibitions.co.uk', 'member']
    );
    console.log('  Users seeded.');

    // ── Clients ──────────────────────────────────────────────────────────
    const client1Res = await client.query(
      `INSERT INTO preview.clients (org_id, name, contact_name, email)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [agencyId, 'TechVista Solutions', 'David Chen', 'david.chen@techvista.io']
    );
    const client1Id = client1Res.rows[0].id;

    const client2Res = await client.query(
      `INSERT INTO preview.clients (org_id, name, contact_name, email)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [agencyId, 'GreenLeaf Organics', 'Emma Whitfield', 'emma@greenleaforganics.co.uk']
    );
    const client2Id = client2Res.rows[0].id;
    console.log('  Clients seeded.');

    // ── Categories ───────────────────────────────────────────────────────
    const categoryData = [
      ['Stand Structure',      'Shell scheme, space-only and custom builds.',           'Warehouse',       0],
      ['Flooring',             'Carpet, vinyl, raised platforms.',                      'Grid3x3',         1],
      ['Lighting',             'Spotlights, LED strips, mood lighting.',                'Lightbulb',       2],
      ['AV & Technology',      'Screens, projectors, interactive displays.',            'Monitor',         3],
      ['Furniture & Fixtures', 'Seating, tables, counters, display units.',             'Armchair',        4],
      ['Graphics & Signage',   'Large-format print, fabric, 3D lettering.',             'Image',           5],
      ['Catering',             'On-stand catering, barista, drinks packages.',          'UtensilsCrossed', 6],
      ['Florals',              'Floral arrangements, plants, greenery.',                'Flower2',         7],
    ];
    const categoryIds = [];
    for (const [name, description, icon, sort_order] of categoryData) {
      const res = await client.query(
        `INSERT INTO preview.categories (name, description, icon, sort_order)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [name, description, icon, sort_order]
      );
      categoryIds.push(res.rows[0].id);
    }
    console.log('  Categories seeded.');

    // ── Feedback Categories (namespace = 'feedback') ─────────────────────
    // Flat model: folder types + issue types (level=0).
    const feedbackCategories = [
      { name: 'Minutes',     object_type: 'folder', tagline: 'Meeting notes and decisions',    description: 'Record meetings, decisions and follow-up actions.',       icon_name: 'calendar',      icon_color: 'var(--theme-bg)',        sort: 0 },
      { name: 'Sprint',      object_type: 'folder', tagline: 'Development sprint tracker',     description: 'Plan and track work across a development sprint.',        icon_name: 'zap',           icon_color: 'var(--theme-bg)',        sort: 1 },
      { name: 'Test Run',    object_type: 'folder', tagline: 'QA and testing sessions',        description: 'Record bugs and observations from a testing session.',    icon_name: 'flask-conical', icon_color: 'var(--theme-bg)',        sort: 2 },
      { name: 'Workshop',    object_type: 'folder', tagline: 'Working sessions and discovery', description: 'Capture outputs from workshops and working sessions.',    icon_name: 'users',         icon_color: 'var(--theme-bg)',        sort: 3 },
      { name: 'Note',        object_type: 'folder', tagline: 'General notes and documents',    description: 'A free-form note or reference document.',                 icon_name: 'file-text',     icon_color: 'var(--theme-bg)',        sort: 4 },
      { name: 'Bug',         object_type: 'issue',  tagline: 'Something is broken',            description: 'Log anything broken, inconsistent or behaving unexpectedly.', icon_name: 'bug',           icon_color: 'var(--color-danger-bg)', sort: 5 },
      { name: 'Enhancement', object_type: 'issue',  tagline: 'Make it better',                 description: 'Feature requests, improvements and nice-to-haves.',        icon_name: 'lightbulb',     icon_color: 'var(--theme-bg)',        sort: 6 },
      { name: 'Question',    object_type: 'issue',  tagline: 'Something to discuss',           description: 'Open questions about the product, process or pricing.',   icon_name: 'circle-help',   icon_color: 'var(--theme-bg)',        sort: 7 },
      { name: 'Prompt',      object_type: 'issue',  tagline: 'A requirement or instruction',   description: 'Capture specific requirements and build instructions.',   icon_name: 'clipboard-pen', icon_color: 'var(--theme-bg)',        sort: 8 }
    ];

    for (const fc of feedbackCategories) {
      await client.query(
        `INSERT INTO preview.categories
           (name, tagline, description, sort_order, namespace, object_type, icon_name, icon_color)
         VALUES ($1, $2, $3, $4, 'feedback', $5, $6, $7)`,
        [fc.name, fc.tagline, fc.description, fc.sort, fc.object_type, fc.icon_name, fc.icon_color]
      );
    }
    console.log('  Feedback categories seeded (9 flat folder/issue types).');

    // Backfill any existing preview feedback rows by type → category name
    await client.query(`
      UPDATE shared.feedback f SET category_id = c.id
      FROM preview.categories c
      WHERE c.namespace = 'feedback'
        AND c.parent_id IS NULL
        AND LOWER(c.name) = LOWER(f.type)
        AND (f.category_id IS NULL OR f.category_id <> c.id)
    `);

    // ── Projects ─────────────────────────────────────────────────────────
    const project1Res = await client.query(
      `INSERT INTO preview.projects
         (org_id, client_id, name, event_name, event_date, venue_name, venue_city,
          guest_count, project_budget, default_margin_pct, default_contingency_pct,
          default_vat_pct, tier, status_id, raw_brief_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [
        agencyId, client1Id,
        'TechVista — Money20/20',
        'Money20/20 Europe',
        'June 2026',
        'ExCeL London',
        'London',
        300,
        25000,
        15, 5, 20,
        'mid',
        statusIds['project_active'],
        'Hi, we need a 9×6m stand at Money20/20 Europe, ExCeL London, 3–5 June 2026. Around 300 attendees. Budget approx £25k. Custom build preferred, branded graphics throughout. We want a bold centrepiece with integrated screen capability and a meeting pod area.'
      ]
    );
    const project1Id = project1Res.rows[0].id;

    await client.query(
      `INSERT INTO preview.projects
         (org_id, client_id, name, event_name, event_date, venue_name, venue_city,
          guest_count, project_budget, default_margin_pct, default_contingency_pct,
          default_vat_pct, tier, status_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        agencyId, client2Id,
        'GreenLeaf — Natural & Organic',
        'Natural & Organic Products Europe',
        'April 2026',
        'Olympia London',
        'London',
        150,
        12000,
        15, 5, 20,
        'basic',
        statusIds['project_draft'],
      ]
    );
    console.log('  Projects seeded.');

    // ── Project Categories for project 1 ─────────────────────────────────
    const pcData = [
      ['Stand Structure',      categoryIds[0], 8500, statusIds['project_category_quoted']],
      ['Lighting',             categoryIds[2], 1800, statusIds['project_category_in_progress']],
      ['AV & Technology',      categoryIds[3], 4200, statusIds['project_category_pending']],
      ['Furniture & Fixtures', categoryIds[4], 2400, statusIds['project_category_pending']],
      ['Graphics & Signage',   categoryIds[5], 3100, statusIds['project_category_pending']],
    ];
    const pcIds = {};
    for (const [name, category_id, ballpark_cost, status_id] of pcData) {
      const res = await client.query(
        `INSERT INTO preview.project_categories
           (project_id, category_id, name, ballpark_cost, status_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [project1Id, category_id, name, ballpark_cost, status_id]
      );
      pcIds[name] = res.rows[0].id;
    }
    console.log('  Project categories seeded.');

    // ── Messages ───────────────────────────────────────────────────────
    // Thread 1: Construct & Co. — Stand Structure
    await client.query(
      `INSERT INTO preview.messages (project_id, supplier_org_id, supplier_name, category_id, category_name, body, direction, msg_status, read, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW() - INTERVAL '3 days')`,
      [project1Id, supplier1Id, 'Construct & Co.', pcIds['Stand Structure'], 'Stand Structure',
       'Hi, we need a 9×6m custom exhibition stand for Money20/20 at ExCeL London. Double-deck with meeting pod. Budget around £8,500 for the structure. Can you quote?',
       'outbound', null, true]
    );
    await client.query(
      `INSERT INTO preview.messages (project_id, supplier_org_id, supplier_name, category_id, category_name, body, direction, msg_status, read, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW() - INTERVAL '2 days')`,
      [project1Id, supplier1Id, 'Construct & Co.', pcIds['Stand Structure'], 'Stand Structure',
       'Thanks for reaching out! We can definitely do this. For a 9×6m double-deck with meeting pod at ExCeL, we\'d be looking at £8,200 for the shell structure plus £1,800 for the meeting pod fit-out. Total £10,000. Want me to send a detailed breakdown?',
       'inbound', 'action_needed', false]
    );
    await client.query(
      `INSERT INTO preview.messages (project_id, supplier_org_id, supplier_name, category_id, category_name, body, direction, msg_status, read, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW() - INTERVAL '1 day')`,
      [project1Id, supplier1Id, 'Construct & Co.', pcIds['Stand Structure'], 'Stand Structure',
       'That sounds great. Yes please send the full breakdown. Also — can you confirm lead time? We need to be on site by 1st June for build.',
       'outbound', null, true]
    );

    // Thread 2: Volta AV — AV & Technology (with quote items)
    await client.query(
      `INSERT INTO preview.messages (project_id, supplier_org_id, supplier_name, category_id, category_name, body, direction, msg_status, read, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW() - INTERVAL '2 days')`,
      [project1Id, supplier2Id, 'Volta AV London', pcIds['AV & Technology'], 'AV & Technology',
       'We need AV for Money20/20 — large LED wall for the back panel, 2-3 screens for product demos, and a sound system for presentations. 3-day hire.',
       'outbound', null, true]
    );
    const voltaQuoteRes = await client.query(
      `INSERT INTO preview.messages (project_id, supplier_org_id, supplier_name, category_id, category_name, body, direction, msg_status, read, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW() - INTERVAL '1 day') RETURNING id`,
      [project1Id, supplier2Id, 'Volta AV London', pcIds['AV & Technology'], 'AV & Technology',
       'Here\'s our quote for the 3-day package at ExCeL. All prices include delivery, setup, and collection. Happy to discuss.',
       'inbound', 'quoted', false]
    );
    const voltaQuoteId = voltaQuoteRes.rows[0].id;

    // Quote items for Volta AV
    await client.query(
      `INSERT INTO preview.message_items (message_id, name, description, price)
       VALUES ($1, $2, $3, $4)`,
      [voltaQuoteId, '55" Display Screen', '55" Samsung 4K commercial display with floor stand. 3-day hire.', 200]
    );
    await client.query(
      `INSERT INTO preview.message_items (message_id, name, description, price)
       VALUES ($1, $2, $3, $4)`,
      [voltaQuoteId, '65" Display Screen', '65" LG 4K commercial display with floor stand. 3-day hire.', 280]
    );
    await client.query(
      `INSERT INTO preview.message_items (message_id, name, description, price)
       VALUES ($1, $2, $3, $4)`,
      [voltaQuoteId, '90" LED Wall Panel', '90" seamless LED wall panel. Includes rigging and content playback. 3-day hire.', 350]
    );

    // Thread 3: Greenhouse London — Florals (outbound only, waiting)
    await client.query(
      `INSERT INTO preview.messages (project_id, supplier_org_id, supplier_name, category_id, category_name, body, direction, msg_status, read, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW() - INTERVAL '1 day')`,
      [project1Id, supplier3Id, 'Greenhouse London', null, 'Florals',
       'Hi! We\'re looking for floral arrangements for our stand at Money20/20. Thinking tall centrepiece arrangements and some greenery along the front counter. Can you send some options?',
       'outbound', 'follow_up', true]
    );

    console.log('  Messages seeded (3 threads, 6 messages, 3 quote items).');

    await client.query('COMMIT');
    console.log('\n✅ Preview schema seeded successfully.');
    console.log('   Agency: Apex Exhibition Planning');
    console.log('   Users:  Sarah Mitchell (admin), James Cooper (member)');
    console.log('   Projects: 2 (TechVista active, GreenLeaf draft)');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Preview seed failed:', err.message);
    throw err;
  } finally {
    await client.end();
  }
};

seed().catch(err => { console.error('Fatal:', err); process.exit(1); });
