const pool = require('../db/pool');

// getAll(namespace)
//   - undefined / omitted → return ALL categories (both namespaces)
//   - 'catalogue'        → catalogue only
//   - 'feedback'         → feedback only
async function getAll(namespace) {
  if (namespace) {
    const result = await pool.query(
      'SELECT * FROM categories WHERE is_active = true AND namespace = $1 ORDER BY sort_order ASC, created_at DESC',
      [namespace]
    );
    return result.rows;
  }
  const result = await pool.query(
    'SELECT * FROM categories WHERE is_active = true ORDER BY namespace ASC, sort_order ASC, created_at DESC'
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
  const {
    name, description, icon, sort_order, cover_image_url, card_color,
    tags, enabled, namespace, parent_id, tagline, model,
    icon_name, icon_color, object_type
  } = data;
  const result = await pool.query(
    `INSERT INTO categories
       (name, description, icon, sort_order, cover_image_url, card_color, tags, enabled,
        namespace, parent_id, tagline, model, icon_name, icon_color, object_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [
      name, description, icon, sort_order || 0, cover_image_url, card_color,
      tags || null, enabled !== false,
      namespace || 'catalogue', parent_id || null, tagline || null,
      model || 'A', icon_name || null, icon_color || null, object_type || null
    ]
  );
  return result.rows[0];
}

async function update(id, data) {
  const {
    name, description, icon, sort_order, cover_image_url, card_color,
    tags, enabled, namespace, parent_id, tagline, model,
    icon_name, icon_color, object_type
  } = data;
  const result = await pool.query(
    `UPDATE categories SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      icon = COALESCE($3, icon),
      sort_order = COALESCE($4, sort_order),
      cover_image_url = COALESCE($5, cover_image_url),
      card_color = COALESCE($6, card_color),
      tags = COALESCE($7, tags),
      enabled = COALESCE($8, enabled),
      namespace = COALESCE($9, namespace),
      parent_id = COALESCE($10, parent_id),
      tagline = COALESCE($11, tagline),
      model = COALESCE($12, model),
      icon_name = COALESCE($13, icon_name),
      icon_color = COALESCE($14, icon_color),
      object_type = COALESCE($15, object_type),
      updated_at = NOW()
     WHERE id = $16 RETURNING *`,
    [
      name, description, icon, sort_order, cover_image_url, card_color,
      tags || null, enabled, namespace, parent_id, tagline, model,
      icon_name, icon_color, object_type, id
    ]
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
