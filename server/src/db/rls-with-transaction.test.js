// pV2-SECURITY-RLS-01 / EP-00020 — ROUTE-MECHANISM RLS test (AUD-02 flip gate).
//
// The three-persona test (rls-personas.test.js) sets the request GUCs DIRECTLY on
// a web_app_user client and asserts the SQL policy matrix. That proves the policies
// are correct — but it never exercises the APP's mechanism for getting those GUCs
// onto a transaction client. That mechanism is `withTransaction`: every multi-write
// service path (item.service.duplicate, project-item custom lines, …) runs through
// it, and it must SET the org/user/admin GUCs from AsyncLocalStorage onto its OWN
// pooled client so RLS sees the caller's org. A raw `pool.connect()` + hand-rolled
// BEGIN that set only current_user_id (the pre-AUD-02 shape) would be DENIED post-
// flip — and the SQL persona smoke would never catch it, because it bypasses the
// helper. This test closes that gap: it drives the REAL withTransaction helper,
// under als.run, against a live web_app_user connection, replicating
// item.service.duplicate's INSERT + supplier_item_tag copy.
//
// REQUIRES WEB_APP_DATABASE_URL (web_app_user creds); SKIPS cleanly when absent —
// run AFTER migrate-rls.js is applied and BEFORE flipping DATABASE_URL. Owner
// seed/teardown uses MIGRATION_DATABASE_URL / DIRECT_URL / DATABASE_URL.
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
const tag = 'rlstxn_' + crypto.randomBytes(4).toString('hex');

// The REAL helper + ALS the app uses — not a reimplementation. The default pool
// inside with-transaction.js is the owner pool (.env DATABASE_URL); we override it
// with the web_app_user pool via the {pool} param that AUD-02 added for exactly
// this — so the test runs as the post-flip role without touching env.
const { withTransaction } = require('./with-transaction');
const { als } = require('./request-context');

describe('pV2-SECURITY-RLS-01 withTransaction carries org GUC → RLS (route mechanism)', () => {
  let ownerPool, webPool;
  const ids = {};
  const userId = crypto.randomUUID(); // created_by/updated_by are plain UUIDs (no FK)
  const enabled = !!(OWNER_URL && WEB_URL);

  // duplicate() mirror — the RLS-relevant slice of item.service.duplicate: an
  // INSERT … SELECT that copies the source's org_id (items_insert WITH CHECK
  // org_id = app_current_org()) plus the supplier_item_tag copy (write policy =
  // app_owns_item on the NEW copy). Runs on the client withTransaction hands it.
  const duplicate = (srcId) => (client) => (async () => {
    const ins = await client.query(
      `INSERT INTO items (org_id, category_id, name, approval_status, is_active)
       SELECT org_id, category_id, name || ' (copy)', 'draft', false
         FROM items WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`, [srcId]);
    const copy = ins.rows[0];
    if (!copy) return null;
    await client.query(
      `INSERT INTO supplier_item_tag (item_id, tag_id)
       SELECT $1, tag_id FROM supplier_item_tag WHERE item_id = $2`, [copy.id, srcId]);
    return copy;
  })();

  // Sweep the STATIC family prefix (not this run's random tag) so a killed run's
  // leftovers self-heal on the next run — same pattern as rls-personas.test.js.
  // The fixture ANCHORS to an existing category (never creates one), so nothing
  // here touches the real category tree; only rlstxn_ items/orgs/tags exist to
  // clean. Items/orgs are soft-deleted (trg_forbid_hard_delete); the tag +
  // supplier_item_tag are hard-deleted (leaf reference rows, safe).
  const FAM = "rlstxn\\_%";
  async function cleanupFixtures() {
    const q = (sql) => ownerPool.query(sql).catch(() => {});
    await q(`DELETE FROM supplier_item_tag WHERE item_id IN (SELECT id FROM items WHERE name LIKE '${FAM}')`);
    await q(`DELETE FROM tag WHERE label LIKE '${FAM}'`);
    await q(`UPDATE items SET deleted_at = now() WHERE name LIKE '${FAM}' AND deleted_at IS NULL`);
    await q(`UPDATE orgs  SET deleted_at = now() WHERE name LIKE '${FAM}' AND deleted_at IS NULL`);
  }

  before(async () => {
    if (!enabled) return;
    const { Pool } = require('pg');
    ownerPool = new Pool({ connectionString: OWNER_URL });
    // search_path at the pool level so the raw client withTransaction connects
    // resolves unqualified table names to public (no per-client SET here).
    webPool = new Pool({ connectionString: WEB_URL, options: '-c search_path=public' });
    await cleanupFixtures(); // mop up any earlier partial/killed run
    const q = (sql, v) => ownerPool.query(sql, v);
    // Anchor to a REAL category (read-only) — the fixture must not add rows to the
    // live category tree (they'd surface as 0-item cards and can't be hard-deleted
    // while soft-deleted items hold the FK). Skip if the DB has no category.
    ids.cat = (await q("SELECT id FROM categories WHERE is_active = true ORDER BY sort_order, created_at LIMIT 1")).rows[0]?.id;
    if (!ids.cat) return; // tests guard on ids.cat and skip
    ids.B = (await q("INSERT INTO orgs (name, type, is_active) VALUES ($1,'supplier',true) RETURNING id", [`${tag}_supB`])).rows[0].id;
    ids.C = (await q("INSERT INTO orgs (name, type, is_active) VALUES ($1,'supplier',true) RETURNING id", [`${tag}_supC`])).rows[0].id;
    ids.src = (await q(
      "INSERT INTO items (org_id, category_id, name, approval_status, is_active) VALUES ($1,$2,$3,'approved',true) RETURNING id",
      [ids.B, ids.cat, `${tag}_src`])).rows[0].id;
    ids.tagRow = (await q("INSERT INTO tag (category_id, label) VALUES ($1,$2) RETURNING id", [ids.cat, `${tag}_taglabel`])).rows[0].id;
    await q("INSERT INTO supplier_item_tag (item_id, tag_id) VALUES ($1,$2)", [ids.src, ids.tagRow]);
  });

  after(async () => {
    // Importing with-transaction.js pulls in the app's owner pool (db/pool.js),
    // which holds warm clients for 10 min — end it so `node --test` exits cleanly
    // even in skip mode. Guarded so a partial setup never masks the real failure.
    try { await require('./pool').end(); } catch { /* already ended / never opened */ }
    if (!enabled) return;
    await cleanupFixtures();
    await ownerPool.end().catch(() => {});
    await webPool.end().catch(() => {});
  });

  test('WITH org context: the duplicate INSERT + tag copy succeed as web_app_user', async (t) => {
    if (!enabled) { t.skip('WEB_APP_DATABASE_URL not set — apply migrate-rls.js + provide web creds first'); return; }
    if (!ids.cat) { t.skip('no category in DB to anchor the fixture'); return; }
    const copy = await als.run({ userId, orgId: ids.B, isAdmin: false },
      () => withTransaction(duplicate(ids.src), { pool: webPool }));
    assert.ok(copy && copy.id, 'duplicate committed under RLS with org context');
    assert.equal(copy.org_id, ids.B, 'copy carries the owning org');
    assert.equal(copy.approval_status, 'draft', 'copy lands as draft');
    const tags = await ownerPool.query('SELECT 1 FROM supplier_item_tag WHERE item_id = $1', [copy.id]);
    assert.equal(tags.rows.length, 1, 'supplier_item_tag copied (write policy allowed the owned copy)');
  });

  test('WITHOUT context (no ALS store → null GUCs): RLS denies the write', async (t) => {
    if (!enabled) { t.skip('WEB_APP_DATABASE_URL not set'); return; }
    if (!ids.cat) { t.skip('no category in DB to anchor the fixture'); return; }
    // No als.run: withTransaction sets the GUCs to null, so items_insert WITH CHECK
    // (org_id = app_current_org()) fails. This is the load-bearing guard — if a
    // future edit dropped GUC-setting from withTransaction, this write would break
    // in production and this test would catch it pre-flip.
    await assert.rejects(
      () => withTransaction(duplicate(ids.src), { pool: webPool }),
      /row-level security|violates|policy|permission denied/i,
      'a context-less duplicate must be denied by RLS');
  });

  test('WRONG org (C duplicating B\'s approved item): RLS denies (copy would carry org_id=B)', async (t) => {
    if (!enabled) { t.skip('WEB_APP_DATABASE_URL not set'); return; }
    if (!ids.cat) { t.skip('no category in DB to anchor the fixture'); return; }
    // C can READ B's approved item (public catalogue), so the SELECT returns it, but
    // the copy preserves org_id=B and items_insert WITH CHECK requires it to equal
    // C's org → denied. Proves the GUC scopes writes, not merely "some context set".
    await assert.rejects(
      () => als.run({ userId, orgId: ids.C, isAdmin: false },
        () => withTransaction(duplicate(ids.src), { pool: webPool })),
      /row-level security|violates|policy|permission denied/i,
      'cross-org duplicate must be denied');
  });
});
