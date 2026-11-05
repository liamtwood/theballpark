/**
 * ProjectMatchService — AI-match persistence on a project.
 *
 * Extracted from taxonomy.service.js in the BE-00112 decomposition (Layer 1).
 * Adds/removes AI-matched (or proposed) catalogue items to a project's estimate,
 * recomputes the per-category ballpark, persists the search hint, and
 * materialises an AI-proposed item into a real (inactive, approval-pending)
 * catalogue row.
 */
const pool = require('../db/pool');
const { withTransaction } = require('../db/with-transaction');

function httpErr(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function recomputeCategoryBallpark(projectId, categoryId) {
  const r = await pool.query(
    `SELECT COALESCE(SUM(
              COALESCE(i.base_price, 0)
              * CASE
                  WHEN LOWER(COALESCE(i.unit, '')) IN ('cover', 'head')
                    THEN COALESCE(p.guest_count, 1)
                  ELSE 1
                END
            ), 0)::numeric AS total
       FROM project_items pi
       JOIN items i ON i.id = pi.item_id
       JOIN projects p ON p.id = pi.project_id
      WHERE pi.project_id = $1
        AND (i.category_id = $2 OR i.category_id IN (SELECT id FROM categories WHERE parent_id = $2))`,
    [projectId, categoryId]
  );
  const total = Number(r.rows[0].total) || 0;
  await pool.query(
    `UPDATE project_categories SET ballpark_cost = $1, updated_at = NOW()
      WHERE project_id = $2 AND category_id = $3 AND is_active = true`,
    [total, projectId, categoryId]
  );
  return total;
}

/**
 * Add a Brief-tab match to a project. For a catalogue match (kind
 * 'matched') it links the existing item; for an AI proposal (kind
 * 'proposed') it first creates the item under the proposed supplier.
 * Either way it records the AI metadata and recomputes the category's
 * ballpark cost.
 */
async function addMatchToProject(body) {
  const {
    project_id, project_category_id, category_id, kind,
    item_id, ai_confidence, ai_match_reason, proposed, selection_type
  } = body || {};
  if (!project_id || !category_id) throw httpErr('project_id and category_id are required', 400);
  const stype = selection_type === 'liked' ? 'liked' : 'selected';

  let finalItemId = item_id;
  let source = 'catalogue';
  let estPrice = null;

  if (kind === 'proposed') {
    if (!proposed || !proposed.name) throw httpErr('proposed item details are required', 400);
    if (!proposed.supplier_id) throw httpErr('proposed item needs a supplier', 400);
    source = 'ai_proposed';
    estPrice = Math.max(0, Number(proposed.estimated_price) || 0);
    // v1.49k — an AI-proposed item is NOT a real catalogue listing yet.
    // Create it is_active = false + approval_status = 'pending' so it is
    // hidden from the catalogue / marketplace / store / matcher (all of
    // which filter is_active = true) until the named supplier approves
    // it. It still works on the project that proposed it — project_items
    // references the row by id regardless of is_active.
    // v1.51f — reuse + refresh on the UNIQUE(org_id, name) index so
    // adding the same proposed item twice doesn't error.
    const ins = await pool.query(
      `INSERT INTO items (org_id, category_id, name, description, base_price,
                          is_active, approval_status)
       VALUES ($1, $2, $3, $4, $5, false, 'pending')
       ON CONFLICT (org_id, name) DO UPDATE SET
         category_id = EXCLUDED.category_id,
         description = EXCLUDED.description,
         base_price  = EXCLUDED.base_price,
         updated_at  = NOW()
       RETURNING id`,
      [proposed.supplier_id, category_id, proposed.name, proposed.description || '', estPrice]
    );
    finalItemId = ins.rows[0].id;
  }
  if (!finalItemId) throw httpErr('item_id is required for a catalogue match', 400);

  const conf = ai_confidence != null ? Math.round(Number(ai_confidence)) : null;
  const pi = await pool.query(
    `INSERT INTO project_items
       (project_id, item_id, project_category_id, selection_type,
        source, ai_confidence, ai_match_reason, ai_estimated_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (project_id, item_id) DO UPDATE SET
       selection_type      = EXCLUDED.selection_type,
       project_category_id = COALESCE(EXCLUDED.project_category_id, project_items.project_category_id),
       source              = EXCLUDED.source,
       ai_confidence       = EXCLUDED.ai_confidence,
       ai_match_reason     = EXCLUDED.ai_match_reason,
       ai_estimated_price  = EXCLUDED.ai_estimated_price
     RETURNING *`,
    [project_id, finalItemId, project_category_id || null, stype, source, conf,
     ai_match_reason || null, estPrice]
  );

  const ballpark_cost = await recomputeCategoryBallpark(project_id, category_id);
  return { project_item: pi.rows[0], ballpark_cost };
}

/** v1.54 — un-add a Brief-tab match. Mirror of addMatchToProject: drops
    the project_items row and recomputes the category's ballpark cost so
    the Brief-tab estimate stays accurate. */
async function removeMatchFromProject(body) {
  const { project_id, category_id, item_id } = body || {};
  if (!project_id || !category_id || !item_id) {
    throw httpErr('project_id, category_id and item_id are required', 400);
  }
  await pool.query(
    'DELETE FROM project_items WHERE project_id = $1 AND item_id = $2',
    [project_id, item_id]
  );
  const ballpark_cost = await recomputeCategoryBallpark(project_id, category_id);
  return { ok: true, ballpark_cost };
}

/** Store the AI's search terms + the user's training hint. */
async function saveSearchHint(projectId, categoryId, searchTerms, userHint) {
  if (!projectId || !categoryId) throw httpErr('projectId and categoryId are required', 400);
  await pool.query(
    `INSERT INTO ai_search_hints (project_id, category_id, ai_search_terms, user_hint)
     VALUES ($1, $2, $3, $4)`,
    [projectId, categoryId, Array.isArray(searchTerms) ? searchTerms : [], userHint || '']
  );
  return { saved: true };
}

/* ─────────────────────────────────────────────────────────────────────
   v1.50 — COMPETITIVE QUOTE OUTREACH (RFQ, Phase 1)
   ───────────────────────────────────────────────────────────────────── */

/** v1.50 — outreach emails are fully wired but OFF by default: there are
    no supplier user accounts to receive them yet. Flip
    QUOTE_REQUEST_EMAILS_ENABLED=true in the env once supplier accounts
    go live — no code change needed. */

/** v1.52e — turn an AI-proposed brief item into a real (but inactive,
    approval-pending) catalogue row so the Brief tab's ✎ / 👁 actions can
    open it in the item drawer / on the item detail page. Mirrors the
    'proposed' branch of addMatchToProject exactly — same org_id
    (the AI-named supplier) + same ON CONFLICT (org_id, name) upsert — so
    materialising then adding reuses one row instead of creating two. */
async function materializeProposedItem(body) {
  const { supplier_id, category_id, name, description, estimated_price } = body || {};
  if (!supplier_id || !category_id || !name) {
    throw httpErr('supplier_id, category_id and name are required', 400);
  }
  const price = Math.max(0, Number(estimated_price) || 0);
  // pV2-SECURITY-RLS-01 §1-A (Liam decision 2026-09-20) — this creates a
  // SUPPLIER-owned item (org_id = supplier_id, ≠ the acting agency). The caller
  // is authorized by owning the RFQ's project (asserted in the route). Elevate
  // JUST this INSERT (txn-local app.is_admin='t') so items_insert passes once
  // RLS is on; it drops at COMMIT and touches nothing else. No effect pre-RLS
  // (the owner role bypasses RLS today) — this is forward-compatible plumbing.
  return withTransaction(async (client) => {
    await client.query("SELECT set_config('app.is_admin', 't', true)");
    const r = await client.query(
      // REBUILD: items.is_active dropped — a not-yet-live item is status 'new'
      // + approval_status 'pending' (hidden until the named supplier approves).
      `INSERT INTO items (org_id, category_id, name, description, base_price,
                          status, approval_status)
       VALUES ($1, $2, $3, $4, $5, 'new', 'pending')
       ON CONFLICT (org_id, name) DO UPDATE SET
         category_id = EXCLUDED.category_id,
         description = EXCLUDED.description,
         base_price  = EXCLUDED.base_price,
         updated_at  = NOW()
       RETURNING *`,
      [supplier_id, category_id, name, description || '', price]
    );
    return r.rows[0];
  });
}

/* ─────────────────────────────────────────────────────────────────────
   v1.41 SUBCATEGORY-ONLY HELPERS — kept for the drawer "✦ Suggest" link
   and the Part 3 bulk backfill.
   ───────────────────────────────────────────────────────────────────── */


module.exports = {
  recomputeCategoryBallpark,
  addMatchToProject,
  removeMatchFromProject,
  saveSearchHint,
  materializeProposedItem,
};
