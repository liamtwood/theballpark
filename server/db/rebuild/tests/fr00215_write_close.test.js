/* Acceptance test for 0013_security_fr00215 — proves the admin cross-org WRITE
 * backdoor is SHUT. Runs as the REAL app role (web_app_user, from DATABASE_URL),
 * simulating a non-member ballpark admin (is_admin=t, acting as Ballpark) against a
 * supplier (Yahire) it holds no seat in. All writes run in a txn that ROLLS BACK —
 * non-destructive.
 *
 * FAILS if app_is_admin() is ever put back into the orgs/items UPDATE policy (a/b
 * would then update rows). Run: NODE_PATH=<main>/node_modules node <thisfile>
 *
 * FULLY CLOSED (items slice, 0015/0017): UPDATE-denied (a/b), INSERT-denied (e),
 * self-grant denied (d), moderation scoped to approval_status (c allowed; f — a
 * cross-org name change under svc_moderate — DENIED by the column-guard trigger).
 * The drift-guard now watches INSERT too: FAILS if app_is_admin() is ever put back
 * into the items UPDATE *or* INSERT policy.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.resolve(__dirname, '../../../../.env'); // worktree-root .env
const DATABASE_URL = (fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.+)$/m) || [])[1];
if (!DATABASE_URL) { console.error('No DATABASE_URL in', envPath); process.exit(2); }

const BALLPARK = '00000000-0000-0000-0000-000000000001'; // the admin's own (current) org
const ADMIN    = '00000000-0000-0000-0000-000000000000'; // System admin — member of Ballpark only
const YAHIRE   = 'c5ad93e1-f391-4caa-8e22-dc985a5ead51'; // a supplier the admin has NO seat in (has items)

(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let fails = 0;
  const ok = (name, cond, detail) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!cond) fails++;
  };
  try {
    await c.query('BEGIN');
    // context: non-member admin acting as Ballpark
    await c.query(
      "SELECT set_config('app.current_org_id',$1,false), set_config('app.current_user_id',$2,false), set_config('app.is_admin','t',false), set_config('app.svc_moderate','f',false)",
      [BALLPARK, ADMIN]);

    let r = await c.query("WITH u AS (UPDATE items SET name=name WHERE org_id=$1 AND deleted_at IS NULL RETURNING 1) SELECT count(*)::int n FROM u", [YAHIRE]);
    ok('a  non-member admin UPDATE supplier item = DENIED', r.rows[0].n === 0, `rows=${r.rows[0].n}, expect 0`);

    r = await c.query("WITH u AS (UPDATE orgs SET description=description WHERE id=$1 RETURNING 1) SELECT count(*)::int n FROM u", [YAHIRE]);
    ok('b  non-member admin UPDATE supplier org  = DENIED', r.rows[0].n === 0, `rows=${r.rows[0].n}, expect 0`);

    await c.query("SELECT set_config('app.svc_moderate','t',false)");
    r = await c.query("WITH u AS (UPDATE items SET approval_status=approval_status WHERE org_id=$1 AND deleted_at IS NULL RETURNING 1) SELECT count(*)::int n FROM u", [YAHIRE]);
    ok('c  moderation (svc_moderate) UPDATE approval = ALLOWED', r.rows[0].n > 0, `rows=${r.rows[0].n}, expect >0`);
    await c.query("SELECT set_config('app.svc_moderate','f',false)");

    // A probe that EXPECTS a rejection aborts the txn — run each inside a savepoint so
    // the catch can ROLLBACK TO it and the suite continues. Returns true when DENIED.
    const deniedProbe = async (sql, params) => {
      await c.query('SAVEPOINT sp');
      try {
        const rr = await c.query(sql, params);
        // No throw → check it actually wrote nothing (RLS can filter to 0 rows w/o error).
        const n = rr.rows && rr.rows[0] && 'n' in rr.rows[0] ? rr.rows[0].n : rr.rowCount;
        await c.query('RELEASE SAVEPOINT sp');
        return n === 0;
      } catch (_e) {
        await c.query('ROLLBACK TO SAVEPOINT sp');
        return true; // RLS WITH CHECK / trigger rejection
      }
    };

    // (d) self-grant: a non-admin user inserting their own membership = DENIED
    await c.query("SELECT set_config('app.is_admin','f',false)");
    ok('d  non-admin self-grant membership = DENIED',
      await deniedProbe("INSERT INTO user_orgs(user_id,org_id,role,status,created_by) VALUES ($1,$2,'owner','active',$1) RETURNING 1", [ADMIN, YAHIRE]));

    // (e) non-member admin INSERT supplier item = DENIED (FR-00215 INSERT close, 0015).
    // items_insert WITH CHECK is org_id = app_current_org() with NO admin escape, so an
    // admin acting as Ballpark cannot mint a row in Yahire. Drift-guard: this FAILS if
    // app_is_admin() is ever re-added to the items INSERT policy.
    await c.query("SELECT set_config('app.is_admin','t',false), set_config('app.svc_moderate','f',false)");
    ok('e  non-member admin INSERT supplier item = DENIED',
      await deniedProbe("INSERT INTO items(org_id,name,status,approval_status) VALUES($1,'rls-insert-probe','new','approved') RETURNING 1", [YAHIRE]));

    // (f) moderation is COLUMN-scoped: under svc_moderate only approval_status (+ deleted_at)
    // may change on a cross-org item — a name change is DENIED by the items_svc_moderate_guard
    // trigger (0017). Proves the svc_moderate escape can't be used to edit another org's content.
    await c.query("SELECT set_config('app.is_admin','f',false), set_config('app.svc_moderate','t',false)");
    ok('f  svc_moderate name change cross-org = DENIED (column-guard)',
      await deniedProbe("WITH u AS (UPDATE items SET name = name || ' x' WHERE org_id=$1 AND deleted_at IS NULL RETURNING 1) SELECT count(*)::int n FROM u", [YAHIRE]));
    await c.query("SELECT set_config('app.svc_moderate','f',false)");
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    await c.end();
  }
  console.log(fails ? `\n${fails} FAILED — hole NOT shut` : '\nALL PASSED — write-close verified');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
