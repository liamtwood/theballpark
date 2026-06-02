/**
 * v1.65gZ32 — Add soft-delete support to marketing.guestlist_signup.
 *
 *   · ADD COLUMN deleted_at TIMESTAMPTZ (nullable, default NULL)
 *   · DROP the unconditional unique-email index
 *   · REPLACE with a partial unique index that only enforces uniqueness
 *     when deleted_at IS NULL — so a soft-deleted user can re-sign up
 *     with the same email address.
 *
 * Idempotent: re-running writes the same state back.
 *
 * Usage: node server/src/db/soft-delete-signups-v1.65gZ32.js
 */
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../..', '.env') });

(async () => {
  const c = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  console.log('[soft-delete-migration] connected.');

  await c.query(`
    ALTER TABLE marketing.guestlist_signup
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
  `);
  console.log('  ✓ deleted_at column ensured');

  // Drop the old unconditional unique index, then create the partial one.
  // Wrapped in a DO block so it's a single atomic step.
  await c.query(`
    DO $do$
    BEGIN
      -- Old index from migrate-schemas.js
      IF EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'marketing'
                    AND indexname  = 'guestlist_signup_email_uniq') THEN
        EXECUTE 'DROP INDEX marketing.guestlist_signup_email_uniq';
        RAISE NOTICE 'dropped old guestlist_signup_email_uniq';
      END IF;

      -- New partial unique index: only enforces uniqueness on active rows
      IF NOT EXISTS (SELECT 1 FROM pg_indexes
                      WHERE schemaname = 'marketing'
                        AND indexname  = 'guestlist_signup_email_active_uniq') THEN
        EXECUTE 'CREATE UNIQUE INDEX guestlist_signup_email_active_uniq
                   ON marketing.guestlist_signup (lower(email))
                   WHERE deleted_at IS NULL';
        RAISE NOTICE 'created guestlist_signup_email_active_uniq';
      END IF;
    END
    $do$;
  `);
  console.log('  ✓ partial unique index in place');

  // Helpful index for the listSignups WHERE deleted_at IS NULL filter.
  await c.query(`
    CREATE INDEX IF NOT EXISTS guestlist_signup_active_created_idx
      ON marketing.guestlist_signup (created_at DESC)
      WHERE deleted_at IS NULL;
  `);
  console.log('  ✓ active-rows-by-date index ensured');

  // Verify
  const r = await c.query(`
    SELECT indexname, indexdef
      FROM pg_indexes
     WHERE schemaname = 'marketing'
       AND tablename  = 'guestlist_signup'
     ORDER BY indexname
  `);
  console.log('\nIndexes on marketing.guestlist_signup:');
  for (const row of r.rows) {
    console.log(`  · ${row.indexname}`);
  }

  await c.end();
  console.log('\n[soft-delete-migration] done.');
})().catch(e => { console.error('[soft-delete-migration] FAILED:', e.message); process.exit(1); });
