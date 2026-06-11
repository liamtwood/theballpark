/**
 * Org-Type Config routes (Piece 2 / p0021)
 *
 *   GET  /api/config/:orgType   — read one org_type's config payload.
 *                                 Open to any authenticated user (everyone
 *                                 consumes their own org_type's config).
 *   PUT  /api/config/:orgType   — author one org_type's config payload.
 *                                 PLATFORM ADMIN ONLY (org whose type='admin').
 *
 * Auth note: identity comes from the `x-bp-user-id` header — the same stopgap
 * the admin middleware uses until real Supabase JWT auth lands. The PUT guard
 * is stricter than the generic requireAdmin: it requires the caller's *org*
 * type to be 'admin' (the platform org), not merely role='admin' (which every
 * org's admin has). The RLS policy in the migration mirrors this as
 * defense-in-depth for direct DB access.
 */

const router = require('express').Router();
const pool = require('../db/pool');
const ConfigService = require('../services/config.service');

// --- Platform-admin guard ---------------------------------------------------
async function requirePlatformAdmin(req, res, next) {
  const userId = req.header('x-bp-user-id');
  if (!userId) {
    return res.status(401).json({ error: 'Missing x-bp-user-id header' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT 1
         FROM users u
         JOIN orgs  o ON o.id = u.org_id
        WHERE u.id = $1
          AND o.type = 'admin'
        LIMIT 1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(403).json({ error: 'Platform admin access required' });
    }
    req.platformAdminUserId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

// --- Routes -----------------------------------------------------------------
router.get('/:orgType', async (req, res, next) => {
  try {
    const row = await ConfigService.get(req.params.orgType);
    if (!row) {
      return res.status(400).json({ error: 'Invalid org_type' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.put('/:orgType', requirePlatformAdmin, async (req, res, next) => {
  try {
    if (!ConfigService.isValid(req.params.orgType)) {
      return res.status(400).json({ error: 'Invalid org_type' });
    }
    const payload = req.body && req.body.payload;
    const row = await ConfigService.upsert(
      req.params.orgType,
      payload,
      req.platformAdminUserId
    );
    res.json(row);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
