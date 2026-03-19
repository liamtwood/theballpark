const pool = require('../db/pool');

async function getAll() {
  const result = await pool.query('SELECT * FROM categories WHERE is_active = true ORDER BY created_at DESC');
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const { name, description, icon, sort_order } = data;
  const result = await pool.query(
    'INSERT INTO categories (name, description, icon, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, description, icon, sort_order]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { name, description, icon, sort_order } = data;
  const result = await pool.query(
    `UPDATE categories SET
      name = COALESCE($1, name), description = COALESCE($2, description),
      icon = COALESCE($3, icon), sort_order = COALESCE($4, sort_order),
      updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [name, description, icon, sort_order, id]
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE categories SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, getById, create, update, softDelete };
