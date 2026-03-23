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
  const { name, description, icon, sort_order, cover_image_url, card_color, tags, enabled } = data;
  const result = await pool.query(
    `INSERT INTO categories (name, description, icon, sort_order, cover_image_url, card_color, tags, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name, description, icon, sort_order || 0, cover_image_url, card_color, tags || null, enabled !== false]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { name, description, icon, sort_order, cover_image_url, card_color, tags, enabled } = data;
  const result = await pool.query(
    `UPDATE categories SET
      name = COALESCE($1, name), description = COALESCE($2, description),
      icon = COALESCE($3, icon), sort_order = COALESCE($4, sort_order),
      cover_image_url = COALESCE($5, cover_image_url),
      card_color = COALESCE($6, card_color),
      tags = COALESCE($7, tags),
      enabled = COALESCE($8, enabled),
      updated_at = NOW()
     WHERE id = $9 RETURNING *`,
    [name, description, icon, sort_order, cover_image_url, card_color, tags || null, enabled, id]
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
