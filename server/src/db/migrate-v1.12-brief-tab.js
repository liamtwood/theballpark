// v1.12 — Brief tab schema additions.
//
// projects:           event_type, duration_days, po_ref
// project_categories: ballpark_budget
//                     (requirement_brief column already exists)
//
// Idempotent — safe to re-run. Targets the schema set by APP_SCHEMA
// (defaults to public for local dev). Run against dev only — preview
// and master are migrated via a separate promotion step.
//
// Usage: node server/src/db/migrate-v1.12-brief-tab.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const schema = process.env.APP_SCHEMA || 'public';
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  await client.query(`SET search_path TO ${schema}, public`);
  console.log(`[migrate v1.12] schema = ${schema}`);

  try {
    await client.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS event_type    VARCHAR(50),
        ADD COLUMN IF NOT EXISTS duration_days INTEGER,
        ADD COLUMN IF NOT EXISTS po_ref        VARCHAR(100)
    `);
    console.log('  projects: event_type / duration_days / po_ref ensured.');

    await client.query(`
      ALTER TABLE project_categories
        ADD COLUMN IF NOT EXISTS requirement_brief TEXT,
        ADD COLUMN IF NOT EXISTS ballpark_budget   NUMERIC(10,2)
    `);
    console.log('  project_categories: requirement_brief / ballpark_budget ensured.');

    console.log('[migrate v1.12] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
