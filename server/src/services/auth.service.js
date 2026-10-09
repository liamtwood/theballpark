// pV2-02 — auth service: Google-profile upsert + session building.
//
// The v1 `users` table was reshaped ADDITIVELY (google_sub / display_name /
// default_org_id added; v1's name/org_id/role columns remain). New rows
// populate BOTH name (v1 NOT NULL) and display_name so both apps read clean.

// BE-00115 — the OAuth login upsert + session build run BEFORE a JWT exists, so
// there is no request tenancy context; under the web_app_user RLS role the
// users/user_orgs/orgs policies would deny these reads AND writes. Auth is a
// legitimately cross-tenant bootstrap (look up the user by google_sub/email
// across all orgs), so it runs on the OWNER pool, which bypasses RLS. (Pre-flip
// the owner pool IS DATABASE_URL; post-flip it's MIGRATION_DATABASE_URL.)
const pool = require('../db/owner-pool');
const { effectiveRole, normalizeOrgType } = require('./permissions.service');

// v2dev identity layer: every user is OWNED by the Ballpark platform org
// (users.org_id NOT NULL = instance ownership, not authority), and self-signups
// are stamped created_by the System user (no human creator). Both are the
// bootstrap singletons seeded first (DATA-MODEL-REDESIGN — "Ballpark = org #1").
const BALLPARK_ORG_ID = '00000000-0000-0000-0000-000000000001';
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

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

  // 1. by sub (OIDC subject; v2dev renamed v1's google_sub → sub)
  let r = await pool.query('SELECT id FROM users WHERE sub = $1 AND deleted_at IS NULL', [sub]);
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
      `UPDATE users SET sub = $2, display_name = COALESCE(display_name, $3),
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
  // reads authority from user_orgs.is_admin exclusively.
  // role is EXPLICITLY null — the column carries v1's DEFAULT 'member', which
  // would silently re-grant the legacy authority this prompt removes. On the
  // owner pool (BE-00115) — a single INSERT, no cross-table txn needed.
  // v2dev: no users.role column (authority lives in user_orgs.role); OIDC
  // subject column is `sub`. users.org_id is NOT NULL — it's INSTANCE OWNERSHIP
  // (every user is owned by the Ballpark platform org), NOT authority: the user
  // still has no working-org membership until onboarding writes user_orgs.
  // created_by is stamped to the System user (self-signup has no human creator),
  // matching the seeded rows. Org + membership still land at onboarding.
  const user = await pool.query(
    `INSERT INTO users (name, display_name, email, sub, avatar_url, org_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [displayName, displayName, email, sub, avatarUrl, BALLPARK_ORG_ID, SYSTEM_USER_ID]
  );
  return { userId: user.rows[0].id };
}

/**
 * Build the SessionUser payload for a user id: profile + active org
 * (default_org_id, else first active membership) + derived role.
 * Orgless users (signed in, pre-onboarding) get the user shape with all org
 * fields null — pV2-02b. Returns null only for unknown/deleted users.
 */
async function buildSession(userId, targetOrgId = null) {
  const r = await pool.query(
    `SELECT u.id, u.email, COALESCE(u.display_name, u.name) AS display_name, u.avatar_url,
            -- home = default_org_id, else the user's earliest active membership.
            -- Computed INDEPENDENTLY of the active/switched org so "Return home"
            -- always points at home, never the org you switched into.
            COALESCE(u.default_org_id,
                     (SELECT uo2.org_id FROM user_orgs uo2
                        WHERE uo2.user_id = u.id AND uo2.status = 'active' AND uo2.deleted_at IS NULL
                        ORDER BY uo2.joined_at ASC NULLS LAST LIMIT 1)) AS home_org_id,
            -- home org TYPE — lets the client tell platform staff (home = ballpark)
            -- from a real supplier owner, independently of the switched-into org.
            (SELECT ho.type FROM orgs ho WHERE ho.id = COALESCE(u.default_org_id,
                     (SELECT uo3.org_id FROM user_orgs uo3
                        WHERE uo3.user_id = u.id AND uo3.status = 'active' AND uo3.deleted_at IS NULL
                        ORDER BY uo3.joined_at ASC NULLS LAST LIMIT 1))) AS home_org_type,
            o.id AS org_id, o.name AS org_name, o.type AS org_type,
            (uo.role IN ('admin','owner')) AS is_admin   -- v2dev: derive org-admin from role enum
       FROM users u
       JOIN user_orgs uo ON uo.user_id = u.id AND uo.status = 'active' AND uo.deleted_at IS NULL
       JOIN orgs o ON o.id = uo.org_id
      WHERE u.id = $1 AND u.deleted_at IS NULL
      -- $2 (session-only switch target) sorts first when it's one of THIS user's
      -- active memberships; otherwise fall back to home (default_org_id), then join
      -- order. Membership is the join itself, so a non-member target is ignored.
      ORDER BY ($2::uuid IS NOT NULL AND o.id = $2) DESC,
               (o.id = u.default_org_id) DESC NULLS LAST, uo.joined_at ASC NULLS LAST
      LIMIT 1`,
    [userId, targetOrgId]
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
      homeOrgId: null,
      homeOrgType: null,
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
    // Home = the user's default (or earliest membership). Equals activeOrgId
    // normally; differs only while session-switched (the "Return home" target).
    homeOrgId: row.home_org_id,
    // Home org type — ballpark ⇒ platform staff (gates acting-as AI Assist).
    homeOrgType: normalizeOrgType(row.home_org_type),
  };
}

/** The current user's active memberships — feeds the org switcher. Each row says
 *  whether it's the user's home org (default). */
async function listUserOrgs(userId) {
  const r = await pool.query(
    `SELECT o.id, o.name, o.type, uo.role, (o.id = u.default_org_id) AS is_home
       FROM user_orgs uo
       JOIN orgs o  ON o.id = uo.org_id
       JOIN users u ON u.id = uo.user_id
      WHERE uo.user_id = $1 AND uo.status = 'active' AND uo.deleted_at IS NULL
        AND uo.role IN ('admin','owner','member') AND u.deleted_at IS NULL
      ORDER BY (o.id = u.default_org_id) DESC NULLS LAST, uo.joined_at ASC NULLS LAST`,
    [userId]
  );
  return r.rows.map((row) => ({
    orgId: row.id,
    orgName: row.name,
    orgType: normalizeOrgType(row.type),
    role: effectiveRole(row.type, row.role === 'admin' || row.role === 'owner'),
    isHome: !!row.is_home,
  }));
}

/** Switch the ACTIVE org for THIS SESSION only (no default_org_id write, so next
 *  login still starts home). Membership is proven by buildSession's join — a
 *  non-member target silently falls back to home, so we verify first and 404
 *  otherwise (also avoids revealing whether the org exists). */
async function switchActiveOrg(userId, orgId) {
  const member = await pool.query(
    `SELECT 1 FROM user_orgs
      WHERE user_id = $1 AND org_id = $2 AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    [userId, orgId]
  );
  if (!member.rows.length) return null;
  return buildSession(userId, orgId); // session-only target override
}

module.exports = { upsertUserFromGoogle, buildSession, listUserOrgs, switchActiveOrg };
