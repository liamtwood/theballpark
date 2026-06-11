// pV2-02 — dev-only endpoints. 403 in production (NODE_ENV === 'production').
//
// GET /api/dev/users — the login page's dev picker list. Returns ONLY seeded
// identities: google_sub IS NULL **and** holding an active user_orgs
// membership. The membership requirement matters — v1's legacy persona rows
// also have google_sub IS NULL but no membership, so they stay out.

const router = require('express').Router();
const pool = require('../db/pool');
const { effectiveRole, normalizeOrgType } = require('../services/permissions.service');
const { authReadLimit } = require('../middleware/rate-limits');

router.get('/users', authReadLimit, async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Disabled in production' });
  }
  try {
    const r = await pool.query(
      `SELECT u.id, u.email, COALESCE(u.display_name, u.name) AS display_name, u.avatar_url,
              o.id AS org_id, o.name AS org_name, o.type AS org_type, uo.is_admin
         FROM users u
         JOIN user_orgs uo ON uo.user_id = u.id AND uo.status = 'active' AND uo.deleted_at IS NULL
         JOIN orgs o ON o.id = uo.org_id
        WHERE u.google_sub IS NULL AND u.deleted_at IS NULL
          AND (u.default_org_id IS NULL OR o.id = u.default_org_id)
        ORDER BY u.email`,
    );
    res.json(r.rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      activeOrgId: row.org_id,
      activeOrgName: row.org_name,
      activeOrgType: normalizeOrgType(row.org_type),
      isAdmin: row.is_admin,
      role: effectiveRole(row.org_type, row.is_admin),
    })));
  } catch (err) { next(err); }
});

module.exports = router;
