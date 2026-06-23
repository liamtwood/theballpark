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
const { z } = require('zod');
const pool = require('../db/pool');
const ConfigService = require('../services/config.service');
const { authenticate, COOKIE_NAME } = require('../middleware/authenticate');
const { requireActiveMembership } = require('../middleware/require-active-membership');
const { PageConfigSchema } = require('../schemas/page-config.schema');

// ── v2 path detection (pV2-04b) ──────────────────────────────────────────────
// This router serves BOTH apps on the same URLs. v2 callers are identified by
// the bp_session cookie (v1 has no cookie; it sends x-bp-user-id). The v2
// branch applies the real middleware chain (authenticate +
// requireActiveMembership) — NOT a re-rolled check (ENGINEERING.md Rule 6).
// This dual-auth shim dies with v1 (pV2-11).
const isV2 = (req) => !!(req.cookies && req.cookies[COOKIE_NAME]);

/** Run an express middleware chain only for v2 (cookie) callers. */
const v2Only = (...chain) => (req, res, next) => {
  if (!isV2(req)) return next();
  let i = 0;
  const step = (err) => {
    if (err) return next(err);
    const mw = chain[i++];
    if (!mw) return next();
    mw(req, res, step);
  };
  step();
};

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
// GET — v1: open (legacy); v2 (cookie): authenticated + live membership, and
// the response is the v2Home SLICE (flat PageConfigPayload), not v1's row.
router.get('/:orgType', v2Only(authenticate, requireActiveMembership()), async (req, res, next) => {
  try {
    if (isV2(req)) {
      if (!ConfigService.isValid(req.params.orgType)) {
        return res.status(400).json({ error: 'Invalid org_type' });
      }
      return res.json(await ConfigService.getV2Home(req.params.orgType));
    }
    const row = await ConfigService.get(req.params.orgType);
    if (!row) {
      return res.status(400).json({ error: 'Invalid org_type' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// PUT — v1: platform admin via x-bp-user-id (legacy, full-payload upsert).
// v2 (cookie): PLATFORM admins only (admin.cross_org_view) — page settings
// are org_type-WIDE, so org-level admin is not enough (Liam 2026-06-11;
// restores v1's requirePlatformAdmin model). Ballpark admins write ANY
// org_type's v2Home slice; Zod-validated.
router.put(
  '/:orgType',
  v2Only(authenticate, requireActiveMembership('admin.cross_org_view')),
  (req, res, next) => (isV2(req) ? next() : requirePlatformAdmin(req, res, next)),
  async (req, res, next) => {
    try {
      if (!ConfigService.isValid(req.params.orgType)) {
        return res.status(400).json({ error: 'Invalid org_type' });
      }
      if (isV2(req)) {
        const parsed = PageConfigSchema.safeParse(req.body && req.body.payload);
        if (!parsed.success) {
          return res.status(400).json({
            error: 'Invalid input',
            details: z.flattenError(parsed.error).fieldErrors,
          });
        }
        const row = await ConfigService.setV2Home(req.params.orgType, parsed.data, req.user.id);
        return res.json(row.v2_home);
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
  }
);

module.exports = router;
