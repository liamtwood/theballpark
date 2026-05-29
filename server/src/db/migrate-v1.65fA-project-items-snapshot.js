// v1.65fA — project_items becomes a per-brief snapshot of the
// catalogue item. Adds four columns (name, base_price, unit,
// description) and back-fills them from items so the cart drawer
// + ballpark recompute can read directly from the snapshot.
//
// Why: today project_items is a pure JOIN row — every catalogue
// edit ripples into every project that referenced the item. The
// agent can't tweak "Sit-Down Dinner" for a specific brief without
// mutating Rocket Food's catalogue. The snapshot model lets both
// agent and supplier edit per-brief without polluting the catalogue.
// items.id stays on project_items as the lineage pointer.
//
// Reads downstream COALESCE(pi.<col>, i.<col>) so legacy rows with
// NULL snapshot values still render the catalogue value.
//
// Idempotent: ADD COLUMN IF NOT EXISTS + only back-fills rows whose
// snapshot columns are NULL. Safe to re-run.
//
// Usage:
//   node server/src/db/migrate-v1.65fA-project-items-snapshot.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[migrate v1.65fA] start — project_items snapshot columns');

  try {
    await client.query(`
      ALTER TABLE project_items ADD COLUMN IF NOT EXISTS name        VARCHAR(255);
      ALTER TABLE project_items ADD COLUMN IF NOT EXISTS base_price  NUMERIC(12,2);
      ALTER TABLE project_items ADD COLUMN IF NOT EXISTS unit        VARCHAR(50);
      ALTER TABLE project_items ADD COLUMN IF NOT EXISTS description TEXT;
    `);
    console.log('  ✓ columns added (or already present)');

    // Backfill: copy from items where the snapshot is NULL. Skips
    // rows whose item_id no longer exists (LEFT JOIN safety).
    const r = await client.query(`
      UPDATE project_items pi
         SET name        = COALESCE(pi.name,        i.name),
             base_price  = COALESCE(pi.base_price,  i.base_price),
             unit        = COALESCE(pi.unit,        i.unit),
             description = COALESCE(pi.description, i.description)
        FROM items i
       WHERE pi.item_id = i.id
         AND (pi.name IS NULL
              OR pi.base_price IS NULL
              OR pi.unit IS NULL
              OR pi.description IS NULL);
    `);
    console.log(`  ✓ backfilled ${r.rowCount} rows from items catalogue`);

    console.log('[migrate v1.65fA] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
