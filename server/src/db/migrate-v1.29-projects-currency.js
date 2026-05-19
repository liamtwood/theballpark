// v1.29 — Add projects.currency + seed shared.codelists currency rows.
//
// Backs the new Currency dropdown in the Event drawer (Financials
// section). Same codelist pattern that drives item_unit /
// item_time_unit. Default 'GBP' so existing rows are unaffected.
//
// Idempotent. Run against dev only — preview / master are migrated
// via a separate promotion step.
//
// Usage: node server/src/db/migrate-v1.29-projects-currency.js

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
  console.log(`[migrate v1.29] schema = ${schema}`);

  try {
    await client.query(`
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'GBP'
    `);
    console.log('  projects.currency ensured (default GBP).');

    await client.query(`
      INSERT INTO shared.codelists (list_name, code, label, symbol, sort_order, is_system) VALUES
        ('currency', 'GBP', 'GBP (£)',     '£',   1, true),
        ('currency', 'USD', 'USD ($)',     '$',   2, true),
        ('currency', 'EUR', 'EUR (€)',     '€',   3, true),
        ('currency', 'AED', 'AED (د.إ)',   'د.إ', 4, true),
        ('currency', 'CHF', 'CHF (Fr)',    'Fr',  5, true),
        ('currency', 'SEK', 'SEK (kr)',    'kr',  6, true)
      ON CONFLICT (list_name, code) DO NOTHING
    `);
    console.log('  shared.codelists currency rows seeded.');

    console.log('[migrate v1.29] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
