const pool = require('../db/pool');

async function getAll(orgId, categoryId, tag) {
  let query = `
    SELECT i.*,
      c.name AS category_name,
      o.name AS supplier_name,
      o.city AS supplier_city,
      o.cover_image_url AS supplier_cover_url
    FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN orgs o ON i.org_id = o.id
    WHERE i.is_active = true
  `;
  const params = [];
  if (orgId) { params.push(orgId); query += ` AND i.org_id = $${params.length}`; }
  if (categoryId) { params.push(categoryId); query += ` AND i.category_id = $${params.length}`; }
  if (tag) { params.push(tag); query += ` AND $${params.length} = ANY(i.tags)`; }
  query += ' ORDER BY i.created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getTagsByCategory(categoryId) {
  const result = await pool.query(
    `SELECT DISTINCT UNNEST(tags) AS tag
     FROM items
     WHERE category_id = $1 AND is_active = true AND tags IS NOT NULL AND array_length(tags, 1) > 0
     ORDER BY tag ASC`,
    [categoryId]
  );
  return result.rows.map(r => r.tag);
}

async function getById(id) {
  const result = await pool.query(
    `SELECT i.*,
      c.name AS category_name,
      o.name AS supplier_name,
      o.city AS supplier_city,
      o.cover_image_url AS supplier_cover_url
     FROM items i
     LEFT JOIN categories c ON i.category_id = c.id
     LEFT JOIN orgs o ON i.org_id = o.id
     WHERE i.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function create(data) {
  const {
    org_id, category_id, name, description, unit,
    base_price, min_price, max_price, lead_time_days,
    coverage_area, tier, tags, image_url
  } = data;
  const result = await pool.query(
    `INSERT INTO items
      (org_id, category_id, name, description, unit, base_price, min_price,
       max_price, lead_time_days, coverage_area, tier, tags, image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [org_id, category_id, name, description, unit, base_price, min_price,
     max_price, lead_time_days, coverage_area, tier, tags || [], image_url]
  );
  return result.rows[0];
}

async function update(id, data) {
  const {
    org_id, category_id, name, description, unit,
    base_price, min_price, max_price, lead_time_days,
    coverage_area, tier, tags, image_url
  } = data;
  const result = await pool.query(
    `UPDATE items SET
      org_id = COALESCE($1, org_id), category_id = COALESCE($2, category_id),
      name = COALESCE($3, name), description = COALESCE($4, description),
      unit = COALESCE($5, unit), base_price = COALESCE($6, base_price),
      min_price = COALESCE($7, min_price), max_price = COALESCE($8, max_price),
      lead_time_days = COALESCE($9, lead_time_days), coverage_area = COALESCE($10, coverage_area),
      tier = COALESCE($11, tier), tags = COALESCE($12, tags),
      image_url = COALESCE($13, image_url), updated_at = NOW()
     WHERE id = $14 RETURNING *`,
    [org_id, category_id, name, description, unit, base_price, min_price,
     max_price, lead_time_days, coverage_area, tier, tags, image_url, id]
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE items SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, getById, getTagsByCategory, create, update, softDelete };
