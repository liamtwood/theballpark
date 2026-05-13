const pool = require('../db/pool');

// Project-scoped "cart" — selected (tick) and liked (heart) catalogue items
// recorded on a project before any pricing exists. See v1.13 schema.

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
  const result = await pool.query(
    `SELECT pi.*,
            i.name,
            i.base_price,
            i.unit,
            i.time_unit,
            i.image_url,
            i.tier,
            i.lead_time_days,
            i.category_id     AS item_category_id,
            c.name            AS category_name,
            o.name            AS supplier_name
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
  return result.rows[0];
}

async function remove(projectId, itemId) {
  const result = await pool.query(
    `DELETE FROM project_items
      WHERE project_id = $1 AND item_id = $2
      RETURNING *`,
    [projectId, itemId]
  );
  return result.rows[0] || null;
}

module.exports = { getByProject, add, remove };
