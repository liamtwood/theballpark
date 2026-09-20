const rlsPool = require('./pool');
const { als } = require('./request-context');

/**
 * Run `fn(client)` inside a single transaction with audit attribution.
 *
 * Owns the GUC interplay that `pool.js`'s per-statement wrapper handles
 * for non-transactional writes: opens the txn, sets
 * `app.current_user_id` from ALS so the audit trigger stamps each row's
 * `created_by` / `updated_by`, runs the callback, commits, releases.
 *
 * On any throw: rolls back, releases, rethrows the original error.
 *
 * Use this for any service operation that performs >1 write that must
 * all-succeed-or-all-fail. Hand-rolled BEGIN/COMMIT in services is
 * FORBIDDEN per WORKING_STANDARDS §"Multi-statement DB writes are
 * transactional — via the shared helper".
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn, { pool = rlsPool } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // pV2-SECURITY-RLS-01 §3 (BE-00110) — this runs its OWN client (not the
    // request-pinned one), so set all three GUCs on it from ALS (txn-local) so
    // the audit trigger attributes AND, once RLS is live, the policies see the
    // caller's org. Owner still bypasses RLS today → behaviour-neutral for now.
    const store = als.getStore() || {};
    await client.query(
      `SELECT set_config('app.current_user_id', $1, true),
              set_config('app.current_org_id',  $2, true),
              set_config('app.is_admin',        $3, true)`,
      [store.userId || null, store.orgId || null, store.isAdmin ? 't' : 'f'],
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback failure — original error matters */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
