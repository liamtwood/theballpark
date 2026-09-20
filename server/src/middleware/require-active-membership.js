const pool = require('../db/pool');
const { als } = require('../db/request-context');
const { effectiveRole, normalizeOrgType, can } = require('../services/permissions.service');

/**
 * Middleware: re-reads live `user_orgs` per request and gates by an optional
 * permission. The safe default is ON — every v2 endpoint inherits it by being
 * mounted in the gated v2 router (see index.js), per WORKING_STANDARDS
 * §"Shared security standards live as middleware, not per-route conventions".
 *
 * Usage:
 *   router.use(requireActiveMembership());                     // any active member
 *   router.use(requireActiveMembership('org.invite_member'));  // and admin perm
 *
 * Reads `req.user` (populated by `authenticate` middleware from the JWT).
 * Reaches into the DB to verify the membership is STILL `status='active'` and
 * computes the CURRENT `is_admin` flag — so suspending or demoting takes
 * effect on the very next request, not when the JWT expires.
 *
 * On success: writes the fresh truth back to `req.user` (is_admin, org_type,
 * role) so downstream handlers never read stale JWT claims. The fresh row is
 * cached on `req.freshMembership`, so stacking a permission-specific instance
 * on top of the router-level default costs ONE query, not two.
 *
 * On failure: 401 if unauthenticated, 403 if membership missing/suspended,
 * 403 if the permission is denied.
 */
function requireActiveMembership(perm) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id || !req.user.org_id) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      let row = req.freshMembership;
      if (!row) {
        const r = await pool.query(
          `SELECT uo.is_admin, uo.status, o.type AS org_type
             FROM user_orgs uo
             JOIN orgs o ON o.id = uo.org_id
            WHERE uo.user_id = $1 AND uo.org_id = $2 AND uo.deleted_at IS NULL`,
          [req.user.id, req.user.org_id]
        );
        row = r.rows[0] || null;
        req.freshMembership = row;
      }
      if (!row || row.status !== 'active') {
        return res.status(403).json({ error: 'Membership suspended or revoked' });
      }
      // Overwrite stale JWT authority claims with live truth.
      const orgType = normalizeOrgType(row.org_type);
      req.user.is_admin = row.is_admin;
      req.user.org_type = orgType;
      req.user.role = effectiveRole(orgType, row.is_admin);

      // pV2-SECURITY-RLS-01 / BE-00126 — align the app.is_admin GUC with LIVE
      // platform-admin status. requestContext seeded it from the JWT, which since
      // pV2-02b carries IDENTITY ONLY (no is_admin/org_type), so it defaults to
      // false → app_is_admin() never engaged and post-flip a ballpark admin lost
      // cross-org RLS visibility (empty moderation marketplace, etc.). Platform
      // admin = BALLPARK membership only — NEVER row.is_admin (a per-org admin
      // must not gain cross-tenant bypass); orgType is already normalized, so the
      // stale orgs.type='admin' data resolves here too. Only ballpark members need
      // the flip (the requestContext default is already 'f'), so skip the extra
      // round-trip otherwise. set_config is session-level → only touch the PINNED
      // client, else the flag leaks to the next request on that pooled connection.
      if (orgType === 'ballpark') {
        const store = als.getStore();
        if (store && store.client) {
          store.isAdmin = true; // keep ALS in sync so in-request withTransaction writes agree
          await store.client.query("SELECT set_config('app.is_admin', 't', false)");
        }
      }

      if (perm && !can(orgType, row.is_admin, perm)) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      return next();
    } catch (err) { return next(err); }
  };
}

module.exports = { requireActiveMembership };
