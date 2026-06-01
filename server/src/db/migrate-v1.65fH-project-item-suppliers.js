// v1.65fH — per-cart-item supplier roster. Adds project_item_suppliers
// join table + back-fills the source supplier for every existing
// project_items row (so legacy carts behave the same: each catalogue
// item asks its own supplier by default).
//
// Idempotent — safe to re-run.
//
// Usage:
//   node server/src/db/migrate-v1.65fH-project-item-suppliers.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[migrate v1.65fH] start — project_item_suppliers');

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_item_suppliers (
        project_item_id UUID NOT NULL REFERENCES project_items(id) ON DELETE CASCADE,
        supplier_org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (project_item_id, supplier_org_id)
      );
      CREATE INDEX IF NOT EXISTS ix_project_item_suppliers_pi
        ON project_item_suppliers(project_item_id);
    `);
    console.log('  ✓ table + index created (or already present)');

    // Backfill: every project_items row with an item_id referencing a
    // supplier-owned catalogue row gets ONE entry mapping it to that
    // supplier. Agency-owned items (ad-hoc placeholders) are skipped
    // — the agent has to pick suppliers for those explicitly.
    const r = await client.query(`
      INSERT INTO project_item_suppliers (project_item_id, supplier_org_id)
      SELECT pi.id, i.org_id
        FROM project_items pi
        JOIN items i ON i.id = pi.item_id
        JOIN orgs  o ON o.id = i.org_id
       WHERE o.type = 'supplier'
      ON CONFLICT (project_item_id, supplier_org_id) DO NOTHING
    `);
    console.log(`  ✓ backfilled ${r.rowCount} (project_item × source supplier) pairs`);

    console.log('[migrate v1.65fH] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
