/**
 * Org-Type Config service (Piece 2 / p0021)
 *
 * Server-side home for the page-settings config that used to live only in
 * each browser's localStorage. One row per org_type holds the full PageConfig
 * stack as JSONB (see database/migration_org_type_config.sql).
 *
 *   org_type ∈ ('agency' | 'supplier' | 'admin')  — mirrors orgs.type exactly.
 *
 * Consumed by every user of that org_type; authored by the platform admin only
 * (PUT is gated in the route). Reads are open to any authenticated user.
 */

const pool = require('../db/pool');

const VALID_ORG_TYPES = ['agency', 'supplier', 'admin'];

function isValid(orgType) {
  return VALID_ORG_TYPES.includes(orgType);
}

/**
 * Fetch a single org_type's config row. Always resolves a row shape so the
 * client never has to special-case "missing". If the table itself hasn't been
 * created yet (migration not run), returns an empty payload rather than
 * throwing — this keeps the client's fail-safe path quiet (defaults) instead
 * of surfacing 500s before the deploy checklist runs the migration.
 */
async function get(orgType) {
  if (!isValid(orgType)) return null;
  try {
    const { rows } = await pool.query(
      `SELECT org_type, payload, updated_at, updated_by
         FROM org_type_config
        WHERE org_type = $1
        LIMIT 1`,
      [orgType]
    );
    return rows[0] || { org_type: orgType, payload: {} };
  } catch (err) {
    // 42P01 = undefined_table — migration not yet applied. Degrade to empty.
    if (err && err.code === '42P01') {
      return { org_type: orgType, payload: {} };
    }
    throw err;
  }
}

/**
 * Upsert an org_type's payload. Identity (updated_by) is the platform-admin
 * user id resolved by the route guard. The DB trigger also bumps updated_at;
 * we set it here too so the returned row is fresh without a re-read.
 */
async function upsert(orgType, payload, userId) {
  if (!isValid(orgType)) throw new Error(`Invalid org_type: ${orgType}`);
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const { rows } = await pool.query(
    `INSERT INTO org_type_config (org_type, payload, updated_by, updated_at)
          VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (org_type)
       DO UPDATE SET payload    = EXCLUDED.payload,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = now()
       RETURNING org_type, payload, updated_at, updated_by`,
    [orgType, JSON.stringify(safePayload), userId || null]
  );
  return rows[0];
}

module.exports = { get, upsert, isValid, VALID_ORG_TYPES };
