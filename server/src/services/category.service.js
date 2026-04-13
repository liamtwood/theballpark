const pool = require('../db/pool');

async function getAll(namespace) {
  const ns = namespace || 'catalogue';
  const result = await pool.query(
    'SELECT * FROM categories WHERE is_active = true AND namespace = $1 ORDER BY sort_order ASC, created_at DESC',
    [ns]
  );
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getByNamespace(namespace) {
  const result = await pool.query(
    'SELECT * FROM categories WHERE is_active = true AND namespace = $1 ORDER BY sort_order ASC, created_at DESC',
    [namespace]
  );
  return result.rows;
}

async function create(data) {
  const { name, description, icon, sort_order, cover_image_url, card_color, tags, enabled, namespace, parent_id, tagline } = data;
  const result = await pool.query(
    `INSERT INTO categories (name, description, icon, sort_order, cover_image_url, card_color, tags, enabled, namespace, parent_id, tagline)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [name, description, icon, sort_order || 0, cover_image_url, card_color, tags || null, enabled !== false, namespace || 'catalogue', parent_id || null, tagline || null]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { name, description, icon, sort_order, cover_image_url, card_color, tags, enabled, namespace, parent_id, tagline } = data;
  const result = await pool.query(
    `UPDATE categories SET
      name = COALESCE($1, name), description = COALESCE($2, description),
      icon = COALESCE($3, icon), sort_order = COALESCE($4, sort_order),
      cover_image_url = COALESCE($5, cover_image_url),
      card_color = COALESCE($6, card_color),
      tags = COALESCE($7, tags),
      enabled = COALESCE($8, enabled),
      namespace = COALESCE($9, namespace),
      parent_id = COALESCE($10, parent_id),
      tagline = COALESCE($11, tagline),
      updated_at = NOW()
     WHERE id = $12 RETURNING *`,
    [name, description, icon, sort_order, cover_image_url, card_color, tags || null, enabled, namespace, parent_id, tagline, id]
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE categories SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, getById, getByNamespace, create, update, softDelete };
