/**
 * One-off cleanup: soft-delete "POA" My-Components — library rows of
 * kind='component' with no price (base_price IS NULL). These are mostly junk
 * from the Customize clone-up (calc-strings typed as names, price-less test
 * rows). Soft-delete only (deleted_at) — recoverable. A proper "manage
 * components" curation UI is the real follow-up.
 *
 *   cd server && node scripts/remove-poa-components.js           # dry-run (list)
 *   cd server && node scripts/remove-poa-components.js --commit  # soft-delete
 */
const pool = require('../src/db/pool');
const COMMIT = process.argv.includes('--commit');

(async () => {
  const { rows } = await pool.query(
    `SELECT id, org_id, name FROM items
      WHERE kind = 'component' AND base_price IS NULL AND deleted_at IS NULL
      ORDER BY org_id, name`
  );
  console.log(`Found ${rows.length} POA (price-less) component(s):`);
  for (const r of rows) console.log(`  • ${r.name}  [${r.id}]`);

  if (!COMMIT) {
    console.log('\nDry-run only. Re-run with --commit to soft-delete these.');
    process.exit(0);
  }
  const res = await pool.query(
    `UPDATE items SET deleted_at = NOW()
      WHERE kind = 'component' AND base_price IS NULL AND deleted_at IS NULL`
  );
  console.log(`\nSoft-deleted ${res.rowCount} POA component(s).`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
