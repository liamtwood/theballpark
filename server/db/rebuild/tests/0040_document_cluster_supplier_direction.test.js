/* Acceptance test for 0040_document_cluster_supplier_direction (pV2-SOW-01) — the
 * BIDIRECTIONAL SOW gate. Supersedes the 0039 test (which tested the old confirm flow).
 * Runs as the REAL app role (web_app_user, DATABASE_URL in the worktree-root .env).
 * Builds its own fixtures on the bootstrap/admin path inside ONE transaction that ROLLS
 * BACK — non-destructive. Requires 0040 applied to the target DB.
 * Run: NODE_PATH=<server>/node_modules node <thisfile>
 *
 * Fixtures: agencyA, agencyB, supA, supB; P1 (agencyA) w/ engagement pp1=agencyA↔supA;
 *   P2 (agencyB) w/ engagement pp2=agencyB↔supA. Two drafts:
 *     aDoc — AGENCY-authored  (org=agencyA, provider=pp1)  → supA is the counterparty
 *     sDoc — SUPPLIER-authored(org=supA,    provider=pp2)  → agencyB is the counterparty
 *
 * Proves (designer gate 2026-11-16):
 *   ISOLATION + the engagement PIN (no cross-project leak)
 *     a   owner reads own (both directions)
 *     b   counterparty reads via its engagement (both directions)
 *     c   CROSS-PROJECT: agencyA (engaged w/ supA on pp1) CANNOT read supA's sDoc on pp2
 *     d   unrelated supplier (supB) reads neither
 *     e   S2: soft-deleted sDoc hidden from its counterparty
 *   ENGAGEMENT GUARD
 *     f   author NOT a party to the engagement = REJECTED
 *     g   project_id <> pp.project_id (misfile onto another project) = REJECTED
 *   NO DIRECT WRITE (both directions, both parties)
 *     h   counterparty direct UPDATE = DENIED        (supplier-owned doc, agency caller)
 *     i   direct INSERT signature / line = DENIED    (SELECT-only grant)
 *   SIGN — derive-the-party, counterparty-first, role-spoof rejected (BOTH directions)
 *     j   author signs before counterparty = REJECTED (both directions)
 *     k   non-party document_sign = REJECTED
 *     l   ROLE-SPOOF: caller claims the other party's role = REJECTED (both directions)
 *     m   counterparty signs draft → counterparty_signed (both), signer server-side
 *     n   author counter-signs → executed (both)
 *     o   re-sign after sequence = REJECTED
 *   FREEZE (both directions)
 *     p   substance UPDATE after executed = REJECTED
 *     q   RE-POINT a signed doc to another engagement = REJECTED (binding freeze)
 *   LOCKDOWN
 *     r   document_confirm is GONE; document_sign not PUBLIC-exec, search_path pinned
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
      const n = rr.rows && rr.rows[0] && 'n' in rr.rows[0] ? rr.rows[0].n : rr.rowCount;
      await c.query('RELEASE SAVEPOINT sp');
      return (n || 0) === 0;
    } catch (_e) {
      await c.query('ROLLBACK TO SAVEPOINT sp');
      return true;
    }
  };
  const reads = async (org, docId) => { await as(org); const r = await c.query('SELECT 1 FROM project_documents WHERE id=$1', [docId]); return r.rows.length; };

  try {
    await c.query('BEGIN');
    await as(null, true);
    const tag = `zz-0040-${Date.now()}`;
    const mkOrg = async (suffix, type) => (await c.query(
      `INSERT INTO orgs (name, type, status, parent_id, created_by, updated_by)
       VALUES ($1,$2,'active',$3,$4,$4) RETURNING id`, [`${tag} ${suffix}`, type, BP, SYS])).rows[0].id;
    const agencyA = await mkOrg('AGENCY-A', 'agency');
    const agencyB = await mkOrg('AGENCY-B', 'agency');
    const supA    = await mkOrg('SUP-A',    'supplier');
    const supB    = await mkOrg('SUP-B',    'supplier');

    const mkProject = async (org) => (await c.query(
      `INSERT INTO projects (name, org_id, created_by, updated_by) VALUES ($1,$2,$3,$3) RETURNING id`,
      [`${tag} project`, org, SYS])).rows[0].id;
    const P1 = await mkProject(agencyA);
    const P2 = await mkProject(agencyB);

    const mkEngagement = async (org, proj, provider) => (await c.query(
      `INSERT INTO project_providers (org_id, project_id, provider_org_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$4) RETURNING id`, [org, proj, provider, SYS])).rows[0].id;
    const pp1 = await mkEngagement(agencyA, P1, supA);  // agencyA ↔ supA  (P1)
    const pp2 = await mkEngagement(agencyB, P2, supA);  // agencyB ↔ supA  (P2)

    const mkDoc = async (org, proj, provider, supplier) => (await c.query(
      `INSERT INTO project_documents (org_id, project_id, project_provider_id, supplier_org_id, name, status, content, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,'draft','[{"name":"Scope","content":"x","order":1}]'::jsonb,$6,$6) RETURNING id`,
      [org, proj, provider, supplier, `${tag} SOW`, SYS])).rows[0].id;
    const aDoc = await mkDoc(agencyA, P1, pp1, supA);   // AGENCY-authored
    const sDoc = await mkDoc(supA,    P2, pp2, supA);   // SUPPLIER-authored

    // ── ISOLATION + the engagement PIN ──
    ok('a1  agencyA reads its own aDoc',        (await reads(agencyA, aDoc)) === 1);
    ok('a2  supA reads its own sDoc',           (await reads(supA,    sDoc)) === 1);
    ok('b1  supA (counterparty) reads aDoc',    (await reads(supA,    aDoc)) === 1);
    ok('b2  agencyB (counterparty) reads sDoc', (await reads(agencyB, sDoc)) === 1);
    // THE PIN: agencyA is engaged with supA on pp1 — but sDoc is on pp2. Must NOT leak.
    ok('c   cross-project: agencyA CANNOT read supA sDoc (pin)', (await reads(agencyA, sDoc)) === 0);
    ok('d1  supB reads neither aDoc', (await reads(supB, aDoc)) === 0);
    ok('d2  supB reads neither sDoc', (await reads(supB, sDoc)) === 0);
    // e — S2 soft-delete hides sDoc from its counterparty agencyB
    await as(null, true);
    await c.query('SAVEPOINT s_del');
    await c.query('UPDATE project_documents SET deleted_at=now() WHERE id=$1', [sDoc]);
    ok('e   soft-deleted sDoc hidden from agencyB (S2)', (await reads(agencyB, sDoc)) === 0);
    await c.query('ROLLBACK TO SAVEPOINT s_del');

    // ── ENGAGEMENT GUARD ──
    await as(supB);
    ok('f   author not a party to the engagement = REJECTED', await deniedProbe(
      `INSERT INTO project_documents (org_id, project_id, project_provider_id, supplier_org_id, name, created_by, updated_by)
       VALUES ($1,$2,$3,$1,'bad',$4,$4) RETURNING 1`, [supB, P1, pp1, SYS]));
    await as(supA);
    ok('g   project_id <> pp.project_id (misfile) = REJECTED', await deniedProbe(
      `INSERT INTO project_documents (org_id, project_id, project_provider_id, supplier_org_id, name, created_by, updated_by)
       VALUES ($1,$2,$3,$1,'misfile',$4,$4) RETURNING 1`, [supA, P1, pp2, SYS])); // pp2 is on P2, not P1

    // ── NO DIRECT WRITE (supplier-owned doc, agency counterparty) ──
    await as(agencyB);
    ok('h   counterparty direct UPDATE sDoc = DENIED', await deniedProbe(
      "WITH u AS (UPDATE project_documents SET status='counterparty_signed' WHERE id=$1 RETURNING 1) SELECT count(*)::int n FROM u", [sDoc]));
    ok('i1  direct INSERT signature = DENIED', await deniedProbe(
      "INSERT INTO project_document_signatures (org_id, document_id, role, name, created_by) VALUES ($1,$2,'agency','forged',$3) RETURNING 1", [supA, sDoc, SYS]));
    await as(supA);
    ok('i2  owner direct INSERT line = DENIED (append-only)', await deniedProbe(
      "INSERT INTO project_document_lines (org_id, document_id, name, created_by) VALUES ($1,$2,'forged',$3) RETURNING 1", [supA, sDoc, SYS]));

    // ── SIGN: AGENCY direction (aDoc) — counterparty=supA first, author=agencyA last ──
    await as(agencyA);
    ok('j1  (agency dir) author signs before counterparty = REJECTED', await deniedProbe(
      "SELECT status AS n FROM public.document_sign($1,'agency','Alex','Dir')", [aDoc]));
    await as(supB);
    ok('k   non-party document_sign = REJECTED', await deniedProbe(
      "SELECT status AS n FROM public.document_sign($1,'supplier','Mallory','x')", [aDoc]));
    await as(supA);
    ok('l1  (agency dir) ROLE-SPOOF supA claims agency = REJECTED', await deniedProbe(
      "SELECT status AS n FROM public.document_sign($1,'agency','Sam','Owner')", [aDoc]));
    let r = await c.query("SELECT status FROM public.document_sign($1,'supplier','Sam','Owner')", [aDoc]);
    ok('m1  (agency dir) supA signs draft → counterparty_signed', r.rows[0]?.status === 'counterparty_signed', r.rows[0]?.status);
    r = await c.query("SELECT signer_org_id FROM project_document_signatures WHERE document_id=$1 AND role='supplier'", [aDoc]);
    ok('m1b (agency dir) signer resolved server-side', r.rows[0]?.signer_org_id === supA);
    await as(agencyA);
    r = await c.query("SELECT status FROM public.document_sign($1,'agency','Alex','Dir')", [aDoc]);
    ok('n1  (agency dir) agencyA counter-signs → executed', r.rows[0]?.status === 'executed', r.rows[0]?.status);
    await as(supA);
    ok('o1  (agency dir) re-sign after sequence = REJECTED', await deniedProbe(
      "SELECT status AS n FROM public.document_sign($1,'supplier','Sam','Owner')", [aDoc]));

    // ── SIGN: SUPPLIER direction (sDoc) — counterparty=agencyB first, author=supA last ──
    await as(supA);
    ok('j2  (supplier dir) author signs before counterparty = REJECTED', await deniedProbe(
      "SELECT status AS n FROM public.document_sign($1,'supplier','Sam','Owner')", [sDoc]));
    await as(agencyB);
    ok('l2  (supplier dir) ROLE-SPOOF agencyB claims supplier = REJECTED', await deniedProbe(
      "SELECT status AS n FROM public.document_sign($1,'supplier','Bri','Buyer')", [sDoc]));
    r = await c.query("SELECT status FROM public.document_sign($1,'agency','Bri','Buyer')", [sDoc]);
    ok('m2  (supplier dir) agencyB signs draft → counterparty_signed', r.rows[0]?.status === 'counterparty_signed', r.rows[0]?.status);
    r = await c.query("SELECT signer_org_id FROM project_document_signatures WHERE document_id=$1 AND role='agency'", [sDoc]);
    ok('m2b (supplier dir) signer resolved server-side', r.rows[0]?.signer_org_id === agencyB);
    await as(supA);
    r = await c.query("SELECT status FROM public.document_sign($1,'supplier','Sam','Owner')", [sDoc]);
    ok('n2  (supplier dir) supA counter-signs → executed', r.rows[0]?.status === 'executed', r.rows[0]?.status);

    // ── FREEZE (both directions) ──
    await as(agencyA);
    ok('p1  (agency dir) substance UPDATE after executed = REJECTED', await deniedProbe(
      "WITH u AS (UPDATE project_documents SET name = name || ' x' WHERE id=$1 RETURNING 1) SELECT count(*)::int n FROM u", [aDoc]));
    await as(supA);
    ok('p2  (supplier dir) content UPDATE after executed = REJECTED', await deniedProbe(
      "WITH u AS (UPDATE project_documents SET content='[]'::jsonb WHERE id=$1 RETURNING 1) SELECT count(*)::int n FROM u", [sDoc]));
    // q — re-point a SIGNED doc to another engagement (binding freeze). supA owns sDoc.
    ok('q   RE-POINT signed sDoc to another engagement = REJECTED', await deniedProbe(
      "WITH u AS (UPDATE project_documents SET project_provider_id=$2 WHERE id=$1 RETURNING 1) SELECT count(*)::int n FROM u", [sDoc, pp1]));

    // ── LOCKDOWN ──
    r = await c.query("SELECT 1 FROM pg_proc WHERE proname='document_confirm'");
    ok('r1  document_confirm is retired (dropped)', r.rows.length === 0);
    r = await c.query(`
      SELECT has_function_privilege('public', p.oid, 'EXECUTE') AS pub,
             coalesce(array_to_string(p.proconfig, ','), '') AS cfg
        FROM pg_proc p WHERE p.proname = 'document_sign'`);
    ok('r2  document_sign not PUBLIC-executable', r.rows.length === 1 && r.rows[0].pub === false);
    ok('r3  document_sign search_path pinned', r.rows.every((x) => /search_path=/.test(x.cfg)), r.rows.map((x) => x.cfg).join(' | '));
  } catch (e) {
    console.error('ERROR', e.message);
    fails++;
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    await c.end();
  }
  console.log(fails ? `\n${fails} FAILED — bidirectional SOW bar NOT met` : '\nALL PASS — bidirectional SOW RLS/write-path verified');
  process.exit(fails ? 1 : 0);
})();
