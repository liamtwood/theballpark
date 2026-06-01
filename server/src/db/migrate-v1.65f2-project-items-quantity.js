// v1.65f2 — add project_items.quantity NUMERIC(10,2) DEFAULT 1.
//
// Buy-quantity per cart row. Default 1 so all existing rows behave
// the same as before. The marketplace card + cart drawer expose a
// stepper; ballpark recompute multiplies by `quantity` IN ADDITION TO
// the per-head guest_count multiplier introduced in v1.65ei, so:
//
//   line_cost = base_price × quantity × (guest_count when per-head else 1)
//
// Idempotent — ADD COLUMN IF NOT EXISTS, safe to re-run.
//
// Usage:
//   node server/src/db/migrate-v1.65f2-project-items-quantity.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[migrate v1.65f2] start — adding project_items.quantity');

  try {
    await client.query(`
      ALTER TABLE project_items
        ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 1;
    `);
    console.log('  ✓ project_items.quantity added (or already present)');

    // Backfill any existing NULL rows to 1 so the multiplier never
    // collapses a line cost to 0. New rows pick up DEFAULT 1
    // automatically. Cheap full-table scan; project_items is small.
    const r = await client.query(`
      UPDATE project_items SET quantity = 1 WHERE quantity IS NULL;
    `);
    console.log(`  ✓ backfilled ${r.rowCount} NULL rows to quantity=1`);

    console.log('[migrate v1.65f2] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
