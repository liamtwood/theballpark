// pV2-SECURITY-RLS-01 §1 / FR-00210 — THREE-PERSONA RLS behaviour tests.
//
// Seeds a controlled fixture as the OWNER (agency A, suppliers B + C, an approved
// + a draft item for B, a draft item for C, a project owned by A with a line
// quoted to B), then connects as `web_app_user` and asserts the policy matrix for
// each persona by setting the request GUCs the app sets in production. Tears the
// fixture down afterwards.
//
// REQUIRES a web_app_user connection string in WEB_APP_DATABASE_URL (owner swaps
// user:password in the DB URL for the web_app_user creds). SKIPS cleanly when it
// is absent (pre-rollout) — run this AFTER migrate-rls.js is applied and BEFORE
// flipping DATABASE_URL. Owner seed/teardown uses DIRECT_URL/DATABASE_URL.
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
const tag = 'rlstest_' + crypto.randomBytes(4).toString('hex');

describe('pV2-SECURITY-RLS-01 three-persona policy matrix', () => {
  let ownerPool, webPool, ids = {};
  const enabled = !!(OWNER_URL && WEB_URL);

  // Tidy every rlstest_* fixture row (owner bypasses RLS). trg_forbid_hard_delete
  // blocks hard DELETE on orgs/items/projects, so soft-delete those (deleted_at);
  // project_items allows hard delete (child, FK). Each run uses a RANDOM tag +
  // distinct per-org keys, so names never collide across runs regardless — this
  // is purely to keep dev tidy (and it also mops up any earlier run's leftovers).
  async function cleanupFixtures() {
    const q = (sql) => ownerPool.query(sql).catch(() => {});
    await q("DELETE FROM project_items WHERE name LIKE 'rlstest\\_%'");
    await q("UPDATE projects SET deleted_at = now() WHERE name LIKE 'rlstest\\_%' AND deleted_at IS NULL");
    await q("UPDATE items    SET deleted_at = now() WHERE name LIKE 'rlstest\\_%' AND deleted_at IS NULL");
    await q("UPDATE orgs     SET deleted_at = now() WHERE name LIKE 'rlstest\\_%' AND deleted_at IS NULL");
  }

  before(async () => {
    if (!enabled) return;
    const { Pool } = require('pg');
    ownerPool = new Pool({ connectionString: OWNER_URL });
    webPool = new Pool({ connectionString: WEB_URL });
    const q = (sql, v) => ownerPool.query(sql, v);
    // NOTE: orgs.name is unique — each seed org needs a DISTINCT name (B and C are
    // both suppliers, so keying on type alone collided within one run).
    const org = async (key, type) => (await q(
      "INSERT INTO orgs (name, type, is_active) VALUES ($1,$2,true) RETURNING id", [`${tag}_${key}`, type])).rows[0].id;
    ids.A = await org('agency', 'agency');
    ids.B = await org('supB', 'supplier');
    ids.C = await org('supC', 'supplier');
    const item = async (org, key, status) => (await q(
      "INSERT INTO items (org_id, name, approval_status, is_active) VALUES ($1,$2,$3,true) RETURNING id",
      [org, `${tag}_${key}`, status])).rows[0].id;
    ids.itemBApproved = await item(ids.B, 'itemB_approved', 'approved');
    ids.itemBDraft = await item(ids.B, 'itemB_draft', 'draft');
    ids.itemCDraft = await item(ids.C, 'itemC_draft', 'draft');
    ids.projA = (await q("INSERT INTO projects (org_id, name, is_active) VALUES ($1,$2,true) RETURNING id",
      [ids.A, `${tag}_proj`])).rows[0].id;
    ids.piB = (await q(
      "INSERT INTO project_items (project_id, supplier_org_id, item_id, name, quantity) VALUES ($1,$2,$3,$4,1) RETURNING id",
      [ids.projA, ids.B, ids.itemBApproved, `${tag}_line`])).rows[0].id;
  });

  after(async () => {
    if (!enabled) return;
    // Teardown by prefix (robust even if the seed only partially completed).
    await cleanupFixtures();
    await ownerPool.end(); await webPool.end();
  });

  // Run `fn(client)` on a web_app_user connection with the given request GUCs.
  async function asPersona({ org = null, userId = null, admin = false }, fn) {
    const client = await webPool.connect();
    try {
      await client.query('SET search_path TO public');
      await client.query(
        "SELECT set_config('app.current_org_id',$1,false), set_config('app.current_user_id',$2,false), set_config('app.is_admin',$3,false)",
        [org, userId, admin ? 't' : 'f']);
      return await fn(client);
    } finally {
      await client.query('RESET ALL').catch(() => {});
      client.release();
    }
  }
  const canRead = async (persona, table, id) =>
    (await asPersona(persona, (c) => c.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]))).rows.length > 0;
  const canUpdate = async (persona, table, id) =>
    (await asPersona(persona, (c) => c.query(`UPDATE ${table} SET updated_at = COALESCE(updated_at, now()) WHERE id = $1`, [id]))).rowCount > 0;

  test('SUPPLIER B: reads own drafts + approved, the agency project (line context) & own line; not C', async (t) => {
    if (!enabled) { t.skip('WEB_APP_DATABASE_URL not set — apply migrate-rls.js + provide web creds first'); return; }
    const B = { org: ids.B };
    assert.ok(await canRead(B, 'items', ids.itemBApproved), 'B reads own approved item');
    assert.ok(await canRead(B, 'items', ids.itemBDraft), 'B reads own draft item');
    assert.ok(!(await canRead(B, 'items', ids.itemCDraft)), "B cannot read C's draft item");
    assert.ok(await canRead(B, 'projects', ids.projA), "B reads the agency project it's quoting");
    assert.ok(await canRead(B, 'project_items', ids.piB), 'B reads its own line');
    assert.ok(await canUpdate(B, 'items', ids.itemBDraft), 'B edits its own item');
    assert.ok(!(await canUpdate(B, 'projects', ids.projA)), "B cannot mutate the agency's project row");
    assert.ok(!(await canUpdate(B, 'items', ids.itemCDraft)), "B cannot edit C's item");
  });

  test('AGENCY A: browses approved only; owns its project; cannot write items', async (t) => {
    if (!enabled) { t.skip('WEB_APP_DATABASE_URL not set'); return; }
    const A = { org: ids.A };
    assert.ok(await canRead(A, 'items', ids.itemBApproved), 'A browses approved catalogue');
    assert.ok(!(await canRead(A, 'items', ids.itemBDraft)), "A cannot see B's draft");
    assert.ok(await canRead(A, 'projects', ids.projA), 'A reads its own project');
    assert.ok(await canUpdate(A, 'projects', ids.projA), 'A writes its own project');
    assert.ok(!(await canUpdate(A, 'items', ids.itemBApproved)), "A cannot write another org's item");
  });

  test('ADMIN: cross-org read + write', async (t) => {
    if (!enabled) { t.skip('WEB_APP_DATABASE_URL not set'); return; }
    const ADM = { admin: true };
    assert.ok(await canRead(ADM, 'items', ids.itemCDraft), 'admin reads any draft');
    assert.ok(await canUpdate(ADM, 'projects', ids.projA), 'admin writes any project');
  });

  test('NO CONTEXT (no GUCs): sees only approved items, writes nothing', async (t) => {
    if (!enabled) { t.skip('WEB_APP_DATABASE_URL not set'); return; }
    const NONE = {};
    assert.ok(await canRead(NONE, 'items', ids.itemBApproved), 'anon-ctx still sees approved (public catalogue)');
    assert.ok(!(await canRead(NONE, 'projects', ids.projA)), 'anon-ctx sees no private project');
    assert.ok(!(await canUpdate(NONE, 'items', ids.itemBApproved)), 'anon-ctx writes nothing');
  });
});
