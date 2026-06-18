/**
 * Admin middleware
 *
 * Gates /api/admin/* endpoints. Interim two-tier gate (TECH-DEBT-01 —
 * see docs/AUDIT_LEDGER.md):
 *
 *   - When ADMIN_API_SECRET is set (preview/prod), require a matching
 *     `x-bp-admin-secret` header. This is the load-bearing gate. The prior
 *     check trusted `x-bp-user-id` alone — any caller who learned an admin
 *     user UUID (e.g. via the unauthenticated GET /api/org/users) could forge
 *     the header and read/modify the guestlist. A shared secret the attacker
 *     does not possess closes that path.
 *   - When ADMIN_API_SECRET is UNSET (local dev), fall back to the legacy
 *     `x-bp-user-id` role lookup so local tooling and the v1 admin UI keep
 *     working without a secret. This is the explicit dev-only bypass.
 *
 * Either path records the acting user (`x-bp-user-id`, when present and
 * uuid-shaped) as req.adminUserId for audit attribution on writes.
 *
 * MUST be replaced by real Supabase JWT auth at pV2-AUTH-01. MUST NOT remain
 * past that ship — see docs/AUDIT_LEDGER.md TECH-DEBT-01.
 */

const crypto = require('crypto');
const pool = require('../db/pool');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Constant-time compare so the secret can't be recovered byte-by-byte via
// response-timing. Length mismatch short-circuits (timingSafeEqual throws on
// unequal-length buffers); secret length is not itself sensitive.
function secretMatches(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function requireAdmin(req, res, next) {
  // Record acting user for audit attribution regardless of which gate path
  // we take. Only uuid-shaped values reach the DB stamp.
  const rawUserId = req.header('x-bp-user-id');
  req.adminUserId = rawUserId && UUID_RE.test(rawUserId) ? rawUserId : null;

  const expectedSecret = process.env.ADMIN_API_SECRET;

  // Primary gate: shared admin secret (preview/prod).
  if (expectedSecret) {
    if (secretMatches(req.header('x-bp-admin-secret'), expectedSecret)) {
      return next();
    }
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Dev-only bypass: no secret configured → legacy x-bp-user-id role check.
  // Never reached when ADMIN_API_SECRET is set.
  if (!req.adminUserId) {
    return res.status(401).json({ error: 'Missing x-bp-user-id header' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT role FROM users WHERE id = $1 LIMIT 1`,
      [req.adminUserId]
    );
    if (!rows.length || rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdmin };
