// Org-slice acceptance test (runs against the LIVE v2dev DB as web_app_user).
// Proves: admin can provision an org + owner; an org-admin can add a member;
// the member then sees the org; and a NON-member is fully isolated by RLS.
// Reversible: everything created is tagged with a per-run id and hard-deleted
// in FK order at the end (even on failure).
//
// Run:  NODE_PATH=C:/projects/ballpark/server/node_modules \
//       node C:/projects/ballpark/.worktrees/org-slice/server/src/services/rebuild/org.rebuild.test.js
const { pool, withRequest, SYSTEM_USER_ID } = require('../../db/rebuild/pool');
const svc = require('./org.rebuild.service');

const TAG = 'rbtest-' + Date.now();
const ADMIN = { isAdmin: true, userId: SYSTEM_USER_ID };
let pass = 0, fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else      { fail++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
}

(async () => {
  let A, B, C, org;
  try {
    // 1) Admin provisions users + an org with A as owner
    await withRequest(ADMIN, async (c) => {
      A = await svc.createUser(c, { email: `a-${TAG}@test.local`, name: `Owner A ${TAG}`, createdBy: SYSTEM_USER_ID });
      B = await svc.createUser(c, { email: `b-${TAG}@test.local`, name: `Member B ${TAG}`, createdBy: SYSTEM_USER_ID });
      C = await svc.createUser(c, { email: `c-${TAG}@test.local`, name: `Outsider C ${TAG}`, createdBy: SYSTEM_USER_ID });
      org = await svc.createOrg(c, { name: `Acme Events ${TAG}`, type: 'agency', ownerUserId: A.id, createdBy: SYSTEM_USER_ID });
    });
    console.log(`\nProvisioned org ${org.name} (${org.id}); owner A=${A.id}\n`);
    check('createOrg returns an active agency org', org.status === 'active' && org.type === 'agency');

    // 2) Owner A (its own org context) sees exactly its org, and is owner
    await withRequest({ userId: A.id, orgId: org.id }, async (c) => {
      const orgs = await svc.listMyOrgs(c);
      check('A sees exactly 1 org (its own)', orgs.length === 1 && orgs[0].id === org.id, JSON.stringify(orgs.map(o => o.name)));
      const mem = await svc.myMembership(c, org.id);
      const a = mem.find(m => m.user_id === A.id);
      check('A is owner, active', a && a.role === 'owner' && a.status === 'active');
    });

    // 3) Owner A (an active org-admin) adds B as a member
    await withRequest({ userId: A.id, orgId: org.id }, async (c) => {
      const m = await svc.addMember(c, { orgId: org.id, userId: B.id, role: 'member', actorUserId: A.id });
      check('A can add B as member', m && m.role === 'member' && m.status === 'active');
    });

    // 4) Member B now sees the org
    await withRequest({ userId: B.id, orgId: org.id }, async (c) => {
      const orgs = await svc.listMyOrgs(c);
      check('B now sees the org', orgs.length === 1 && orgs[0].id === org.id);
      const mem = await svc.myMembership(c, org.id);
      check('B sees own membership row', mem.some(m => m.user_id === B.id && m.role === 'member'));
    });

    // 5) Outsider C (no membership, no org context) is fully isolated
    await withRequest({ userId: C.id }, async (c) => {
      const orgs = await svc.listMyOrgs(c);
      check('C sees NO orgs (RLS isolation)', orgs.length === 0, `saw ${orgs.length}`);
      const mem = await svc.myMembership(c, org.id);
      check('C cannot enumerate the org members', mem.length === 0, `saw ${mem.length}`);
    });

    // 6) Outsider C cannot add anyone to the org (write policy denies it)
    let denied = false;
    try {
      await withRequest({ userId: C.id, orgId: org.id }, async (c) => {
        await svc.addMember(c, { orgId: org.id, userId: C.id, role: 'member', actorUserId: C.id });
      });
    } catch (e) { denied = true; }
    check('C is blocked from adding members (write RLS)', denied);

  } catch (e) {
    fail++; console.log('\n  ERROR during test: ' + e.message + '\n' + (e.stack || ''));
  } finally {
    // Reversible cleanup — hard delete in FK order, scoped to this run's TAG.
    try {
      await withRequest(ADMIN, async (c) => {
        await c.query(
          `delete from public.user_orgs where org_id in (select id from public.orgs where name like $1)`, [`%${TAG}%`]);
        await c.query(`delete from public.orgs  where name  like $1`, [`%${TAG}%`]);
        await c.query(`delete from public.users where email like $1`, [`%${TAG}%`]);
      });
      console.log(`\nCleaned up run ${TAG}.`);
    } catch (e) { console.log(`\nCLEANUP FAILED for ${TAG}: ${e.message} (manual cleanup may be needed)`); }
    await pool.end();
    console.log(`\n==== ${pass} passed, ${fail} failed ====`);
    process.exit(fail ? 1 : 0);
  }
})();
