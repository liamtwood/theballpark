// pV2-03 — team management (/api/team/*). v2-only surface: every route runs
// the JWT middleware + a LIVE membership check (fresh DB read each request, so
// a suspension takes effect on the member's very next call — criterion 5).
// Writes always scope to the requester's org from the verified JWT, never the
// body. Admin-gated via can(orgType, isAdmin, 'org.invite_member').

const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate } = require('../middleware/authenticate');
const { can, effectiveRole, normalizeOrgType } = require('../services/permissions.service');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fresh membership for (userId, orgId): { is_admin, status, org_type } or null. */
async function liveMembership(userId, orgId) {
  const r = await pool.query(
    `SELECT uo.is_admin, uo.status, o.type AS org_type
       FROM user_orgs uo JOIN orgs o ON o.id = uo.org_id
      WHERE uo.user_id = $1 AND uo.org_id = $2 AND uo.deleted_at IS NULL`,
    [userId, orgId]
  );
  return r.rows[0] || null;
}

// authenticate + live status/permission gate for the whole router.
router.use(authenticate, async (req, res, next) => {
  try {
    const m = await liveMembership(req.user.id, req.user.org_id);
    if (!m || m.status === 'suspended') {
      return res.status(403).json({ error: 'Membership suspended or revoked' });
    }
    if (!can(m.org_type, m.is_admin, 'org.invite_member')) {
      return res.status(403).json({ error: 'Admin permission required' });
    }
    req.membership = m;
    next();
  } catch (err) { next(err); }
});

const memberSelect = `
  SELECT u.id AS user_id, u.email, u.display_name, u.avatar_url,
         uo.job_title, uo.is_admin, uo.status,
         uo.invited_at, uo.joined_at
    FROM user_orgs uo JOIN users u ON u.id = uo.user_id
   WHERE uo.org_id = $1 AND uo.deleted_at IS NULL AND u.deleted_at IS NULL`;

function toMember(row) {
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    jobTitle: row.job_title,
    isAdmin: row.is_admin,
    status: row.status,
    invitedAt: row.invited_at,
    joinedAt: row.joined_at,
  };
}

// GET /api/team — members of the requester's org.
router.get('/', async (req, res, next) => {
  try {
    const r = await pool.query(`${memberSelect} ORDER BY u.display_name NULLS LAST, u.email`, [req.user.org_id]);
    res.json(r.rows.map(toMember));
  } catch (err) { next(err); }
});

/** Target membership within the requester's org, or null (cross-org → 404). */
async function targetMembership(userId, orgId, { includeDeleted = false } = {}) {
  const r = await pool.query(
    `SELECT uo.user_id, uo.org_id, uo.is_admin, uo.status, uo.deleted_at
       FROM user_orgs uo WHERE uo.user_id = $1 AND uo.org_id = $2
        ${includeDeleted ? '' : 'AND uo.deleted_at IS NULL'}`,
    [userId, orgId]
  );
  return r.rows[0] || null;
}

/** Active-admin count excluding one user (for the last-admin guard). */
async function otherActiveAdmins(orgId, excludeUserId) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM user_orgs
      WHERE org_id = $1 AND user_id <> $2 AND is_admin = true
        AND status = 'active' AND deleted_at IS NULL`,
    [orgId, excludeUserId]
  );
  return r.rows[0].n;
}

// POST /api/team/invite — { email, displayName?, jobTitle?, isAdmin? }
router.post('/invite', async (req, res, next) => {
  try {
    const { email, displayName, jobTitle, isAdmin } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Valid email required' });
    const orgId = req.user.org_id;

    // User by email — stub if absent (google_sub NULL until first sign-in).
    let u = await pool.query(`SELECT id FROM users WHERE lower(email) = $1 AND deleted_at IS NULL`, [cleanEmail]);
    let userId;
    if (u.rows.length) {
      userId = u.rows[0].id;
    } else {
      const name = (displayName || '').trim() || cleanEmail;
      u = await pool.query(
        `INSERT INTO users (name, display_name, email) VALUES ($1, $2, $3) RETURNING id`,
        [name, (displayName || '').trim() || null, cleanEmail]
      );
      userId = u.rows[0].id;
    }

    const existing = await targetMembership(userId, orgId, { includeDeleted: true });
    if (existing && !existing.deleted_at) {
      return res.status(409).json({ error: 'Already a member' });
    }
    if (existing && existing.deleted_at) {
      // Re-invite: undelete + back to invited.
      await pool.query(
        `UPDATE user_orgs SET deleted_at = NULL, deleted_by = NULL, status = 'invited',
                is_admin = $3, job_title = COALESCE($4, job_title),
                invited_by_user_id = $5, invited_at = NOW(), updated_at = NOW()
          WHERE user_id = $1 AND org_id = $2`,
        [userId, orgId, !!isAdmin, (jobTitle || '').trim() || null, req.user.id]
      );
    } else {
      await pool.query(
        `INSERT INTO user_orgs (user_id, org_id, is_admin, job_title, status, invited_by_user_id, invited_at)
         VALUES ($1, $2, $3, $4, 'invited', $5, NOW())`,
        [userId, orgId, !!isAdmin, (jobTitle || '').trim() || null, req.user.id]
      );
    }

    const row = await pool.query(`${memberSelect} AND u.id = $2`, [orgId, userId]);
    res.status(201).json(toMember(row.rows[0]));
  } catch (err) { next(err); }
});

// PATCH /api/team/:userId — { isAdmin? , jobTitle? }
router.patch('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const orgId = req.user.org_id;
    if (userId === req.user.id) {
      return res.status(400).json({ error: "You can't change your own membership." });
    }
    const target = await targetMembership(userId, orgId);
    if (!target) return res.status(404).json({ error: 'Not found' });

    const { isAdmin, jobTitle } = req.body || {};
    if (isAdmin === false && target.is_admin && target.status === 'active') {
      if ((await otherActiveAdmins(orgId, userId)) === 0) {
        return res.status(400).json({ error: 'Org needs at least one active admin.' });
      }
    }
    await pool.query(
      `UPDATE user_orgs SET
         is_admin  = COALESCE($3, is_admin),
         job_title = COALESCE($4, job_title),
         updated_at = NOW()
       WHERE user_id = $1 AND org_id = $2`,
      [userId, orgId, typeof isAdmin === 'boolean' ? isAdmin : null,
        typeof jobTitle === 'string' ? jobTitle : null]
    );
    const row = await pool.query(`${memberSelect} AND u.id = $2`, [orgId, userId]);
    res.json(toMember(row.rows[0]));
  } catch (err) { next(err); }
});

// PATCH /api/team/:userId/status — { suspend: boolean }
router.patch('/:userId/status', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const orgId = req.user.org_id;
    if (userId === req.user.id) {
      return res.status(400).json({ error: "You can't change your own membership." });
    }
    const target = await targetMembership(userId, orgId);
    if (!target) return res.status(404).json({ error: 'Not found' });

    const suspend = !!(req.body || {}).suspend;
    if (suspend && target.is_admin && target.status === 'active') {
      if ((await otherActiveAdmins(orgId, userId)) === 0) {
        return res.status(400).json({ error: 'Org needs at least one active admin.' });
      }
    }
    // Un-suspending an invited-then-suspended user returns them to 'active' —
    // acceptable simplification; invited users normally aren't suspended.
    await pool.query(
      `UPDATE user_orgs SET status = $3, updated_at = NOW() WHERE user_id = $1 AND org_id = $2`,
      [userId, orgId, suspend ? 'suspended' : 'active']
    );
    const row = await pool.query(`${memberSelect} AND u.id = $2`, [orgId, userId]);
    res.json(toMember(row.rows[0]));
  } catch (err) { next(err); }
});

// DELETE /api/team/:userId — soft-delete the membership.
router.delete('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const orgId = req.user.org_id;
    if (userId === req.user.id) {
      return res.status(400).json({ error: "You can't change your own membership." });
    }
    const target = await targetMembership(userId, orgId);
    if (!target) return res.status(404).json({ error: 'Not found' });
    if (target.is_admin && target.status === 'active') {
      if ((await otherActiveAdmins(orgId, userId)) === 0) {
        return res.status(400).json({ error: 'Org needs at least one active admin.' });
      }
    }
    await pool.query(
      `UPDATE user_orgs SET deleted_at = NOW(), updated_at = NOW() WHERE user_id = $1 AND org_id = $2`,
      [userId, orgId]
    );
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
