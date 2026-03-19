const pool = require('../db/pool');
const EstimateService = require('./estimate.service');

async function getAll(estimateId) {
  let query = 'SELECT * FROM estimate_items WHERE 1=1';
  const params = [];
  if (estimateId) { params.push(estimateId); query += ` AND estimate_id = $${params.length}`; }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM estimate_items WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const { estimate_id, project_category_id, item_id, name, description, quantity, unit_price, supplier_org_id, shortlisted, status_id } = data;
  const qty = parseFloat(quantity) || 1;
  const price = parseFloat(unit_price) || 0;
  const total_price = qty * price;

  const result = await pool.query(
    `INSERT INTO estimate_items (estimate_id, project_category_id, item_id, name, description, quantity, unit_price, total_price, supplier_org_id, shortlisted, status_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [estimate_id, project_category_id, item_id, name, description, qty, price, total_price, supplier_org_id, shortlisted || false, status_id]
  );

  await EstimateService.recalcTotal(estimate_id);
  return result.rows[0];
}

async function update(id, data) {
  const existing = await pool.query('SELECT * FROM estimate_items WHERE id = $1', [id]);
  if (!existing.rows.length) return null;

  const merged = { ...existing.rows[0], ...data };
  const qty = parseFloat(merged.quantity) || 1;
  const price = parseFloat(merged.unit_price) || 0;
  const total_price = qty * price;

  const result = await pool.query(
    `UPDATE estimate_items SET
      project_category_id = COALESCE($1, project_category_id),
      item_id = COALESCE($2, item_id), name = COALESCE($3, name),
      description = COALESCE($4, description), quantity = $5,
      unit_price = $6, total_price = $7,
      supplier_org_id = COALESCE($8, supplier_org_id),
      shortlisted = COALESCE($9, shortlisted),
      status_id = COALESCE($10, status_id), updated_at = NOW()
     WHERE id = $11 RETURNING *`,
    [
      data.project_category_id, data.item_id, data.name,
      data.description, qty, price, total_price,
      data.supplier_org_id, data.shortlisted, data.status_id, id
    ]
  );

  await EstimateService.recalcTotal(result.rows[0].estimate_id);
  return result.rows[0];
}

async function hardDelete(id) {
  const result = await pool.query('DELETE FROM estimate_items WHERE id = $1 RETURNING *', [id]);
  if (!result.rows.length) return null;
  await EstimateService.recalcTotal(result.rows[0].estimate_id);
  return result.rows[0];
}

module.exports = { getAll, getById, create, update, hardDelete };
