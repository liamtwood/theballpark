// Rebuild (v2dev) DB pool + request-context helper.
// Ring-fenced: used ONLY by the org-slice rebuild code and its tests. It talks
// to the SEPARATE v2dev database (env.v2dev), never the shared v2 DB, and
// connects as the RLS-subject role web_app_user — so every query is subject to
// row-level security, exactly like a real request.
//
// withRequest() mirrors the request-context middleware: it opens a transaction,
// sets the per-request GUCs transaction-LOCALLY (so they drive RLS for the life
// of the txn and evaporate on commit), runs the caller's work on that same
// client, then commits (or rolls back on error).
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../../env.v2dev') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 4,
});

// ctx: { userId?, orgId?, isAdmin? } — the identity this request runs as.
async function withRequest(ctx, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('app.current_user_id', $1, true)`, [ctx.userId || '']);
    await client.query(`select set_config('app.current_org_id',  $1, true)`, [ctx.orgId  || '']);
    await client.query(`select set_config('app.is_admin',        $1, true)`, [ctx.isAdmin ? 'true' : 'false']);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    try { await client.query('rollback'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const BALLPARK_ORG_ID = '00000000-0000-0000-0000-000000000001';

module.exports = { pool, withRequest, SYSTEM_USER_ID, BALLPARK_ORG_ID };
