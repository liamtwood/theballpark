// pV2-02 — JWT session middleware. Verifies the bp_session cookie and
// populates req.user = { id, email, org_id, org_type, is_admin, role }.
//
// SCOPE NOTE (deliberate): this middleware is NOT applied globally to the
// v1 /api/* routes — the v1 app (port 4200) has no JWT cookie and must keep
// working unchanged (pV2-02 criterion 12; the prompt's own §"Existing dev
// data" says v1 endpoints aren't gated). It protects the new auth-aware
// endpoints (/auth/me) and is the gate future v2-only routes opt into.
// Gating v1's /api surface happens when v1 retires (pAUTH-07 territory).

const jwt = require('jsonwebtoken');
const { als } = require('../db/request-context');

const COOKIE_NAME = 'bp_session';

/** Verify the bp_session cookie → the req.user identity object, or null when
 *  absent/invalid. Shared by the hard gate and the soft global attach. */
function userFromRequest(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return {
      id: payload.sub,
      email: payload.email,
      org_id: payload.org_id,
      org_type: payload.org_type,
      is_admin: payload.is_admin,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/** HARD gate — 401s when there is no valid session. Mounted on the gated groups.
 *  Reuses req.user when the global `attachUser` already verified this request, so
 *  a valid session is only jwt.verify'd once (pre-preview audit #5). */
function authenticate(req, res, next) {
  const user = req.user || userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.user = user;
  const store = als.getStore();
  if (store) store.userId = user.id; // legacy audit store (superseded by requestContext)
  return next();
}

/** SOFT global attach (BE-00115 / AUD-01) — sets req.user when a valid session
 *  is present, else passes through (no 401). Mounted GLOBALLY so `requestContext`
 *  can set the org GUCs on EVERY authenticated request regardless of which mount
 *  handles it — the default-on inversion of the old per-mount allow-list. Public
 *  / pre-auth routes simply carry no req.user and requestContext no-ops. */
function attachUser(req, _res, next) {
  const user = userFromRequest(req);
  if (user) req.user = user;
  return next();
}

module.exports = { authenticate, attachUser, userFromRequest, COOKIE_NAME };
