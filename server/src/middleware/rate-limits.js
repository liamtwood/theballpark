// pV2-AUDIT-02 fix 4 — rate limits for auth-touching surfaces, per
// WORKING_STANDARDS §"Auth surfaces require rate limiting". Budgets:
// write 10/min, read 30/min, OAuth 30/min, per IP. Requires
// app.set('trust proxy', 1) in index.js so req.ip resolves to the client
// behind Railway's edge (otherwise every user shares one bucket).

const rateLimit = require('express-rate-limit');

/** Tighter limit for write endpoints that change session state. */
const authWriteLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests; try again in a minute.' },
});

/** Looser limit for read endpoints that touch session. */
const authReadLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests; try again in a minute.' },
});

/** OAuth entry + callback get the read budget — not a write per se. */
const oauthLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OAuth attempts; try again in a minute.' },
});

module.exports = { authWriteLimit, authReadLimit, oauthLimit };
