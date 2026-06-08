/**
 * PostgreSQL connection pool
 * 
 * Schema is driven by the APP_SCHEMA environment variable:
 *   public   → dev  (default, local development)
 *   preview  → QA / stakeholder demos
 *   master   → production
 * 
 * Set in Railway environment variables per deployment.
 */

const { Pool } = require('pg');
require('dotenv').config({
  path: require('path').join(__dirname, '../../../.env'),
  override: true
});

const schema = process.env.APP_SCHEMA || 'public';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Set search_path so all queries target the correct schema
  // without needing to prefix every table name
  options: `-c search_path=${schema},public`,
});

pool.on('connect', (client) => {
  client.query(`SET search_path TO ${schema}, public`);
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

console.log(`[DB] Connected — schema: ${schema}`);

// ── Audit attribution (Item 1) ───────────────────────────────────────────────
// Wrap pool.query so that WRITES, when a request has a resolved user in context,
// run inside a one-statement transaction that `SET LOCAL`s app.current_user_id.
// The audit stamp trigger reads it via current_user_id(); SET LOCAL is txn-local
// so it auto-clears on COMMIT (no leak across pooled connections, no connection
// held across slow routes). Reads, and writes with no user in context, go direct.
//
// Not covered (attribute via app-supplied value / NULL — acceptable):
//   • explicit pool.connect() transactions (balls/taxonomy manage their own client)
//   • write CTEs (`WITH ... INSERT`) — rare here; add to the regex if introduced.
const { als } = require('./request-context');
const origQuery = pool.query.bind(pool);
const WRITE_RE = /^\s*(insert|update|delete)\b/i;

pool.query = function (text, values, cb) {
  const ctx = als.getStore();
  const sql = typeof text === 'string' ? text : (text && text.text);
  const isWrite =
    ctx && ctx.userId &&
    typeof cb !== 'function' && typeof values !== 'function' &&  // promise form only
    sql && WRITE_RE.test(sql);

  if (!isWrite) return origQuery(text, values, cb);

  return (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [ctx.userId]);
      const result = await client.query(text, values);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
      throw err;
    } finally {
      client.release();
    }
  })();
};

module.exports = pool;
