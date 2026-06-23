/**
 * Runner — Universal Audit Columns migration (Item 1).
 *
 * Reads database/migration_universal_audit_columns.sql and applies it to the
 * schema in DATABASE_URL / APP_SCHEMA. The SQL is idempotent (CREATE OR REPLACE,
 * IF NOT EXISTS, DROP TRIGGER IF EXISTS) and skips absent tables, so it is safe
 * to re-run. v_guard is whatever the .sql file is set to:
 *   • Pass 1 = v_guard:=false  (6 columns + stamp trigger only, NO delete guard)
 *   • Pass 2 = v_guard:=true   (re-run after estimate_items + feedback converted)
 *
 * Usage: node src/db/run-audit-columns-migration.js
 */
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function main() {
  const file = path.join(__dirname, '../../../database/migration_universal_audit_columns.sql');
  const sql = fs.readFileSync(file, 'utf8');
  console.log(`[audit-migration] applying ${path.basename(file)} ...`);

  // Raw client (bypasses the pool.query write-wrapper) + capture NOTICEs.
  const client = await pool.connect();
  client.on('notice', (n) => console.log('  NOTICE:', n.message));
  try {
    await client.query(sql);
    console.log('[audit-migration] applied OK.\n');

    // ── Verify on a representative entity table ──────────────────────────────
    const sch = (await client.query('select current_schema() as s')).rows[0].s;
    const cols = await client.query(
      `select column_name from information_schema.columns
        where table_schema = $1 and table_name = 'items'
          and column_name in ('created_at','created_by','updated_at','updated_by','deleted_at','deleted_by')
        order by column_name`, [sch]);
    console.log(`[verify] ${sch}.items audit columns (expect 6):`, cols.rows.map((r) => r.column_name).join(', '));

    const trg = await client.query(
      `select tgname from pg_trigger
        where tgrelid = ($1 || '.items')::regclass and not tgisinternal order by tgname`, [sch]);
    console.log(`[verify] ${sch}.items triggers           :`, trg.rows.map((r) => r.tgname).join(', '),
                '(Pass 1 = trg_stamp_audit only; Pass 2 also has trg_forbid_hard_delete)');

    // ── End-to-end stamp test (rolled back — does NOT persist) ───────────────
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user_id','44444444-4444-4444-4444-444444444444',true)");
    const w = await client.query(
      `update items set name = name where id = (select id from items limit 1)
         returning updated_by, (updated_at >= now() - interval '5 seconds') as bumped`);
    await client.query('ROLLBACK');
    if (w.rows.length) {
      console.log('[verify] stamp test updated_by         :', w.rows[0].updated_by, '(expect the test uuid)');
      console.log('[verify] stamp test updated_at bumped  :', w.rows[0].bumped);
    } else {
      console.log('[verify] stamp test: no items row to test against');
    }

    // ── Guard tests (rolled back) — meaningful on Pass 2 (v_guard=true) ───────
    let entityRaised = false;
    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM items WHERE id = (select id from items limit 1)');
    } catch (e) {
      entityRaised = /hard delete forbidden/i.test(e.message);
    }
    await client.query('ROLLBACK');
    console.log('[verify] entity hard-delete RAISES     :', entityRaised, '(expect true on Pass 2)');

    let junctionOk = false;
    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM project_items WHERE id = (select id from project_items limit 1)');
      junctionOk = true;   // 0 or 1 rows, no raise = guard correctly OFF
    } catch (e) {
      junctionOk = false;
    }
    await client.query('ROLLBACK');
    console.log('[verify] junction hard-delete SUCCEEDS :', junctionOk, '(expect true — guard off on junctions)');
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((e) => { console.error('[audit-migration] ERROR:', e.message); process.exit(1); });
