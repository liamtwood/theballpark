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

// FR-00212 — coverage beyond the auth surface.

/** AI endpoints (parse-brief / extract-text) are expensive LLM/OCR calls — tight
 *  per-IP budget on top of the authenticate gate ("AI firewall"). */
const aiLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests; try again in a minute.' },
});

/** Public brief-token surface (no JWT) — abuse/brute-force backstop per IP. */
const briefLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests; try again in a minute.' },
});

/** Broad per-IP backstop across the whole /api surface — generous enough not to
 *  throttle real page loads (which fan out many calls); catches only abuse. */
const apiLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests; slow down and try again shortly.' },
});

/** pV2-INVITE-SUPPLIER-01 — inviting a supplier mints an org + emails an
 *  arbitrary address, so it's an abuse surface (mass org creation / spam). Per
 *  authenticated USER (not IP — an office shares one), 20/hour; mounted after
 *  authenticate so req.user is set. Falls back to the IP key if it isn't. */
const supplierInviteLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.id ? `u:${req.user.id}` : rateLimit.ipKeyGenerator(req.ip)),
  message: { error: 'Too many invites; try again later.' },
});

module.exports = { authWriteLimit, authReadLimit, oauthLimit, aiLimit, briefLimit, apiLimit, supplierInviteLimit };
