// One-off read: confirm +/♡ clicks are writing to project_items.
// Usage: node server/src/db/check-project-items.js
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    // Run the same SELECT against each env schema so we see writes
    // regardless of which one the running app is pointed at.
    for (const schema of ['public', 'preview', 'master']) {
      const { rows } = await pool.query(
        `SELECT pi.id, pi.project_id, pi.item_id, pi.selection_type, pi.created_at,
                i.name, i.unit, i.base_price
           FROM ${schema}.project_items pi
           JOIN ${schema}.items i ON pi.item_id = i.id
          ORDER BY pi.created_at DESC
          LIMIT 10`
      );
      console.log(`\n── ${schema}.project_items (most recent 10) ──`);
      if (!rows.length) {
        console.log('  (none)');
      } else {
        for (const r of rows) {
          const ts = new Date(r.created_at).toISOString();
          const price = r.base_price != null ? '£' + r.base_price : '—';
          console.log(`  ${ts}  ${r.selection_type.padEnd(8)} ${r.name} (${r.unit || '—'}) ${price}`);
        }
      }
    }
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
