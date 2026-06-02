// v1.65gZ27 follow-up — REVOKE USAGE FROM PUBLIC on the public schema.
// PostgreSQL's `PUBLIC` pseudo-role (= every role) has USAGE on the
// public schema by default, and `anon` inherits through it. Without
// this, the previous REVOKE FROM anon was effectively a no-op for
// USAGE.
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../..', '.env') });

(async () => {
  const c = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // Schema USAGE
  await c.query(`REVOKE USAGE ON SCHEMA public FROM PUBLIC`);
  // And anything else PUBLIC might have on tables/sequences/functions
  // (defensive — these are usually already locked).
  await c.query(`REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public FROM PUBLIC`);
  await c.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC`);
  await c.query(`REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC`);
  // Future objects created by postgres
  await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM PUBLIC`);
  await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC`);
  await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC`);
  console.log('✓ Revoked PUBLIC pseudo-role privileges on public schema');

  // Verify
  const r = await c.query(`
    SELECT has_schema_privilege('anon', 'public', 'USAGE') AS anon_usage,
           has_schema_privilege('authenticated', 'public', 'USAGE') AS auth_usage,
           has_schema_privilege('postgres', 'public', 'USAGE') AS postgres_usage
  `);
  console.log('Verify:', r.rows[0]);

  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
