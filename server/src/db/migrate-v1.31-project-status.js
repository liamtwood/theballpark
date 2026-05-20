// v1.31 — Seed shared.codelists with list_name='project_status'.
//
// Same pattern as budget_tier / currency. Colour lives in the meta
// JSONB so the dashboard + Event drawer can read it directly via
// CodelistService.getMeta('project_status', code).color.
//
// The existing public.statuses table stays untouched for backward
// compat (projects.status_id FK). New display code reads from this
// codelist by matching the code to statuses.name. Future cleanup
// can drop the statuses table once nothing references it.
//
// Idempotent. Usage:
//   node server/src/db/migrate-v1.31-project-status.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[migrate v1.31] seeding shared.codelists.project_status');

  try {
    await client.query(`
      INSERT INTO shared.codelists (list_name, code, label, sort_order, meta, is_system) VALUES
        ('project_status', 'draft',     'Draft',     1, '{"color":"#F59E0B"}'::jsonb, true),
        ('project_status', 'active',    'Active',    2, '{"color":"#10B981"}'::jsonb, true),
        ('project_status', 'completed', 'Completed', 3, '{"color":"#6B7280"}'::jsonb, true),
        ('project_status', 'archived',  'Archived',  4, '{"color":"#9CA3AF"}'::jsonb, true)
      ON CONFLICT (list_name, code) DO NOTHING;
    `);
    console.log('  project_status rows seeded.');
    console.log('[migrate v1.31] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
