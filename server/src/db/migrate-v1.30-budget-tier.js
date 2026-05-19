// v1.30 — Seed shared.codelists with the budget_tier list.
//
// Drives the Event drawer's Tier dropdown and the value the new
// rule-based brief parser writes to projects.tier. Codes are
// 'starter' / 'professional' / 'premium' / 'unknown' (NOT the older
// core/signature/premium item-tier values).
//
// Idempotent. Run against dev only — preview / master are migrated
// via migrate-schemas.js promotion.
//
// Usage: node server/src/db/migrate-v1.30-budget-tier.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[migrate v1.30] seeding shared.codelists.budget_tier');

  try {
    await client.query(`
      INSERT INTO shared.codelists (list_name, code, label, sort_order, is_system) VALUES
        ('budget_tier', 'starter',      'Starter',      1, true),
        ('budget_tier', 'professional', 'Professional', 2, true),
        ('budget_tier', 'premium',      'Premium',      3, true),
        ('budget_tier', 'unknown',      'Unknown',      4, true)
      ON CONFLICT (list_name, code) DO NOTHING;
    `);
    console.log('  budget_tier rows seeded.');
    console.log('[migrate v1.30] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
