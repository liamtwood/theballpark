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

function authenticate(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      org_id: payload.org_id,
      org_type: payload.org_type,
      is_admin: payload.is_admin,
      role: payload.role,
    };
    // Audit attribution: make the verified user the actor for this request's
    // writes (pool.js SET LOCAL app.current_user_id reads this ALS store,
    // populated per request by middleware/user-context.js).
    const store = als.getStore();
    if (store) store.userId = payload.sub;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = { authenticate, COOKIE_NAME };
