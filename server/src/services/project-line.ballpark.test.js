// pV2-PROJECTS-S2 — list-card ballpark consistency test.
//
// Locks the invariant the orchestrator asked for: a project's LIST-CARD total
// (projects.service listForOrg → project-line.service listBallparkTotals) equals
// its DETAIL-HERO total (getEstimate().projectTotal) exactly, and a project with
// NO lines reports null (the card renders "—"). Both paths run the same cascade
// SQL + computeEstimate, so this proves they can't drift.
//
// Needs a Postgres connection (DIRECT_URL / DATABASE_URL) — it creates two
// throwaway projects (admin GUC), asserts, and hard-deletes them (children
// cascade). Skips with a notice when no DB is configured (matches the golden test).

const path = require('path');
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

try {
  const dotenv = require('dotenv');
  for (const p of ['../../../.env', '../../.env']) {
    dotenv.config({ path: path.resolve(__dirname, p) });
    if (process.env.DIRECT_URL || process.env.DATABASE_URL) break;
  }
} catch { /* dotenv optional */ }

const DB_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

describe('pV2-PROJECTS-S2: list-card ballpark == detail-hero projectTotal', () => {
  let pool, als, lines, client, orgId;
  const created = [];

  before(async () => {
    if (!DB_URL) return;
    pool = require('../db/pool');
    ({ als } = require('../db/request-context'));
    lines = require('./project-line.service');
    client = await pool.connect();
    await client.query(`SELECT set_config('app.is_admin','t',false), set_config('app.current_user_id','',false)`);
    await client.query(`SELECT set_config('app.current_org_id','00000000-0000-0000-0000-000000000001',false)`);
    const org = await client.query(`SELECT id FROM orgs WHERE type='agency' AND deleted_at IS NULL LIMIT 1`);
    if (!org.rows.length) return; // no fixture org → tests skip below
    orgId = org.rows[0].id;
    await client.query(`SELECT set_config('app.current_org_id',$1,false)`, [orgId]);
  });

  after(async () => {
    if (client && created.length) {
      for (const id of created) { try { await client.query('DELETE FROM projects WHERE id=$1', [id]); } catch { /* best-effort cleanup */ } }
    }
    if (client) client.release();
    if (pool) await pool.end();
  });

  test('card total equals hero projectTotal for a project with lines', async (t) => {
    if (!DB_URL) { t.skip('no DIRECT_URL/DATABASE_URL'); return; }
    if (!orgId) { t.skip('no agency org fixture'); return; }
    const item = await client.query(
      `SELECT id FROM items WHERE status='active' AND approval_status='approved'
         AND deleted_at IS NULL AND category_id IS NOT NULL LIMIT 1`);
    if (!item.rows.length) { t.skip('no live categorised item fixture'); return; }

    const pr = await client.query(
      `INSERT INTO projects (org_id,name,status,currency,ref) VALUES ($1,'S2 card-consistency','draft','GBP','CARD-TEST') RETURNING id`, [orgId]);
    const projectId = pr.rows[0].id;
    created.push(projectId);
    await client.query(`INSERT INTO project_settings (project_id,margin_pct,contingency_pct,insurance_pct) VALUES ($1,20,10,0)`, [projectId]);

    await als.run({ orgId, userId: null, isAdmin: true, client }, async () => {
      await lines.addItem(orgId, projectId, item.rows[0].id);
      const hero = await lines.getEstimate(orgId, projectId);
      const totals = await lines.listBallparkTotals(orgId);
      const card = totals.get(projectId);
      assert.ok(card != null, 'card total should be non-null when the project has lines');
      assert.ok(Math.abs(card - hero.projectTotal) < 1e-6,
        `card ${card} != hero ${hero.projectTotal}`);
    });
  });

  test('card total is null for a project with no lines', async (t) => {
    if (!DB_URL) { t.skip('no DIRECT_URL/DATABASE_URL'); return; }
    if (!orgId) { t.skip('no agency org fixture'); return; }
    const pr = await client.query(
      `INSERT INTO projects (org_id,name,status,currency,ref) VALUES ($1,'S2 empty-card','draft','GBP','EMPTY-TEST') RETURNING id`, [orgId]);
    const projectId = pr.rows[0].id;
    created.push(projectId);
    await als.run({ orgId, userId: null, isAdmin: true, client }, async () => {
      const totals = await lines.listBallparkTotals(orgId);
      assert.ok(totals.has(projectId), 'the project should appear in the batch');
      assert.equal(totals.get(projectId), null, 'no-line project → null ("—")');
    });
  });
});
