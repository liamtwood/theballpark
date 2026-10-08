/* Acceptance test for 0013_security_fr00215 — proves the admin cross-org WRITE
 * backdoor is SHUT. Runs as the REAL app role (web_app_user, from DATABASE_URL),
 * simulating a non-member ballpark admin (is_admin=t, acting as Ballpark) against a
 * supplier (Yahire) it holds no seat in. All writes run in a txn that ROLLS BACK —
 * non-destructive.
 *
 * FAILS if app_is_admin() is ever put back into the orgs/items UPDATE policy (a/b
 * would then update rows). Run: NODE_PATH=<main>/node_modules node <thisfile>
 *
 * TWO-STAGE (per DATA-MODEL-REDESIGN): this asserts UPDATE-denied now; the
 * INSERT-denied assertion (marked TODO below) lands in the items-rebuild slice when
 * the INSERT escape closes + extract switches to current-org.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.resolve(__dirname, '../../../../.env'); // worktree-root .env
const DATABASE_URL = (fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.+)$/m) || [])[1];
if (!DATABASE_URL) { console.error('No DATABASE_URL in', envPath); process.exit(2); }

const BALLPARK = '00000000-0000-0000-0000-000000000001'; // the admin's own (current) org
const ADMIN    = '00000000-0000-0000-0000-000000000000'; // System admin — member of Ballpark only
const YAHIRE   = 'deadd8bc-9ab1-464e-9524-004505492b01'; // a supplier the admin has NO seat in

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

    // (d) self-grant: a non-admin user inserting their own membership = DENIED
    await c.query("SELECT set_config('app.is_admin','f',false)");
    let denied = false;
    try {
      r = await c.query("INSERT INTO user_orgs(user_id,org_id,role,status,created_by) VALUES ($1,$2,'owner','active',$1) RETURNING 1", [ADMIN, YAHIRE]);
      denied = r.rowCount === 0;
    } catch (_e) { denied = true; } // RLS WITH CHECK rejection
    ok('d  non-admin self-grant membership = DENIED', denied);

    // TODO(items-slice): e  non-member admin INSERT supplier item = DENIED
    //   (INSERT escape is intentionally OPEN this slice — assert once it closes.)
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    await c.end();
  }
  console.log(fails ? `\n${fails} FAILED — hole NOT shut` : '\nALL PASSED — write-close verified');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
