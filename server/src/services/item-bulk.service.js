// pV2-ITEM-BULK-ACTIONS-01 — bulk item management for the marketplace list/table.
// Two personas, two surfaces (mirrors the single-item split):
//   • OWNER  (/api/store/items/bulk)  — the supplier's OWN items, own-org writes.
//       actions: activate | deactivate | reclassify | submit | delete | refresh-images
//   • ADMIN  (/api/admin/items/bulk)  — cross-org moderation, under withModeration.
//       actions: approve | reject | delete | refresh-images
//
// INVARIANTS (shared with store-items.js / admin-items.js):
//   - org_id comes from req.user, NEVER the body (owner scopes every WHERE to it).
//   - make-active maps the {is_active} contract onto `status` (active/retired) and
//     REQUIRES approval_status='approved' (not-yet-approved ids are skipped, not erred).
//   - suppliers may only reach approval_status ∈ {draft,pending} — 'submit' sets
//     'pending'; approve/reject are NOT in the owner action set at all.
//   - admin approve/reject/delete run through withModeration (scoped app.svc_moderate,
//     0017 column-guarded to approval_status/deleted_at) — no owner-pool / is_admin write.
//   - refresh-images is a background job (catalogue-extract.service) — handled in the
//     route, not here (it returns a jobId, not a synchronous count).

const pool = require('../db/pool');
const { withTransaction } = require('../db/with-transaction');
const { withModeration } = require('../lib/moderation');
const { als } = require('../db/request-context');

const OWNER_ACTIONS = new Set(['activate', 'deactivate', 'reclassify', 'submit', 'delete']);
const ADMIN_ACTIONS = new Set(['approve', 'reject', 'delete']);

/** Validate a reclassify target: an existing, non-deleted catalogue category (node at
 *  any depth). Returns true/false — the caller 400s on false. */
async function isValidCategory(categoryId) {
  if (!categoryId) return false;
  const r = await pool.query(
    `SELECT 1 FROM categories WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [categoryId]);
  return r.rows.length > 0;
}

/** OWNER bulk (own-org). `orgId` from the session scopes every row; the pinned request
 *  client carries current_org = orgId so own-org RLS permits each write. */
async function ownerBulk({ ids, action, categoryId, orgId }) {
  const requested = ids.length;
  const done = (updated) => ({ action, requested, updated, skipped: requested - updated });

  if (action === 'activate') {
    // Only APPROVED items may go live; status is the publish axis (the {is_active}
    // contract). Not-yet-approved / already-active ids simply don't match → skipped.
    const r = await pool.query(
      `UPDATE items SET status = 'active', updated_at = now()
        WHERE id = ANY($1::uuid[]) AND org_id = $2 AND deleted_at IS NULL
          AND approval_status = 'approved' AND status <> 'active'
        RETURNING id`,
      [ids, orgId]
    );
    return done(r.rowCount);
  }
  if (action === 'deactivate') {
    const r = await pool.query(
      `UPDATE items SET status = 'retired', updated_at = now()
        WHERE id = ANY($1::uuid[]) AND org_id = $2 AND deleted_at IS NULL AND status = 'active'
        RETURNING id`,
      [ids, orgId]
    );
    return done(r.rowCount);
  }
  if (action === 'reclassify') {
    const r = await pool.query(
      `UPDATE items SET category_id = $3, updated_at = now()
        WHERE id = ANY($1::uuid[]) AND org_id = $2 AND deleted_at IS NULL
        RETURNING id`,
      [ids, orgId, categoryId]
    );
    return done(r.rowCount);
  }
  if (action === 'submit') {
    // Supplier submit-for-review: draft/rejected → pending (value-gated — the only
    // approval_status a supplier may set besides draft). Already-pending/approved skip.
    const r = await pool.query(
      `UPDATE items SET approval_status = 'pending', updated_at = now()
        WHERE id = ANY($1::uuid[]) AND org_id = $2 AND deleted_at IS NULL
          AND approval_status IN ('draft', 'rejected')
        RETURNING id`,
      [ids, orgId]
    );
    return done(r.rowCount);
  }
  if (action === 'delete') {
    // Soft delete parents + cascade to their child rows (options/components), atomically.
    return withTransaction(async (client) => {
      const r = await client.query(
        `UPDATE items SET deleted_at = now()
          WHERE id = ANY($1::uuid[]) AND org_id = $2 AND deleted_at IS NULL
          RETURNING id`,
        [ids, orgId]
      );
      const deletedIds = r.rows.map((x) => x.id);
      if (deletedIds.length) {
        await client.query(
          `UPDATE items SET deleted_at = now()
            WHERE parent_item_id = ANY($1::uuid[]) AND org_id = $2 AND deleted_at IS NULL`,
          [deletedIds, orgId]
        );
      }
      return done(r.rowCount);
    });
  }
  throw new Error(`unknown owner action: ${action}`);
}

/** ADMIN bulk — cross-org moderation under the scoped app.svc_moderate escape. The
 *  0017 trigger confines a cross-org svc_moderate write to approval_status/deleted_at,
 *  so these are the only admin bulk actions (make-active/reclassify stay owner-only —
 *  FR-00215 reserves content-authoring to the owner org). Runs on the request's PINNED
 *  client (pool.query), never withTransaction (which opens a fresh client that would
 *  NOT carry the svc_moderate GUC → silent no-op). */
async function adminBulk({ ids, action }) {
  const requested = ids.length;
  return withModeration(async () => {
    if (action === 'approve' || action === 'reject') {
      const r = await pool.query(
        `UPDATE items SET approval_status = $2, updated_at = now()
          WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
          RETURNING id`,
        [ids, action === 'approve' ? 'approved' : 'rejected']
      );
      return { action, requested, updated: r.rowCount, skipped: requested - r.rowCount };
    }
    if (action === 'delete') {
      // Moderation takedown — soft delete (deleted_at) + cascade children (both allowed:
      // deleted_at is in the 0017 guard's moderation allowlist). The two statements are
      // wrapped in an explicit BEGIN/COMMIT on the REQUEST's PINNED client (the one
      // withModeration set app.svc_moderate on) so a crash between them can't orphan live
      // children. We can't use withTransaction here — it opens a FRESH client that would
      // NOT carry the svc_moderate GUC (hand-rolled txn is correct for this path; S2).
      const client = als.getStore() && als.getStore().client;
      if (!client) {
        // No request context (shouldn't happen on this gated route) → svc_moderate isn't
        // set anyway, so the cross-org write would no-op. Fail loud rather than silently.
        throw new Error('admin bulk delete requires a request context');
      }
      await client.query('BEGIN');
      try {
        const r = await client.query(
          `UPDATE items SET deleted_at = now()
            WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL RETURNING id`,
          [ids]
        );
        const deletedIds = r.rows.map((x) => x.id);
        if (deletedIds.length) {
          await client.query(
            `UPDATE items SET deleted_at = now()
              WHERE parent_item_id = ANY($1::uuid[]) AND deleted_at IS NULL`,
            [deletedIds]
          );
        }
        await client.query('COMMIT');
        return { action, requested, updated: r.rowCount, skipped: requested - r.rowCount };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
    }
    throw new Error(`unknown admin action: ${action}`);
  });
}

module.exports = { ownerBulk, adminBulk, isValidCategory, OWNER_ACTIONS, ADMIN_ACTIONS };
