// pV2-INTENT-01 — add project_items.flat_total (nullable): a negotiated FLAT
// line total that overrides the per-unit × qty + install calc. When set,
// price_current (the per-unit cost) is null. Additive + nullable → existing
// rows read as NULL = "no flat override", so the shared formula is unchanged.
// Usage: node server/src/db/migrate-flat-total.js
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (const schema of ['public', 'preview']) {
      await client.query(
        `ALTER TABLE ${schema}.project_items ADD COLUMN IF NOT EXISTS flat_total numeric`
      );
      console.log(`  ${schema}.project_items.flat_total ready`);
    }
    console.log('Done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
