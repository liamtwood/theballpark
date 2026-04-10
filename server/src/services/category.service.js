const pool = require('../db/pool');

async function getAll() {
  const result = await pool.query('SELECT * FROM categories WHERE is_active = true ORDER BY sort_order ASC, created_at DESC');
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getChildren(parentId) {
  const result = await pool.query(
    'SELECT * FROM categories WHERE parent_id = $1 AND is_active = true ORDER BY sort_order ASC',
    [parentId]
  );
  return result.rows;
}

async function getTopLevel() {
  const result = await pool.query(
    'SELECT * FROM categories WHERE parent_id IS NULL AND level = 0 AND enabled = true AND is_active = true ORDER BY sort_order ASC'
  );
  return result.rows;
}

async function create(data) {
  const { name, description, icon, sort_order, cover_image_url, card_color, tags, enabled, tagline, parent_id, level, org_id } = data;
  const result = await pool.query(
    `INSERT INTO categories (name, description, icon, sort_order, cover_image_url, card_color, tags, enabled, tagline, parent_id, level, org_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [name, description, icon, sort_order || 0, cover_image_url, card_color, tags || null, enabled !== false, tagline || null, parent_id || null, level || 0, org_id || null]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { name, description, icon, sort_order, cover_image_url, card_color, tags, enabled, tagline, parent_id, level, org_id } = data;
  const result = await pool.query(
    `UPDATE categories SET
      name = COALESCE($1, name), description = COALESCE($2, description),
      icon = COALESCE($3, icon), sort_order = COALESCE($4, sort_order),
      cover_image_url = COALESCE($5, cover_image_url),
      card_color = COALESCE($6, card_color),
      tags = COALESCE($7, tags),
      enabled = COALESCE($8, enabled),
      tagline = COALESCE($9, tagline),
      parent_id = COALESCE($10, parent_id),
      level = COALESCE($11, level),
      org_id = COALESCE($12, org_id),
      updated_at = NOW()
     WHERE id = $13 RETURNING *`,
    [name, description, icon, sort_order, cover_image_url, card_color, tags || null, enabled, tagline, parent_id, level, org_id, id]
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE categories SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, getById, getChildren, getTopLevel, create, update, softDelete };
