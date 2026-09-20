// pV2-SECURITY-RLS-01 / BE-00115 — auth-bootstrap smoke.
//
// Proves the login/onboarding identity writes CANNOT run under the web_app_user
// RLS role (they happen before a JWT/tenancy exists, so the GUCs are null and the
// users/orgs/user_orgs policies deny them) — which is exactly why auth.service,
// onboarding, and the dev login paths run on the OWNER pool (db/owner-pool.js).
// The two assertions: the login users-INSERT is DENIED as web_app_user with no
// context; the same INSERT SUCCEEDS on the owner connection (the fix path).
//
// SKIPS unless WEB_APP_DATABASE_URL (web_app_user) is set — same gate as the
// persona tests; run after migrate-rls.js is applied.
const path = require('path');
const crypto = require('crypto');
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
try {
  const dotenv = require('dotenv');
  for (const p of ['../../../.env', '../../.env']) {
    dotenv.config({ path: path.resolve(__dirname, p) });
    if (process.env.DIRECT_URL || process.env.DATABASE_URL) break;
  }
} catch { /* optional */ }

const OWNER_URL = process.env.MIGRATION_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
const WEB_URL = process.env.WEB_APP_DATABASE_URL;
const enabled = !!(OWNER_URL && WEB_URL);
const tag = 'rlsauth_' + crypto.randomBytes(4).toString('hex');

describe('pV2-SECURITY-RLS-01 auth bootstrap (BE-00115)', () => {
  let ownerPool, webPool;
  before(() => {
    if (!enabled) return;
    const { Pool } = require('pg');
    ownerPool = new Pool({ connectionString: OWNER_URL });
    webPool = new Pool({ connectionString: WEB_URL });
  });
  after(async () => {
    if (!enabled) return;
    // forbid_hard_delete blocks DELETE on users → soft-delete the fixture.
    await ownerPool.query("UPDATE users SET deleted_at = now() WHERE email LIKE 'rlsauth\\_%' AND deleted_at IS NULL").catch(() => {});
    await ownerPool.end(); await webPool.end();
  });

  const INSERT = `INSERT INTO users (name, display_name, email, google_sub, role)
                  VALUES ($1, $2, $3, $4, NULL) RETURNING id`;
  const vals = (k) => [`${tag}_${k}`, `${tag}_${k}`, `${tag}_${k}@example.com`, `${tag}_${k}`];

  test('login users-INSERT is DENIED under web_app_user with no request context', async (t) => {
    if (!enabled) { t.skip('WEB_APP_DATABASE_URL not set'); return; }
    const client = await webPool.connect();
    try {
      await client.query('SET search_path TO public');
      await client.query('RESET ALL'); // ensure no GUCs (pre-auth)
      await assert.rejects(
        () => client.query(INSERT, vals('web')),
        /row-level security|permission denied/i,
        'web_app_user must NOT be able to insert a users row pre-auth (this is why auth uses the owner pool)',
      );
    } finally {
      await client.query('RESET ALL').catch(() => {});
      client.release();
    }
  });

  test('same INSERT SUCCEEDS on the owner connection (the auth fix path)', async (t) => {
    if (!enabled) { t.skip('WEB_APP_DATABASE_URL not set'); return; }
    const r = await ownerPool.query(INSERT, vals('owner'));
    assert.ok(r.rows[0]?.id, 'owner pool creates the users row (bypasses RLS) — auth bootstrap works');
  });
});
