// pV2-SECURITY-RLS-01 §2a (BE-00108) — shared ownership guard for the interim
// app layer (defense-in-depth; the DB RLS backstop lands in §1). Throws 404
// (never 403 — no existence enumeration) unless the row belongs to the caller's
// active org (owner OR the supplier on a two-party line), or the caller is a
// ballpark admin.
//
// Table keys are DEVELOPER-supplied whitelist entries — NEVER pass client input
// as `table`. Each lookup resolves the owning org (and, for two-party rows, the
// supplier org) so a supplier on a project line also passes.
const pool = require('../db/pool');

const OWNERSHIP = {
  items:    'SELECT org_id AS owner, NULL::uuid AS supplier FROM items    WHERE id = $1 AND deleted_at IS NULL',
  projects: 'SELECT org_id AS owner, NULL::uuid AS supplier FROM projects WHERE id = $1 AND deleted_at IS NULL',
  orgs:     'SELECT id     AS owner, NULL::uuid AS supplier FROM orgs     WHERE id = $1 AND deleted_at IS NULL',
  project_items: `SELECT p.org_id AS owner, pi.supplier_org_id AS supplier
                    FROM project_items pi JOIN projects p ON p.id = pi.project_id
                   WHERE pi.id = $1 AND pi.deleted_at IS NULL`,
};

/**
 * Assert that `id` in `table` belongs to `orgId` (owner or two-party supplier),
 * else throw a 404 — unless `isAdmin`. Returns the ownership row on success.
 */
async function assertOwnedByActiveOrg(table, id, orgId, { isAdmin = false } = {}) {
  const sql = OWNERSHIP[table];
  if (!sql) throw new Error(`assertOwnedByActiveOrg: unknown table '${table}'`);
  if (!id) { const e = new Error('Not found'); e.status = 404; throw e; }
  const { rows } = await pool.query(sql, [id]);
  const row = rows[0];
  const owned = row && (row.owner === orgId || row.supplier === orgId);
  if (!owned && !isAdmin) { const e = new Error('Not found'); e.status = 404; throw e; }
  return row;
}

module.exports = { assertOwnedByActiveOrg };
