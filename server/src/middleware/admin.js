/**
 * Admin middleware
 *
 * Enforces admin-only access on /api/admin/* endpoints. Reads the user id
 * from the `x-bp-user-id` header (matches the existing client-side admin
 * gate which uses users[0].role from /api/org/users) and checks the
 * current schema's users table for role = 'admin'.
 *
 * This is a stopgap until proper Supabase auth lands. When real auth is
 * wired in, replace the header lookup with the JWT subject.
 */

const pool = require('../db/pool');

async function requireAdmin(req, res, next) {
  const userId = req.header('x-bp-user-id');
  if (!userId) {
    return res.status(401).json({ error: 'Missing x-bp-user-id header' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT role FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!rows.length || rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminUserId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAdmin };
