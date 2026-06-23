// pV2-02 — auth service: Google-profile upsert + session building.
//
// The v1 `users` table was reshaped ADDITIVELY (google_sub / display_name /
// default_org_id added; v1's name/org_id/role columns remain). New rows
// populate BOTH name (v1 NOT NULL) and display_name so both apps read clean.

const pool = require('../db/pool');
const { withTransaction } = require('../db/with-transaction');
const { effectiveRole, normalizeOrgType } = require('./permissions.service');

/**
 * Upsert a user from a Google OAuth profile.
 *  1. by google_sub → refresh display fields.
 *  2. by email      → link google_sub to the existing row.
 *  3. else          → create the user row ONLY (orgless) — the user picks
 *                     Agency/Supplier at /onboarding, which creates the org
 *                     + membership via POST /api/onboarding/create-org.
 * Returns { userId } — callers then buildSession(userId).
 */
async function upsertUserFromGoogle(profile) {
  const sub = profile.id;
  const email = (profile.emails && profile.emails[0] && profile.emails[0].value || '').toLowerCase();
  const displayName = profile.displayName || email;
  const avatarUrl = (profile.photos && profile.photos[0] && profile.photos[0].value) || null;
  if (!email) throw new Error('Google profile has no email');

  // 1. by google_sub
  let r = await pool.query('SELECT id FROM users WHERE google_sub = $1 AND deleted_at IS NULL', [sub]);
  if (r.rows.length) {
    await pool.query(
      `UPDATE users SET display_name = $2, avatar_url = $3, updated_at = NOW() WHERE id = $1`,
      [r.rows[0].id, displayName, avatarUrl]
    );
    return { userId: r.rows[0].id };
  }

  // 2. by email (linking flow — covers invited stubs from /api/team/invite).
  r = await pool.query('SELECT id FROM users WHERE lower(email) = $1 AND deleted_at IS NULL', [email]);
  if (r.rows.length) {
    const userId = r.rows[0].id;
    await pool.query(
      `UPDATE users SET google_sub = $2, display_name = COALESCE(display_name, $3),
              avatar_url = COALESCE($4, avatar_url), updated_at = NOW() WHERE id = $1`,
      [userId, sub, displayName, avatarUrl]
    );
    // pV2-03 — accept any pending invites on first sign-in: invited → active.
    await pool.query(
      `UPDATE user_orgs SET status = 'active', joined_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND status = 'invited' AND deleted_at IS NULL`,
      [userId]
    );
    // Land the user in an org: default_org_id, else their first membership.
    await pool.query(
      `UPDATE users SET default_org_id = COALESCE(default_org_id,
         (SELECT org_id FROM user_orgs
           WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL
           ORDER BY joined_at ASC NULLS LAST LIMIT 1))
        WHERE id = $1`,
      [userId]
    );
    return { userId };
  }

  // 3. brand-new signup → user row ONLY (pV2-02b replaced the auto-created
  // "{name}'s Workspace" magic — AUDIT-01's behavioral MUST-FIX #2). The org
  // + membership land at onboarding. role and default_org_id stay NULL: v2
  // reads authority from user_orgs.is_admin exclusively. Still wrapped in
  // withTransaction although it's a single insert today, so future additions
  // don't reintroduce hand-rolled writes.
  return withTransaction(async (client) => {
    // role is EXPLICITLY null — the column carries v1's DEFAULT 'member',
    // which would silently re-grant the legacy authority this prompt removes.
    const user = await client.query(
      `INSERT INTO users (name, display_name, email, google_sub, avatar_url, role)
       VALUES ($1, $2, $3, $4, $5, NULL) RETURNING id`,
      [displayName, displayName, email, sub, avatarUrl]
    );
    return { userId: user.rows[0].id };
  });
}

/**
 * Build the SessionUser payload for a user id: profile + active org
 * (default_org_id, else first active membership) + derived role.
 * Orgless users (signed in, pre-onboarding) get the user shape with all org
 * fields null — pV2-02b. Returns null only for unknown/deleted users.
 */
async function buildSession(userId) {
  const r = await pool.query(
    `SELECT u.id, u.email, COALESCE(u.display_name, u.name) AS display_name, u.avatar_url,
            o.id AS org_id, o.name AS org_name, o.type AS org_type, uo.is_admin
       FROM users u
       JOIN user_orgs uo ON uo.user_id = u.id AND uo.status = 'active' AND uo.deleted_at IS NULL
       JOIN orgs o ON o.id = uo.org_id
      WHERE u.id = $1 AND u.deleted_at IS NULL
      ORDER BY (o.id = u.default_org_id) DESC NULLS LAST, uo.joined_at ASC NULLS LAST
      LIMIT 1`,
    [userId]
  );
  if (!r.rows.length) {
    // No active membership — orgless authenticated user (needs onboarding).
    const u = await pool.query(
      `SELECT id, email, COALESCE(display_name, name) AS display_name, avatar_url
         FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (!u.rows.length) return null; // truly unknown user
    const row = u.rows[0];
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      activeOrgId: null,
      activeOrgName: null,
      activeOrgType: null,
      isAdmin: false,
      role: null,
    };
  }
  const row = r.rows[0];
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    activeOrgId: row.org_id,
    activeOrgName: row.org_name,
    activeOrgType: normalizeOrgType(row.org_type),
    isAdmin: row.is_admin,
    role: effectiveRole(row.org_type, row.is_admin),
  };
}

module.exports = { upsertUserFromGoogle, buildSession };
