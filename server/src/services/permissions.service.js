// pV2-02 — RBAC permissions matrix (server side). MIRRORED in
// client-v2/src/app/core/auth/permissions.ts — keep the two in sync.
//
// No role enum is stored: the effective role derives from the active org's
// type + the membership's is_admin flag at session time.

/** Normalise legacy v1 org types to the v2 union. The dev DB's existing
 *  'Ballpark' org predates pV2-02 and carries type 'admin' — v1 data is not
 *  mutated (v1 on 4200 must keep working), so the mapping happens here. */
function normalizeOrgType(orgType) {
  return orgType === 'admin' ? 'ballpark' : orgType;
}

/** (orgType, isAdmin) → one of the five effective roles. */
function effectiveRole(orgType, isAdmin) {
  const t = normalizeOrgType(orgType);
  if (t === 'ballpark') return 'ballpark_admin'; // ballpark members are always admins
  if (t === 'agency') return isAdmin ? 'agency_admin' : 'agency_member';
  if (t === 'supplier') return isAdmin ? 'supplier_admin' : 'supplier_member';
  throw new Error(`Unknown org type: ${orgType}`);
}

const MATRIX = {
  ballpark_admin: ['admin.cross_org_view'],
  agency_admin: ['org.invite_member', 'org.manage_billing', 'project.create', 'project.delete', 'item.create', 'item.delete', 'inbox.reply', 'inbox.adjust_cost', 'cart.checkout'],
  agency_member: ['project.create', 'item.create', 'inbox.reply', 'inbox.adjust_cost', 'cart.checkout'],
  supplier_admin: ['org.invite_member', 'org.manage_billing', 'item.create', 'item.delete', 'inbox.reply', 'inbox.adjust_cost'],
  supplier_member: ['item.create', 'inbox.reply', 'inbox.adjust_cost'],
};

/** True when the (orgType, isAdmin) pair grants the permission. */
function can(orgType, isAdmin, perm) {
  return MATRIX[effectiveRole(orgType, isAdmin)].includes(perm);
}

module.exports = { effectiveRole, normalizeOrgType, can, MATRIX };
