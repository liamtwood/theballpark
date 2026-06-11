// pV2-02b — session-cookie signing, extracted from routes/auth.js so the
// onboarding endpoint can refresh the cookie without circular imports.
// One Definition for BOTH the cookie attributes and the JWT payload shape.

const jwt = require('jsonwebtoken');
const { COOKIE_NAME } = require('../middleware/authenticate');

/** One Definition for the session-cookie attributes — referenced by BOTH the
 *  set and clear paths. Browsers match clearCookie against name+domain+path,
 *  so a clear that doesn't mirror the set options silently fails the moment
 *  JWT_COOKIE_DOMAIN is configured (AUDIT-02 fix 4b). */
function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.JWT_COOKIE_SECURE === 'true',
    domain: process.env.JWT_COOKIE_DOMAIN || undefined,
    path: '/',
  };
}

/** Sign a 7-day session JWT and set the bp_session cookie.
 *
 *  The payload carries IDENTITY ONLY (WORKING_STANDARDS §"JWTs carry
 *  identity, not authority"). The org_type/is_admin/role claims that
 *  AUDIT-02 fix 3 marked DEPRECATED are DROPPED from newly signed tokens
 *  here (pV2-02b) — requireActiveMembership has always re-derived authority
 *  from the DB per request, so nothing reads them. org_id is
 *  identity-adjacent and acceptable WHILE the user can't switch orgs without
 *  re-authenticating; it is null for orgless users until onboarding
 *  completes (create-org re-signs the cookie). */
function signSessionCookie(res, session) {
  const token = jwt.sign(
    {
      sub: session.id,
      email: session.email,
      org_id: session.activeOrgId,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie(COOKIE_NAME, token, {
    ...sessionCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

module.exports = { sessionCookieOptions, signSessionCookie };
