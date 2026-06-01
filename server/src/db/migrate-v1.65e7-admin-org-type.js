// v1.65e7 (p0015) — add 'admin' as a valid orgs.type value.
//
// The orgs table's CHECK constraint originally allowed only
// 'agency' and 'supplier'. The persona model added a third kind —
// 'admin' (Beth Pizey at Ballpark) — so the DB needs to allow it
// too, otherwise the Ballpark org can't be inserted from the
// /ballpark-settings/orgs admin UI.
//
// Idempotent: drops the existing CHECK constraint (if present) and
// re-creates it with the expanded set. Safe to run on fresh schemas
// (migrate.js now ships with the 3-value version too) AND on
// already-deployed ones.
//
// Usage:
//   node server/src/db/migrate-v1.65e7-admin-org-type.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[migrate v1.65e7] start — expanding orgs.type CHECK to include admin');

  try {
    await client.query(`ALTER TABLE orgs DROP CONSTRAINT IF EXISTS orgs_type_check;`);
    console.log('  ✓ dropped existing orgs_type_check');

    await client.query(`
      ALTER TABLE orgs
        ADD CONSTRAINT orgs_type_check
        CHECK (type IN ('agency', 'supplier', 'admin'));
    `);
    console.log('  ✓ re-added orgs_type_check with admin');

    console.log('[migrate v1.65e7] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
