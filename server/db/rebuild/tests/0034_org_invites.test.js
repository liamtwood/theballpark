/* Acceptance test for 0034_org_invites (pV2-INVITE-SUPPLIER-01). Runs as the REAL
 * app role (web_app_user, DATABASE_URL in the worktree-root .env). Builds its own
 * fixtures (two agencies + a pending supplier + one invite) on the bootstrap path
 * inside ONE transaction that ROLLS BACK — non-destructive, no dependence on
 * seeded data. Run: NODE_PATH=<server>/node_modules node <thisfile>
 *
 * Proves:
 *  a  inviting agency reads its org_invites row; the other agency reads none
 *  b  invited_supplier_contact answers the inviting agency only (name + pending)
 *  c  the pending org is NOT in supplier_directory and NOT readable via orgs RLS
 *  d  a tenant (no bootstrap flag) cannot INSERT / UPDATE org_invites
 *  e  the supplier's own members read the rows for their org
 *  f  the pending org reads no projects
 *  g  definer lockdown: no PUBLIC execute, search_path pinned
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.resolve(__dirname, '../../../../.env');
const DATABASE_URL = (fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.+)$/m) || [])[1];
if (!DATABASE_URL) { console.error('No DATABASE_URL in', envPath); process.exit(2); }

const SYS = '00000000-0000-0000-0000-000000000000';
const BP  = '00000000-0000-0000-0000-000000000001';

(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let fails = 0;
  const ok = (name, cond, detail) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!cond) fails++;
  };
  const as = (org, admin = false) => c.query(
    "SELECT set_config('app.current_org_id',$1,true), set_config('app.current_user_id',$2,true), set_config('app.is_admin',$3,true)",
    [org, SYS, admin ? 't' : 'f']);
  const deniedProbe = async (sql, params) => {
    await c.query('SAVEPOINT sp');
    try {
      const rr = await c.query(sql, params);
      await c.query('RELEASE SAVEPOINT sp');
      return (rr.rowCount || 0) === 0;
    } catch (_e) {
      await c.query('ROLLBACK TO SAVEPOINT sp');
      return true;
    }
  };
  try {
    await c.query('BEGIN');
    // ── fixtures on the bootstrap path ──
    await as(null, true);
    const mk = async (name, type, status) => (await c.query(
      `INSERT INTO orgs (name, type, status, parent_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`, [name, type, status, BP, SYS])).rows[0].id;
    const tag = `zz-0034-${Date.now()}`;
    const agA = await mk(`${tag} A`, 'agency', 'active');
    const agB = await mk(`${tag} B`, 'agency', 'active');
    const sup = await mk(`${tag} S`, 'supplier', 'pending');
    await c.query(
      `INSERT INTO org_invites (supplier_org_id, agency_org_id, invited_by_user_id, created_by)
       VALUES ($1,$2,$3,$3)`, [sup, agA, SYS]);

    // a
    await as(agA);
    let r = await c.query('SELECT 1 FROM org_invites WHERE supplier_org_id=$1', [sup]);
    ok('a  inviting agency reads its invite row', r.rows.length === 1);
    await as(agB);
    r = await c.query('SELECT 1 FROM org_invites WHERE supplier_org_id=$1', [sup]);
    ok('a2 other agency reads no invite rows', r.rows.length === 0);
    // b
    r = await c.query('SELECT 1 FROM invited_supplier_contact($1)', [sup]);
    ok('b  contact fn denies an agency that did not invite', r.rows.length === 0);
    await as(agA);
    r = await c.query('SELECT name, status FROM invited_supplier_contact($1)', [sup]);
    ok('b2 contact fn answers the inviting agency (pending)', r.rows[0]?.status === 'pending');
    // c
    r = await c.query('SELECT 1 FROM supplier_directory WHERE id=$1', [sup]);
    ok('c  pending org absent from supplier_directory', r.rows.length === 0);
    r = await c.query('SELECT 1 FROM orgs WHERE id=$1', [sup]);
    ok('c2 pending org hidden by orgs RLS', r.rows.length === 0);
    // d
    ok('d  tenant INSERT org_invites = DENIED', await deniedProbe(
      'INSERT INTO org_invites (supplier_org_id, agency_org_id, invited_by_user_id, created_by) VALUES ($1,$2,$3,$3)',
      [sup, agB, SYS]));
    ok('d2 tenant UPDATE org_invites = DENIED', await deniedProbe(
      'UPDATE org_invites SET agency_org_id=$2 WHERE supplier_org_id=$1', [sup, agB]));
    // e
    await as(sup);
    r = await c.query('SELECT agency_org_id FROM org_invites');
    ok('e  supplier members read their invite rows', r.rows.length === 1 && r.rows[0].agency_org_id === agA);
    // f
    r = await c.query('SELECT 1 FROM projects LIMIT 1');
    ok('f  pending org reads no projects', r.rows.length === 0);
    // g
    r = await c.query(`
      SELECT has_function_privilege('public', p.oid, 'EXECUTE') AS pub,
             coalesce(array_to_string(p.proconfig, ','), '') AS cfg
        FROM pg_proc p WHERE p.proname = 'invited_supplier_contact'`);
    ok('g  definer not PUBLIC-executable', r.rows[0] && r.rows[0].pub === false);
    ok('g2 definer search_path pinned', r.rows[0] && /search_path=/.test(r.rows[0].cfg), r.rows[0]?.cfg);
  } catch (e) {
    console.error('ERROR', e.message);
    fails++;
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    await c.end();
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
