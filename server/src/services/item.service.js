const pool = require('../db/pool');

async function getAll(orgId, categoryId) {
  let query = 'SELECT * FROM items WHERE is_active = true';
  const params = [];
  if (orgId) { params.push(orgId); query += ` AND org_id = $${params.length}`; }
  if (categoryId) { params.push(categoryId); query += ` AND category_id = $${params.length}`; }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const { org_id, category_id, name, description, unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier } = data;
  const result = await pool.query(
    `INSERT INTO items (org_id, category_id, name, description, unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [org_id, category_id, name, description, unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { org_id, category_id, name, description, unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier } = data;
  const result = await pool.query(
    `UPDATE items SET
      org_id = COALESCE($1, org_id), category_id = COALESCE($2, category_id),
      name = COALESCE($3, name), description = COALESCE($4, description),
      unit = COALESCE($5, unit), base_price = COALESCE($6, base_price),
      min_price = COALESCE($7, min_price), max_price = COALESCE($8, max_price),
      lead_time_days = COALESCE($9, lead_time_days), coverage_area = COALESCE($10, coverage_area),
      tier = COALESCE($11, tier), updated_at = NOW()
     WHERE id = $12 RETURNING *`,
    [org_id, category_id, name, description, unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier, id]
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE items SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, getById, create, update, softDelete };
