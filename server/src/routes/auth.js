// pV2-02 — auth surface. Mounted at /auth/* (distinct from /api/*).
//   GET  /auth/google           → redirect to Google consent
//   GET  /auth/google/callback  → upsert user/org/membership, set JWT cookie,
//                                 redirect to {WEB_BASE_URL}/auth/callback?login=ok
//   POST /auth/logout           → clear cookie, 204
//   GET  /auth/me               → SessionUser JSON (401 without valid cookie)
//   POST /auth/dev/login        → dev-only: cookie for a seeded (google_sub IS
//                                 NULL) user. 403 in production.

const router = require('express').Router();
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const pool = require('../db/pool');
const { upsertUserFromGoogle, buildSession } = require('../services/auth.service');
const { authenticate, COOKIE_NAME } = require('../middleware/authenticate');
const { sessionCookieOptions, signSessionCookie } = require('../services/auth-cookie.service');
const { authWriteLimit, authReadLimit, oauthLimit } = require('../middleware/rate-limits');

const WEB = () => process.env.WEB_BASE_URL || 'http://localhost:4201';
const IS_PROD = () => process.env.NODE_ENV === 'production';

// Strategy registered lazily so a missing env var fails the auth route, not boot.
let strategyReady = false;
function ensureStrategy() {
  if (strategyReady) return;
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_OAUTH_REDIRECT_URL,
    },
    // verify: hand the raw profile through; upsert happens in the handler.
    (accessToken, refreshToken, profile, done) => done(null, profile)
  ));
  strategyReady = true;
}

// Cookie signing + options live in services/auth-cookie.service.js (pV2-02b
// extraction — onboarding refreshes the cookie too). Newly signed JWTs carry
// identity only; the deprecated authority claims are gone.

router.get('/google', oauthLimit, (req, res, next) => {
  ensureStrategy();
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get('/google/callback', oauthLimit, (req, res, next) => {
  ensureStrategy();
  passport.authenticate('google', { session: false, failureRedirect: `${WEB()}/login?error=auth_failed` })(
    req, res, async () => {
      try {
        const { userId } = await upsertUserFromGoogle(req.user);
        // buildSession returns a partial (org-null) session for orgless users
        // since pV2-02b — null only for truly unknown/deleted users.
        const session = await buildSession(userId);
        if (!session) return res.redirect(`${WEB()}/login?error=no_membership`);
        signSessionCookie(res, session);
        return res.redirect(`${WEB()}/auth/callback?login=ok`);
      } catch (err) { return next(err); }
    }
  );
});

router.post('/logout', authWriteLimit, (req, res) => {
  // Mirror EVERY set option — see sessionCookieOptions() above.
  res.clearCookie(COOKIE_NAME, sessionCookieOptions());
  res.status(204).end();
});

router.get('/me', authReadLimit, authenticate, async (req, res, next) => {
  try {
    // Orgless users get a 200 with org fields null (they're signed in, they
    // just need onboarding); 401 only when the user row itself is gone.
    const session = await buildSession(req.user.id);
    if (!session) return res.status(401).json({ error: 'Unknown user' });
    res.json(session);
  } catch (err) { next(err); }
});

// Dev-only login — impersonate a SEEDED user (google_sub IS NULL guards real
// Google-authed accounts from impersonation even in dev). 403 in production.
router.post('/dev/login', authWriteLimit, async (req, res, next) => {
  if (IS_PROD()) return res.status(403).json({ error: 'Disabled in production' });
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const r = await pool.query(
      `SELECT u.id FROM users u
        WHERE u.id = $1 AND u.google_sub IS NULL AND u.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM user_orgs uo
                       WHERE uo.user_id = u.id AND uo.status = 'active' AND uo.deleted_at IS NULL)`,
      [userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not a dev-seed user' });
    const session = await buildSession(userId);
    if (!session) return res.status(404).json({ error: 'No membership' });
    signSessionCookie(res, session);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
