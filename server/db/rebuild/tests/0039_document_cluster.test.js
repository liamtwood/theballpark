/* Acceptance test for 0039_document_cluster (pV2-SOW-01) — the SOW document cluster
 * RLS + write-path coverage gate (the inbox bar; RLS audit 2026-11-13, S3). Runs as
 * the REAL app role (web_app_user, DATABASE_URL in the worktree-root .env). Builds its
 * own fixtures (one agency + two suppliers + a project + one engagement + a draft SOW,
 * plus a second agency/engagement for the B4 case) on the bootstrap/admin path inside
 * ONE transaction that ROLLS BACK — non-destructive, no dependence on seeded data.
 * Run: NODE_PATH=<server>/node_modules node <thisfile>
 *
 * Proves the audited bar (B1–B4 + S1/S2):
 *   ISOLATION (provider_read engagement-scoped, S2 deleted_at)
 *     a   agency reads its own doc
 *     b   engaged supplier reads the doc
 *     c   NON-engaged supplier reads NOTHING  (cross-supplier isolation)
 *     c2  a soft-deleted doc is hidden from the engaged supplier (S2)
 *   NO DIRECT WRITE (B1/B2/S1 — supplier/agency never write status or signatures direct)
 *     d   supplier direct UPDATE project_documents = DENIED
 *     e   supplier direct INSERT signature = DENIED (grant SELECT-only)
 *     f   AGENCY direct INSERT signature = DENIED (append-only even for the owner)
 *     g   agency direct INSERT line = DENIED (append-only; definer owns the freeze)
 *   DEFINER — engagement + sequence (B1/B2)
 *     h   non-engaged supplier document_confirm = REJECTED
 *     i   supplier document_sign before confirm (draft) = REJECTED
 *     j   engaged supplier document_confirm (draft→ready_to_sign) = OK
 *     k   agency document_sign before the supplier = REJECTED
 *     l   supplier document_sign (ready_to_sign→supplier_signed) = OK, signer set server-side
 *     m   agency document_sign (supplier_signed→executed) = OK
 *     n   second supplier sign (status past ready_to_sign) = REJECTED
 *   FREEZE (B3) — frozen once signed, column-scoped
 *     o   agency UPDATE a frozen column after executed = REJECTED (trigger)
 *     p   agency UPDATE presentation after executed = ALLOWED (freeze is column-scoped)
 *   SUPERSEDES GUARD (B4) — same org + (project, provider) chain only
 *     q   a second agency setting supersedes → the first agency's doc = REJECTED (invisible → not found)
 *     r   a doc superseding ITSELF = REJECTED
 *   LOCKDOWN
 *     s   document_confirm/document_sign not PUBLIC-executable, search_path pinned
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.resolve(__dirname, '../../../../.env'); // worktree-root .env
const DATABASE_URL = (fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.+)$/m) || [])[1];
if (!DATABASE_URL) { console.error('No DATABASE_URL in', envPath); process.exit(2); }

const SYS = '00000000-0000-0000-0000-000000000000'; // sentinel system user (exists)
const BP  = '00000000-0000-0000-0000-000000000001'; // Ballpark root org (orgs.parent_id)

(async () => {
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let fails = 0;
  const ok = (name, cond, detail) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!cond) fails++;
  };
  // transaction-local GUCs (is_local=true) so each context resets on ROLLBACK
  const as = (org, admin = false) => c.query(
    "SELECT set_config('app.current_org_id',$1,true), set_config('app.current_user_id',$2,true), set_config('app.is_admin',$3,true)",
    [org, SYS, admin ? 't' : 'f']);
  // A probe that EXPECTS a rejection: run inside a savepoint so a raise/zero-row write
  // doesn't poison the txn. Returns true when DENIED (threw, or RLS filtered to 0 rows).
  const deniedProbe = async (sql, params) => {
    await c.query('SAVEPOINT sp');
    try {
      const rr = await c.query(sql, params);
      const n = rr.rows && rr.rows[0] && 'n' in rr.rows[0] ? rr.rows[0].n : rr.rowCount;
      await c.query('RELEASE SAVEPOINT sp');
      return (n || 0) === 0;
    } catch (_e) {
      await c.query('ROLLBACK TO SAVEPOINT sp');
      return true;
    }
  };

  try {
    await c.query('BEGIN');

    // ── fixtures on the bootstrap/admin path (app_is_admin() with-check escape) ──
    await as(null, true);
    const tag = `zz-0039-${Date.now()}`;
    const mkOrg = async (suffix, type) => (await c.query(
      `INSERT INTO orgs (name, type, status, parent_id, created_by, updated_by)
       VALUES ($1,$2,'active',$3,$4,$4) RETURNING id`, [`${tag} ${suffix}`, type, BP, SYS])).rows[0].id;

    const agency  = await mkOrg('AGENCY',  'agency');
    const supA    = await mkOrg('SUP-A',   'supplier');   // engaged
    const supB    = await mkOrg('SUP-B',   'supplier');   // NOT engaged
    const agency2 = await mkOrg('AGENCY2', 'agency');     // the B4 attacker

    const mkProject = async (org) => (await c.query(
      `INSERT INTO projects (name, org_id, created_by, updated_by) VALUES ($1,$2,$3,$3) RETURNING id`,
      [`${tag} project`, org, SYS])).rows[0].id;
    const project  = await mkProject(agency);
    const project2 = await mkProject(agency2);

    const mkEngagement = async (org, proj, provider) => (await c.query(
      `INSERT INTO project_providers (org_id, project_id, provider_org_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$4) RETURNING id`, [org, proj, provider, SYS])).rows[0].id;
    const pp  = await mkEngagement(agency,  project,  supA);  // agency ↔ supplier A
    const pp2 = await mkEngagement(agency2, project2, supB);  // agency2 ↔ supplier B

    const mkDoc = async (org, proj, provider, supplier) => (await c.query(
      `INSERT INTO project_documents (org_id, project_id, project_provider_id, supplier_org_id, name, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$6) RETURNING id`,
      [org, proj, provider, supplier, `${tag} SOW`, SYS])).rows[0].id;
    const doc = await mkDoc(agency, project, pp, supA);

    // ── ISOLATION ──
    await as(agency);
    let r = await c.query('SELECT 1 FROM project_documents WHERE id=$1', [doc]);
    ok('a   agency reads its own doc', r.rows.length === 1);

    await as(supA);
    r = await c.query('SELECT 1 FROM project_documents WHERE id=$1', [doc]);
    ok('b   engaged supplier reads the doc', r.rows.length === 1);

    await as(supB);
    r = await c.query('SELECT 1 FROM project_documents WHERE id=$1', [doc]);
    ok('c   NON-engaged supplier reads nothing', r.rows.length === 0, `rows=${r.rows.length}, expect 0`);

    // c2 — soft-delete hides from the engaged supplier (S2). Mark deleted as admin, re-read as supA.
    await as(null, true);
    await c.query('SAVEPOINT s_del');
    await c.query('UPDATE project_documents SET deleted_at=now() WHERE id=$1', [doc]);
    await as(supA);
    r = await c.query('SELECT 1 FROM project_documents WHERE id=$1', [doc]);
    ok('c2  soft-deleted doc hidden from engaged supplier (S2)', r.rows.length === 0);
    await c.query('ROLLBACK TO SAVEPOINT s_del'); // restore the live doc

    // ── NO DIRECT WRITE ──
    await as(supA);
    ok('d   supplier direct UPDATE project_documents = DENIED', await deniedProbe(
      "WITH u AS (UPDATE project_documents SET status='ready_to_sign' WHERE id=$1 RETURNING 1) SELECT count(*)::int n FROM u", [doc]));
    ok('e   supplier direct INSERT signature = DENIED', await deniedProbe(
      "INSERT INTO project_document_signatures (org_id, document_id, role, name, created_by) VALUES ($1,$2,'supplier','forged',$3) RETURNING 1",
      [agency, doc, SYS]));

    await as(agency);
    ok('f   agency direct INSERT signature = DENIED (append-only)', await deniedProbe(
      "INSERT INTO project_document_signatures (org_id, document_id, role, name, created_by) VALUES ($1,$2,'agency','forged',$3) RETURNING 1",
      [agency, doc, SYS]));
    ok('g   agency direct INSERT line = DENIED (append-only)', await deniedProbe(
      "INSERT INTO project_document_lines (org_id, document_id, name, created_by) VALUES ($1,$2,'forged line',$3) RETURNING 1",
      [agency, doc, SYS]));

    // ── DEFINER: engagement + sequence ──
    await as(supB);
    ok('h   non-engaged supplier document_confirm = REJECTED', await deniedProbe(
      'SELECT status AS n FROM public.document_confirm($1)', [doc]));

    await as(supA);
    ok('i   supplier sign before confirm (draft) = REJECTED', await deniedProbe(
      "SELECT status AS n FROM public.document_sign($1,'supplier','Sam Supplier','Owner')", [doc]));

    r = await c.query('SELECT status FROM public.document_confirm($1)', [doc]);
    ok('j   engaged supplier document_confirm → ready_to_sign', r.rows[0]?.status === 'ready_to_sign', r.rows[0]?.status);

    await as(agency);
    ok('k   agency sign before supplier = REJECTED', await deniedProbe(
      "SELECT status AS n FROM public.document_sign($1,'agency','Alex Agency','Director')", [doc]));

    await as(supA);
    r = await c.query("SELECT status FROM public.document_sign($1,'supplier','Sam Supplier','Owner')", [doc]);
    ok('l   supplier document_sign → supplier_signed', r.rows[0]?.status === 'supplier_signed', r.rows[0]?.status);
    // signer set server-side from the session (not the client payload)
    r = await c.query("SELECT signer_org_id, signer_user_id FROM project_document_signatures WHERE document_id=$1 AND role='supplier'", [doc]);
    ok('l2  supplier signature signer resolved server-side', r.rows[0]?.signer_org_id === supA && r.rows[0]?.signer_user_id === SYS);

    await as(agency);
    r = await c.query("SELECT status FROM public.document_sign($1,'agency','Alex Agency','Director')", [doc]);
    ok('m   agency document_sign → executed', r.rows[0]?.status === 'executed', r.rows[0]?.status);

    await as(supA);
    ok('n   second supplier sign after sequence = REJECTED', await deniedProbe(
      "SELECT status AS n FROM public.document_sign($1,'supplier','Sam Again','Owner')", [doc]));

    // ── FREEZE (B3) — doc is now executed ──
    await as(agency);
    ok('o   agency UPDATE frozen column after executed = REJECTED', await deniedProbe(
      "WITH u AS (UPDATE project_documents SET name = name || ' x' WHERE id=$1 RETURNING 1) SELECT count(*)::int n FROM u", [doc]));
    r = await c.query("WITH u AS (UPDATE project_documents SET presentation = '{\"t\":1}'::jsonb WHERE id=$1 RETURNING 1) SELECT count(*)::int n FROM u", [doc]);
    ok('p   agency UPDATE presentation after executed = ALLOWED (column-scoped)', r.rows[0]?.n === 1, `rows=${r.rows[0]?.n}`);

    // ── SUPERSEDES GUARD (B4) ──
    await as(agency2); // the attacker's own tenant context
    ok('q   cross-agency supersedes → other org doc = REJECTED', await deniedProbe(
      `INSERT INTO project_documents (org_id, project_id, project_provider_id, supplier_org_id, name, supersedes_document_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,'change order',$5,$6,$6) RETURNING 1`,
      [agency2, project2, pp2, supB, doc, SYS]));

    await as(agency);
    ok('r   doc superseding itself = REJECTED', await deniedProbe(
      "WITH u AS (UPDATE project_documents SET supersedes_document_id = id WHERE id=$1 RETURNING 1) SELECT count(*)::int n FROM u", [doc]));

    // ── LOCKDOWN ──
    r = await c.query(`
      SELECT p.proname,
             has_function_privilege('public', p.oid, 'EXECUTE') AS pub,
             coalesce(array_to_string(p.proconfig, ','), '') AS cfg
        FROM pg_proc p WHERE p.proname IN ('document_confirm','document_sign')`);
    ok('s   definers not PUBLIC-executable', r.rows.length === 2 && r.rows.every((x) => x.pub === false));
    ok('s2  definers search_path pinned', r.rows.every((x) => /search_path=/.test(x.cfg)), r.rows.map((x) => x.cfg).join(' | '));
  } catch (e) {
    console.error('ERROR', e.message);
    fails++;
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    await c.end();
  }
  console.log(fails ? `\n${fails} FAILED — SOW cluster bar NOT met` : '\nALL PASS — SOW cluster RLS/write-path verified');
  process.exit(fails ? 1 : 0);
})();
