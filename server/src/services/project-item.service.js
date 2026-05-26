const pool = require('../db/pool');

// Project-scoped "cart" — selected (tick) and liked (heart) catalogue items
// recorded on a project before any pricing exists. See v1.13 schema.

/** v1.65cq — recompute project_categories.ballpark_cost for every
    active category on a project from the current project_items + items
    catalogue. Single SQL round-trip. Each category sums the base_price
    of project_items whose item.category_id matches the category_id OR
    is a child (parent_id = category_id) — mirrors the walk-up in
    taxonomy.service.recomputeCategoryBallpark, but in bulk.

    Called on every project_items add/remove so the Estimate drawer +
    Overview Estimate card see fresh ballpark_cost. Previously this
    only fired on the AI-matcher (addMatchToProject) write path, so
    items added through the regular Marketplace + button left their
    category's ballpark_cost at 0. */
async function recomputeProjectBallparks(projectId) {
  await pool.query(
    `UPDATE project_categories pc
        SET ballpark_cost = COALESCE((
              SELECT SUM(COALESCE(i.base_price, 0))
                FROM project_items pi
                JOIN items i ON i.id = pi.item_id
               WHERE pi.project_id = pc.project_id
                 AND (
                   i.category_id = pc.category_id
                   OR i.category_id IN (
                     SELECT id FROM categories WHERE parent_id = pc.category_id
                   )
                 )
            ), 0),
            updated_at = NOW()
      WHERE pc.project_id = $1 AND pc.is_active = true`,
    [projectId]
  );
}

async function getByProject(projectId) {
  // v1.18: also return `i.category_id AS item_category_id` so the Build
  // tab can bucket project_items under a project_category whose category
  // matches the item's category — even when an older project_items row
  // was created without project_category_id set (the v1.17 catalogue-grid
  // detail-panel + button didn't pass it through). New writes still go
  // through add() with project_category_id when the caller has it.
  //
  // v1.22: also return i.lead_time_days and the joined supplier (org)
  // name. The redesigned category-context-panel surfaces both — the
  // "longest lead" summary and the per-row "{supplier} · {N} days
  // lead" subtitle.
  //
  // v1.23: also return c.icon_name AS category_icon_name so the
  // shared category-card-header can render an icon when the project_item
  // is grouped without re-joining categories on the client.
  // v1.65ab — also return i.description and the supplier/category cover
  // assets so the Project Items cart drawer can show the hover-description
  // tooltip and walk the image fallback chain
  // (item.image_url → supplier cover → category icon colour).
  const result = await pool.query(
    `SELECT pi.*,
            i.name,
            i.description,
            i.base_price,
            i.unit,
            i.time_unit,
            i.image_url,
            i.tier,
            i.lead_time_days,
            i.category_id     AS item_category_id,
            c.name            AS category_name,
            c.icon_name       AS category_icon_name,
            c.icon_color      AS category_icon_color,
            o.name            AS supplier_name,
            o.cover_image_url AS supplier_cover_url
       FROM project_items pi
       LEFT JOIN items      i ON pi.item_id     = i.id
       LEFT JOIN categories c ON i.category_id  = c.id
       LEFT JOIN orgs       o ON i.org_id       = o.id
      WHERE pi.project_id = $1
      ORDER BY pi.created_at ASC`,
    [projectId]
  );
  return result.rows;
}

async function add(data) {
  const { project_id, item_id, project_category_id, selection_type } = data;
  if (!project_id || !item_id) {
    const err = new Error('project_id and item_id are required');
    err.status = 400;
    throw err;
  }
  const type = selection_type || 'selected';
  if (type !== 'selected' && type !== 'liked') {
    const err = new Error(`selection_type must be 'selected' or 'liked'`);
    err.status = 400;
    throw err;
  }

  // Upsert: tick overwrites heart and vice versa. project_category_id is
  // preserved if the existing row had one and the new payload doesn't.
  const result = await pool.query(
    `INSERT INTO project_items (project_id, item_id, project_category_id, selection_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id, item_id) DO UPDATE SET
       selection_type      = EXCLUDED.selection_type,
       project_category_id = COALESCE(EXCLUDED.project_category_id, project_items.project_category_id)
     RETURNING *`,
    [project_id, item_id, project_category_id ?? null, type]
  );
  // v1.65cq — keep project_categories.ballpark_cost in sync after every
  // regular-Marketplace add so the Estimate drawer + Overview cards
  // reflect the new cart. Previously only the AI-matcher path did this.
  await recomputeProjectBallparks(project_id);
  return result.rows[0];
}

async function remove(projectId, itemId) {
  const result = await pool.query(
    `DELETE FROM project_items
      WHERE project_id = $1 AND item_id = $2
      RETURNING *`,
    [projectId, itemId]
  );
  // v1.65cq — recompute on remove too so deleting an item from the cart
  // drops the corresponding cost from the category's ballpark.
  await recomputeProjectBallparks(projectId);
  return result.rows[0] || null;
}

module.exports = { getByProject, add, remove, recomputeProjectBallparks };
