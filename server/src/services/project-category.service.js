const pool = require('../db/pool');
const ProjectService = require('./project.service');

function calcDerivedFields(data) {
  const base_cost = parseFloat(data.base_cost) || 0;
  const contingency_pct = parseFloat(data.contingency_pct) || 0;
  const margin_pct = parseFloat(data.margin_pct) || 0;
  const vat_pct = parseFloat(data.vat_pct) || 0;

  const contingency_amount = base_cost * contingency_pct / 100;
  const subtotal = base_cost + contingency_amount;
  const margin_amount = subtotal * margin_pct / 100;
  const net_cost = subtotal + margin_amount;
  const vat_amount = net_cost * vat_pct / 100;
  const client_cost = net_cost + vat_amount;

  return { contingency_amount, subtotal, margin_amount, net_cost, vat_amount, client_cost };
}

async function getAll(projectId) {
  let query = 'SELECT * FROM project_categories WHERE is_active = true';
  const params = [];
  if (projectId) { params.push(projectId); query += ` AND project_id = $${params.length}`; }
  query += ' ORDER BY sort_order ASC, created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM project_categories WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const {
    project_id, category_id, name, description, requirement_brief,
    requirement_detail, ballpark_cost, base_cost, contingency_pct,
    margin_pct, vat_pct, sort_order, status_id
  } = data;
  const derived = calcDerivedFields(data);

  const result = await pool.query(
    `INSERT INTO project_categories (
      project_id, category_id, name, description, requirement_brief,
      requirement_detail, ballpark_cost, base_cost, contingency_pct, contingency_amount,
      subtotal, margin_pct, margin_amount, net_cost, vat_pct, vat_amount,
      client_cost, sort_order, status_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [
      project_id, category_id, name, description, requirement_brief,
      requirement_detail, ballpark_cost || 0, base_cost || 0, contingency_pct || 0,
      derived.contingency_amount, derived.subtotal, margin_pct || 0,
      derived.margin_amount, derived.net_cost, vat_pct || 20,
      derived.vat_amount, derived.client_cost, sort_order, status_id
    ]
  );

  await ProjectService.recalcTotals(project_id);
  return result.rows[0];
}

async function update(id, data) {
  const existing = await pool.query('SELECT * FROM project_categories WHERE id = $1', [id]);
  if (!existing.rows.length) return null;

  const merged = { ...existing.rows[0], ...data };
  const derived = calcDerivedFields(merged);

  const result = await pool.query(
    `UPDATE project_categories SET
      category_id = COALESCE($1, category_id), name = COALESCE($2, name),
      description = COALESCE($3, description), requirement_brief = COALESCE($4, requirement_brief),
      requirement_detail = COALESCE($5, requirement_detail), ballpark_cost = COALESCE($6, ballpark_cost),
      base_cost = $7, contingency_pct = $8, contingency_amount = $9, subtotal = $10,
      margin_pct = $11, margin_amount = $12, net_cost = $13, vat_pct = $14,
      vat_amount = $15, client_cost = $16, sort_order = COALESCE($17, sort_order),
      status_id = COALESCE($18, status_id), updated_at = NOW()
     WHERE id = $19 RETURNING *`,
    [
      data.category_id, data.name, data.description,
      data.requirement_brief, data.requirement_detail, data.ballpark_cost,
      merged.base_cost || 0, merged.contingency_pct || 0,
      derived.contingency_amount, derived.subtotal, merged.margin_pct || 0,
      derived.margin_amount, derived.net_cost, merged.vat_pct || 20,
      derived.vat_amount, derived.client_cost, data.sort_order,
      data.status_id, id
    ]
  );

  await ProjectService.recalcTotals(result.rows[0].project_id);
  return result.rows[0];
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE project_categories SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  if (!result.rows.length) return null;
  await ProjectService.recalcTotals(result.rows[0].project_id);
  return result.rows[0];
}

// ── Brief tab — scope picker + per-category briefs ────────────────────
//
// upsert/getByProject/remove operate on the (project_id, category_id)
// pair so the Brief tab can toggle scope and edit briefs without
// tracking project_categories.id on the client. Cost fields are not
// touched here — they're owned by the Estimate tab. See update() above
// for the existing cost-aware path.

async function getByProject(projectId) {
  const result = await pool.query(
    `SELECT pc.*,
            c.name            AS category_name,
            c.icon_name       AS category_icon_name,
            c.icon_color      AS category_icon_color,
            c.cover_image_url AS category_cover_image_url,
            c.sort_order      AS category_sort_order
     FROM project_categories pc
     JOIN categories c ON c.id = pc.category_id
     WHERE pc.project_id = $1 AND pc.is_active = true
     ORDER BY c.sort_order ASC, pc.created_at ASC`,
    [projectId]
  );
  return result.rows;
}

async function upsert(projectId, categoryId, data) {
  const requirement_brief  = data.requirement_brief  !== undefined ? data.requirement_brief  : null;
  const requirement_detail = data.requirement_detail !== undefined ? data.requirement_detail : null;
  const ballpark_budget    = data.ballpark_budget    !== undefined ? data.ballpark_budget    : null;

  // INSERT ... ON CONFLICT requires a unique constraint on
  // (project_id, category_id). A composite constraint isn't guaranteed
  // historically, so we do a SELECT-then-INSERT/UPDATE round-trip.
  const existing = await pool.query(
    `SELECT id FROM project_categories
     WHERE project_id = $1 AND category_id = $2 AND is_active = true
     LIMIT 1`,
    [projectId, categoryId]
  );

  if (existing.rows.length) {
    const result = await pool.query(
      `UPDATE project_categories SET
        requirement_brief  = COALESCE($1, requirement_brief),
        requirement_detail = COALESCE($2, requirement_detail),
        ballpark_budget    = COALESCE($3, ballpark_budget),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [requirement_brief, requirement_detail, ballpark_budget, existing.rows[0].id]
    );
    return result.rows[0];
  }

  const inserted = await pool.query(
    `INSERT INTO project_categories
       (project_id, category_id, requirement_brief, requirement_detail, ballpark_budget)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [projectId, categoryId, requirement_brief, requirement_detail, ballpark_budget]
  );
  return inserted.rows[0];
}

async function remove(projectId, categoryId) {
  // Hard delete on the brief picker — toggling off should clear the row
  // entirely, not leave inactive ghosts behind that confuse subsequent
  // selections. recalcTotals only looks at is_active rows so the project
  // totals stay correct either way.
  const result = await pool.query(
    `DELETE FROM project_categories
     WHERE project_id = $1 AND category_id = $2
     RETURNING *`,
    [projectId, categoryId]
  );
  if (result.rows.length) {
    await ProjectService.recalcTotals(projectId);
  }
  return result.rows[0] || null;
}

// Build tab — soft-toggle scope so requirement_brief survives a round trip
// of un-scope → re-scope. Insert if missing, flip is_active if present.
// Distinct from remove() above which is the Brief tab's hard delete.
async function setScope(projectId, categoryId, active) {
  const existing = await pool.query(
    `SELECT id FROM project_categories
     WHERE project_id = $1 AND category_id = $2
     LIMIT 1`,
    [projectId, categoryId]
  );

  if (existing.rows.length) {
    const result = await pool.query(
      `UPDATE project_categories
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [active, existing.rows[0].id]
    );
    await ProjectService.recalcTotals(projectId);
    return result.rows[0];
  }

  if (!active) return null;

  const inserted = await pool.query(
    `INSERT INTO project_categories (project_id, category_id, is_active)
     VALUES ($1, $2, true)
     RETURNING *`,
    [projectId, categoryId]
  );
  await ProjectService.recalcTotals(projectId);
  return inserted.rows[0];
}

module.exports = {
  getAll, getById, create, update, softDelete, calcDerivedFields,
  getByProject, upsert, remove, setScope
};
