// Org-slice rebuild service (v2dev). Thin, RLS-aware. Every fn takes a `client`
// that is ALREADY inside a withRequest() transaction, so the caller decides the
// identity (admin / org-admin / member) the operation runs as — exactly as an
// API route handler would, scoped to the request.
//
// Creation model (follows the RLS policies in 0002/0003 and the build plan's
// invite-as-owner / concierge model): creating an org and seating its first
// owner is a BALLPARK-ADMIN action — the orgs_self and user_orgs_write WITH CHECK
// clauses block a plain user from self-creating an org or seeding their own first
// membership. True self-serve signup would need a SECURITY DEFINER RPC (later).

const { BALLPARK_ORG_ID } = require('../../db/rebuild/pool');

// Create an identity (admin ctx required). Users belong to the Ballpark instance
// (org_id = Ballpark #1); their real org membership lives in user_orgs.
async function createUser(client, { email, name, createdBy }) {
  const { rows } = await client.query(
    `insert into public.users (email, name, status, org_id, created_by, updated_by)
     values ($1, $2, 'active', $3, $4, $4)
     returning id, email, name, org_id`,
    [email, name, BALLPARK_ORG_ID, createdBy]
  );
  return rows[0];
}

// Provision a new org + seat its owner, atomically (admin ctx required).
async function createOrg(client, { name, type = 'agency', ownerUserId, createdBy }) {
  const org = (await client.query(
    `insert into public.orgs (name, type, status, parent_id, created_by, updated_by)
     values ($1, $2, 'active', $3, $4, $4)
     returning id, name, type, status, parent_id`,
    [name, type, BALLPARK_ORG_ID, createdBy]
  )).rows[0];

  await client.query(
    `insert into public.user_orgs
       (user_id, org_id, role, status, joined_at, invited_by_user_id, invited_at, created_by, updated_by)
     values ($1, $2, 'owner', 'active', now(), $3, now(), $3, $3)`,
    [ownerUserId, org.id, createdBy]
  );
  return org;
}

// Add a user to an existing org. Permitted for a Ballpark admin, or an active
// org-admin/owner of that org adding SOMEONE ELSE (user_orgs_write WITH CHECK).
async function addMember(client, { orgId, userId, role = 'member', actorUserId }) {
  const { rows } = await client.query(
    `insert into public.user_orgs
       (user_id, org_id, role, status, joined_at, invited_by_user_id, invited_at, created_by, updated_by)
     values ($1, $2, $3, 'active', now(), $4, now(), $4, $4)
     returning user_id, org_id, role, status`,
    [userId, orgId, role, actorUserId]
  );
  return rows[0];
}

// Reads used by the test / API (RLS decides what the caller actually sees).
async function listMyOrgs(client) {
  const { rows } = await client.query(`select id, name, type, status from public.orgs order by name`);
  return rows;
}
async function myMembership(client, orgId) {
  const { rows } = await client.query(
    `select user_id, org_id, role, status from public.user_orgs where org_id = $1`, [orgId]
  );
  return rows;
}

module.exports = { createUser, createOrg, addMember, listMyOrgs, myMembership };
