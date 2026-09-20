// pV2-SECURITY-RLS-01 §1 / FR-00210 — COVERAGE GUARD.
//
// Proves programmatically (never by hand-list) that every base table
// web_app_user is granted on has at least one RLS policy — an RLS-enabled table
// with no policy is deny-all, so a forgotten policy is a broken feature, and an
// ungoverned grant would be a leak once the role flips. The manual inventory
// already missed user_orgs once; this asserts it instead of trusting the list.
//
// Runs against the OWNER connection (DIRECT_URL/DATABASE_URL). SKIPS cleanly
// before migrate-rls.js has been applied (role absent) so the suite stays green
// pre-rollout; once applied it is a hard gate.
const path = require('path');
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
try {
  const dotenv = require('dotenv');
  for (const p of ['../../../.env', '../../.env']) {
    dotenv.config({ path: path.resolve(__dirname, p) });
    if (process.env.DIRECT_URL || process.env.DATABASE_URL) break;
  }
} catch { /* optional */ }

const { ENV_SCHEMAS } = require('./migrate-rls');
const DB_URL = process.env.MIGRATION_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

describe('pV2-SECURITY-RLS-01 coverage: every granted base table has a policy', () => {
  let pool, roleExists = false, present = [];
  before(async () => {
    if (!DB_URL) return;
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: DB_URL });
    roleExists = (await pool.query("SELECT 1 FROM pg_roles WHERE rolname='web_app_user'")).rows.length > 0;
    if (roleExists) {
      present = (await pool.query(
        'SELECT schema_name FROM information_schema.schemata WHERE schema_name = ANY($1)', [ENV_SCHEMAS]
      )).rows.map((r) => r.schema_name);
    }
  });
  after(async () => { if (pool) await pool.end(); });

  test('granted base tables all carry >=1 pg_policies row', async (t) => {
    if (!DB_URL) { t.skip('no DB URL'); return; }
    if (!roleExists) { t.skip('web_app_user not created yet — run migrate-rls.js first'); return; }
    // Every base table (exclude views) web_app_user has ANY privilege on.
    const granted = (await pool.query(`
      SELECT g.table_schema, g.table_name
        FROM information_schema.role_table_grants g
        JOIN information_schema.tables tb
          ON tb.table_schema = g.table_schema AND tb.table_name = g.table_name
       WHERE g.grantee = 'web_app_user' AND tb.table_type = 'BASE TABLE'
       GROUP BY g.table_schema, g.table_name`)).rows;
    assert.ok(granted.length > 0, 'web_app_user has table grants');
    const missing = [];
    for (const { table_schema, table_name } of granted) {
      const pol = await pool.query(
        'SELECT 1 FROM pg_policies WHERE schemaname = $1 AND tablename = $2 LIMIT 1',
        [table_schema, table_name]);
      if (!pol.rows.length) missing.push(`${table_schema}.${table_name}`);
    }
    assert.equal(missing.length, 0, `granted tables with NO policy (deny-all): ${missing.join(', ')}`);
  });
});
