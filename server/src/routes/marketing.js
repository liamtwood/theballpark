/**
 * Public marketing routes — no auth required.
 *
 *   GET  /api/welcome/content       → page copy as keyed object
 *   POST /api/guestlist/signup      → register, notify admins
 */

const router = require('express').Router();
const MarketingService = require('../services/marketing.service');

// ── In-memory rate limiter: 5 / minute / IP for signups ────────────────
// Single-instance Railway deploy → no shared state needed. If we ever
// horizontally scale, swap to a Redis-backed limiter.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX       = 5;
const ipBuckets      = new Map(); // ip → number[] (timestamps within window)

function rateLimitSignup(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const bucket = (ipBuckets.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (bucket.length >= RATE_MAX) {
    return res.status(429).json({ error: 'Too many signups from this IP. Try again in a minute.' });
  }
  bucket.push(now);
  ipBuckets.set(ip, bucket);
  next();
}

// Periodic cleanup of stale IP buckets — keeps the Map from leaking
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of ipBuckets) {
    const fresh = bucket.filter(t => now - t < RATE_WINDOW_MS);
    if (!fresh.length) ipBuckets.delete(ip);
    else ipBuckets.set(ip, fresh);
  }
}, RATE_WINDOW_MS).unref();

// ── GET /api/welcome/content ───────────────────────────────────────────
router.get('/welcome/content', async (req, res, next) => {
  try {
    const content = await MarketingService.getPublicContent();
    res.set('Cache-Control', 'public, max-age=300');
    res.json(content);
  } catch (err) { next(err); }
});

// ── POST /api/guestlist/signup ─────────────────────────────────────────
router.post('/guestlist/signup', rateLimitSignup, async (req, res, next) => {
  try {
    const result = await MarketingService.createSignup({
      body: req.body,
      ip:   req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null
    });
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error });
    res.json(result.body);
  } catch (err) { next(err); }
});

module.exports = router;
