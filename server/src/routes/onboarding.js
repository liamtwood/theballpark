// pV2-02b — onboarding. POST /api/onboarding/create-org turns an orgless
// authenticated user into the admin of a brand-new org (replaces pV2-02's
// auto-created "{name}'s Workspace" magic).
//
// Mounted BEFORE the gated v2 router in index.js — orgless users hit this
// endpoint by definition, so requireActiveMembership must not apply (same
// shape as /api/dev). authWriteLimit applies: this endpoint signs session
// cookies, which makes it an auth surface under WORKING_STANDARDS §"Auth
// surfaces are rate limited" (spec didn't mention it; flagged in the ship
// report).

const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/authenticate');
const { authWriteLimit } = require('../middleware/rate-limits');
const { withTransaction } = require('../db/with-transaction');
const { buildSession } = require('../services/auth.service');
const { signSessionCookie } = require('../services/auth-cookie.service');
const { CreateOrgSchema } = require('../schemas/onboarding.schema');

router.post('/create-org', authWriteLimit, authenticate, async (req, res, next) => {
  try {
    // Zod schema is the single definition of accepted input (pV2-AUDIT-03 —
    // the example endpoint for the pattern; others migrate as touched).
    const parsed = CreateOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: z.flattenError(parsed.error).fieldErrors,
      });
    }
    const { orgType, orgName: name } = parsed.data; // orgName arrives trimmed

    // Reject if the user already has an active membership. (Known benign
    // race: two concurrent submits could both pass this check — accepted for
    // a single-human form; SELECT … FOR UPDATE inside the txn is the fix if
    // it ever surfaces.)
    const existing = await pool.query(
      `SELECT 1 FROM user_orgs
        WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      [req.user.id]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'You already belong to an organisation' });
    }

    // Org + membership + default_org_id are all-or-nothing per
    // WORKING_STANDARDS §"Multi-statement DB writes are transactional".
    await withTransaction(async (client) => {
      const org = await client.query(
        `INSERT INTO orgs (name, type) VALUES ($1, $2) RETURNING id`,
        [name, orgType]
      );
      const orgId = org.rows[0].id;
      await client.query(
        `INSERT INTO user_orgs (user_id, org_id, is_admin, status, joined_at)
         VALUES ($1, $2, true, 'active', NOW())`,
        [req.user.id, orgId]
      );
      await client.query(
        `UPDATE users SET default_org_id = $2, updated_at = NOW() WHERE id = $1`,
        [req.user.id, orgId]
      );
    });

    // AFTER commit on purpose — buildSession reads via the shared pool (a
    // different connection), so inside the txn it can't see the new rows
    // (the spec's sketch had it inside; Rule 9 deviation, ship report).
    const sessionUser = await buildSession(req.user.id);

    // Refresh the cookie so the JWT's org_id identity claim carries the new org.
    signSessionCookie(res, sessionUser);
    res.json(sessionUser);
  } catch (err) { next(err); }
});

module.exports = router;
