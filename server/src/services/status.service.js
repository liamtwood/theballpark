const pool = require('../db/pool');

async function getAll() {
  const result = await pool.query('SELECT * FROM statuses WHERE is_active = true ORDER BY created_at DESC');
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM statuses WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const { entity_type, name, description, label, color, sort_order } = data;
  const result = await pool.query(
    `INSERT INTO statuses (entity_type, name, description, label, color, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [entity_type, name, description, label, color, sort_order]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { entity_type, name, description, label, color, sort_order } = data;
  const result = await pool.query(
    `UPDATE statuses SET
      entity_type = COALESCE($1, entity_type), name = COALESCE($2, name),
      description = COALESCE($3, description), label = COALESCE($4, label),
      color = COALESCE($5, color), sort_order = COALESCE($6, sort_order),
      updated_at = NOW()
     WHERE id = $7 RETURNING *`,
    [entity_type, name, description, label, color, sort_order, id]
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE statuses SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, getById, create, update, softDelete };
