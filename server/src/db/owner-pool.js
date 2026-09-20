/**
 * pV2-SECURITY-RLS-01 (BE-00115) — OWNER (RLS-bypassing) connection pool.
 *
 * A small, separate pool that connects as the schema OWNER, for the handful of
 * legitimately pre-tenancy / cross-tenant BOOTSTRAP writes that cannot run under
 * the `web_app_user` RLS role:
 *   • the OAuth login upsert (auth.service) — runs BEFORE a JWT exists, so there
 *     is no app.current_user_id/org GUC and the users/user_orgs policies deny it;
 *   • first-run onboarding (create the user's first org + membership) — creates a
 *     NEW org whose id can't equal app_current_org() yet.
 * These are the classic RLS auth-bootstrap paths: identity is established here, so
 * tenancy can't gate it. Using the owner (which bypasses RLS) for JUST these
 * flows is the safe answer — the alternative (a permissive users/orgs INSERT
 * policy) would let any tenant write identity rows.
 *
 * Prefers MIGRATION_DATABASE_URL (the owner, once DATABASE_URL is flipped to
 * web_app_user) and falls back to DATABASE_URL (which IS the owner before the
 * flip) — so it's correct in both the pre-flip and post-flip states. Do NOT use
 * this pool for ordinary request-scoped work; that goes through db/pool.js so RLS
 * applies.
 */
const { Pool } = require('pg');
require('dotenv').config({
  path: require('path').join(__dirname, '../../../.env'),
  override: true,
});

const schema = process.env.APP_SCHEMA || 'public';

const ownerPool = new Pool({
  connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  options: `-c search_path=${schema},public`,
  idleTimeoutMillis: 600000,
  keepAlive: true,
  min: 1,
});

ownerPool.on('connect', (client) => {
  client.query(`SET search_path TO ${schema}, public`);
});
ownerPool.on('error', (err) => {
  console.error('Unexpected owner-pool error:', err);
});

module.exports = ownerPool;
