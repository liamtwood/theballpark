/**
 * v1.65gZ27 — RLS / grant hardening for the BallPark Supabase project.
 *
 * Supabase Linter flagged ~50 tables in the `public` schema as
 * "rls_disabled_in_public" + "sensitive_columns_exposed" because the
 * `anon` and `authenticated` roles have full CRUD via PostgREST while
 * RLS is off. Our app doesn't use PostgREST at all (supabaseAnonKey is
 * empty in every environment.*.ts; everything goes through our own
 * Express server using the postgres connection string), so we can
 * safely revoke those grants AND enable RLS as belt-and-braces.
 *
 * Why this won't break the app:
 *   · Our server connects via DIRECT_URL / DATABASE_URL using the
 *     postgres role. Postgres tables created by postgres bypass RLS
 *     via owner-rule. So enabling RLS without policies doesn't lock
 *     out our own queries.
 *   · supabaseAnonKey is '' in every client environment file, so no
 *     in-app code path depends on PostgREST/anon access.
 *
 * Schemas touched: public, preview, master.
 * Marketing schema is already RLS-on with explicit policies (see
 * migrate-schemas.js) and anon has no USAGE on it — left untouched.
 *
 * Idempotent: re-running writes the same state back.
 */
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../..', '.env') });

const SCHEMAS = ['public', 'preview', 'master'];

(async () => {
  const c = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();
  console.log('[harden-rls] Connected.\n');

  for (const schema of SCHEMAS) {
    console.log(`── ${schema} ─────────────────────────────────`);

    // ── 1. Revoke anon / authenticated grants ─────────────────────
    // Schema-level USAGE: required for PostgREST to even see the
    // schema. Removing it makes the schema invisible to the anon API
    // entirely.
    await c.query(`REVOKE USAGE ON SCHEMA ${schema} FROM anon, authenticated`);
    // Existing table / sequence / function privileges.
    await c.query(`REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA ${schema} FROM anon, authenticated`);
    await c.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${schema} FROM anon, authenticated`);
    await c.query(`REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${schema} FROM anon, authenticated`);
    // Default privileges for FUTURE objects created by postgres in
    // this schema — without this, the next CREATE TABLE could
    // accidentally regrant.
    await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON TABLES    FROM anon, authenticated`);
    await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON SEQUENCES FROM anon, authenticated`);
    await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON FUNCTIONS FROM anon, authenticated`);
    console.log(`  ✓ Revoked anon/authenticated grants (schema + all tables/sequences/functions + future defaults)`);

    // ── 2. Enable RLS on every table ─────────────────────────────
    // Done in a server-side DO block so we can loop over pg_tables
    // and target every existing table without enumerating names.
    const enabledRes = await c.query(`
      DO $do$
      DECLARE
        r RECORD;
        n INT := 0;
      BEGIN
        FOR r IN
          SELECT tablename
            FROM pg_tables
           WHERE schemaname = '${schema}'
        LOOP
          EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
                         '${schema}', r.tablename);
          n := n + 1;
        END LOOP;
        RAISE NOTICE 'RLS enabled on % tables', n;
      END
      $do$;
    `);
    console.log(`  ✓ Enabled ROW LEVEL SECURITY on every table`);
  }

  // ── 3. Verification pass ────────────────────────────────────────
  console.log(`\n── verification ─────────────────────────────`);
  const verify = await c.query(`
    SELECT n.nspname AS schema,
           COUNT(*)                                              AS total,
           COUNT(*) FILTER (WHERE c.relrowsecurity)              AS rls_on,
           COUNT(*) FILTER (WHERE NOT c.relrowsecurity)          AS rls_off
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'r'
       AND n.nspname IN ('public', 'preview', 'master', 'marketing')
     GROUP BY n.nspname
     ORDER BY n.nspname
  `);
  for (const r of verify.rows) {
    console.log(`  ${r.schema.padEnd(10)} total=${r.total}  rls_on=${r.rls_on}  rls_off=${r.rls_off}`);
  }

  const anonAccess = await c.query(`
    SELECT n.nspname AS schema,
           has_schema_privilege('anon', n.nspname, 'USAGE')          AS anon_usage,
           has_schema_privilege('authenticated', n.nspname, 'USAGE') AS auth_usage
      FROM pg_namespace n
     WHERE n.nspname IN ('public', 'preview', 'master', 'marketing')
     ORDER BY n.nspname
  `);
  for (const r of anonAccess.rows) {
    console.log(`  ${r.schema.padEnd(10)} anon=${r.anon_usage}  authenticated=${r.auth_usage}`);
  }

  await c.end();
  console.log('\n[harden-rls] Done.');
})().catch(e => { console.error('[harden-rls] FAILED:', e.message); process.exit(1); });
