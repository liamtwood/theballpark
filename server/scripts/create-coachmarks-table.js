/**
 * Create the coachmarks table on the CURRENT schema (dev/public). Admin-editable
 * help-bubble content, keyed by (page, name). Safe to re-run (IF NOT EXISTS).
 * preview/master get it via migrate-schemas.js on promote.
 *
 *   cd server && node scripts/create-coachmarks-table.js
 */
const pool = require('../src/db/pool');

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coachmarks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page        VARCHAR(100) NOT NULL,
      name        VARCHAR(100) NOT NULL,
      description TEXT,
      tail        VARCHAR(10) DEFAULT 'up',
      is_active   BOOLEAN DEFAULT true,
      sort_order  INTEGER DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (page, name)
    );
  `);
  console.log('coachmarks table ready.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
