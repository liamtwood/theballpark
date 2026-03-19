const pool = require('../db/pool');

async function getAll(projectId) {
  let query = `SELECT e.*, s.name as status_name, s.color as status_color
    FROM estimates e LEFT JOIN statuses s ON e.status_id = s.id
    WHERE e.is_active = true`;
  const params = [];
  if (projectId) { params.push(projectId); query += ` AND e.project_id = $${params.length}`; }
  query += ' ORDER BY e.created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM estimates WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const { project_id, name, description, version, total_value, balls_cost, status_id } = data;
  const result = await pool.query(
    `INSERT INTO estimates (project_id, name, description, version, total_value, balls_cost, status_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [project_id, name, description, version || 1, total_value || 0, balls_cost || 1, status_id]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { name, description, version, total_value, balls_cost, status_id } = data;
  const result = await pool.query(
    `UPDATE estimates SET
      name = COALESCE($1, name), description = COALESCE($2, description),
      version = COALESCE($3, version), total_value = COALESCE($4, total_value),
      balls_cost = COALESCE($5, balls_cost), status_id = COALESCE($6, status_id),
      updated_at = NOW()
     WHERE id = $7 RETURNING *`,
    [name, description, version, total_value, balls_cost, status_id, id]
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE estimates SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  return result.rows[0] || null;
}

async function recalcTotal(estimateId) {
  const totals = await pool.query(
    'SELECT COALESCE(SUM(total_price), 0) AS total_value FROM estimate_items WHERE estimate_id = $1',
    [estimateId]
  );
  await pool.query(
    'UPDATE estimates SET total_value = $1, updated_at = NOW() WHERE id = $2',
    [totals.rows[0].total_value, estimateId]
  );
}

module.exports = { getAll, getById, create, update, softDelete, recalcTotal };
