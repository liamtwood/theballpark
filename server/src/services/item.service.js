const pool = require('../db/pool');

async function getAll(orgId, categoryId, tag, subcategoryId) {
  // v1.41: items.category_id is ALWAYS a parent now (migration ran in
  // v1.41) so the legacy OR-clause is a no-op for fresh data — kept
  // for safety in case any historical row hasn't migrated. The new
  // subcategory_id filter is a direct equality on the child FK.
  let query = `
    SELECT i.*,
      c.name  AS category_name,
      sc.name AS subcategory_name,
      o.name  AS supplier_name,
      o.city  AS supplier_city,
      o.cover_image_url AS supplier_cover_url,
      o.image_display   AS supplier_image_display
    FROM items i
    LEFT JOIN categories c  ON i.category_id    = c.id
    LEFT JOIN categories sc ON i.subcategory_id = sc.id
    LEFT JOIN orgs o ON i.org_id = o.id
    WHERE i.is_active = true
  `;
  const params = [];
  if (orgId) { params.push(orgId); query += ` AND i.org_id = $${params.length}`; }
  if (categoryId) {
    params.push(categoryId);
    query += ` AND (i.category_id = $${params.length} OR i.category_id IN (SELECT id FROM categories WHERE parent_id = $${params.length}))`;
  }
  if (subcategoryId) {
    params.push(subcategoryId);
    query += ` AND i.subcategory_id = $${params.length}`;
  }
  if (tag) { params.push(tag); query += ` AND $${params.length} = ANY(i.tags)`; }
  query += ' ORDER BY i.created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function countsByCategory() {
  const result = await pool.query(
    `SELECT i.category_id, c.parent_id, COUNT(*) AS count
     FROM items i
     LEFT JOIN categories c ON i.category_id = c.id
     WHERE i.is_active = true AND i.category_id IS NOT NULL
     GROUP BY i.category_id, c.parent_id`
  );
  const map = {};
  let total = 0;
  for (const r of result.rows) {
    const cnt = parseInt(r.count, 10);
    map[r.category_id] = (map[r.category_id] || 0) + cnt;
    // Roll up to parent
    if (r.parent_id) {
      map[r.parent_id] = (map[r.parent_id] || 0) + cnt;
    }
    total += cnt;
  }
  return { counts: map, total };
}

async function getTagsByCategory(categoryId) {
  const result = await pool.query(
    `SELECT DISTINCT UNNEST(tags) AS tag
     FROM items
     WHERE (category_id = $1 OR category_id IN (SELECT id FROM categories WHERE parent_id = $1))
       AND is_active = true AND tags IS NOT NULL AND array_length(tags, 1) > 0
     ORDER BY tag ASC`,
    [categoryId]
  );
  return result.rows.map(r => r.tag);
}

async function getById(id) {
  const result = await pool.query(
    `SELECT i.*,
      c.name  AS category_name,
      sc.name AS subcategory_name,
      o.name  AS supplier_name,
      o.city  AS supplier_city,
      o.cover_image_url AS supplier_cover_url,
      o.image_display   AS supplier_image_display
     FROM items i
     LEFT JOIN categories c  ON i.category_id    = c.id
     LEFT JOIN categories sc ON i.subcategory_id = sc.id
     LEFT JOIN orgs o ON i.org_id = o.id
     WHERE i.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// v1.17: derive the legacy single-image column from the new images[] array.
// First entry with is_hero=true wins; otherwise images[0]; null when empty.
// Keeps every existing card / detail surface working until they migrate to
// reading images[].
function heroFromImages(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const hero = images.find(i => i && i.is_hero);
  const pick = hero || images[0];
  return pick && pick.url ? pick.url : null;
}

async function create(data) {
  const {
    org_id, category_id, subcategory_id, name, description,
    unit, time_unit, base_price, min_price, max_price,
    lead_time_days, coverage_area, tier, tags,
    image_url, image_display, external_url,
    derived_from_id, parent_item_id, attributes, images
  } = data;
  // Keep image_url in sync with the hero image on the new array, so existing
  // cards / detail surfaces continue to render the same primary image
  // without reading images[].
  const heroUrl = heroFromImages(images);
  const finalImageUrl = heroUrl != null ? heroUrl : (image_url ?? null);
  const result = await pool.query(
    `INSERT INTO items
      (org_id, category_id, subcategory_id, name, description,
       unit, time_unit, base_price, min_price, max_price,
       lead_time_days, coverage_area, tier, tags,
       image_url, image_display, external_url,
       derived_from_id, parent_item_id, attributes, images)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     RETURNING *`,
    [org_id, category_id, subcategory_id || null, name, description,
     unit, time_unit || null, base_price, min_price, max_price,
     lead_time_days, coverage_area, tier, tags || [],
     finalImageUrl, image_display || 'cover', external_url || null,
     derived_from_id || null, parent_item_id || null, attributes || {},
     JSON.stringify(images || [])]
  );
  return result.rows[0];
}

// Columns the caller is allowed to update through this endpoint.
// Order does not matter; this is just the whitelist.
// v1.41: subcategory_id added so the item drawer can set/clear the
// optional child-category FK. The DB trigger validates that the new
// subcategory's parent_id matches the row's category_id.
const UPDATABLE_COLS = [
  'org_id', 'category_id', 'subcategory_id', 'name', 'description',
  'unit', 'time_unit', 'base_price', 'min_price', 'max_price',
  'lead_time_days', 'coverage_area', 'tier', 'tags',
  'image_url', 'image_display', 'external_url',
  'derived_from_id', 'parent_item_id', 'attributes', 'images'
];

async function update(id, data) {
  // Dynamic SET — only touch columns the caller actually sent. This means
  // `null` *is* a meaningful value (used by the drawer to clear an optional
  // FK like derived_from_id) while an omitted key leaves the column alone.
  //
  // v1.17 backward-compat: when the caller sends `images` (new array shape),
  // we also write image_url from the hero entry so existing card/detail
  // surfaces stay rendering the same primary image. The caller may also
  // explicitly send image_url to override — explicit always wins.
  const payload = { ...data };
  if (Object.prototype.hasOwnProperty.call(payload, 'images')
      && !Object.prototype.hasOwnProperty.call(payload, 'image_url')) {
    payload.image_url = heroFromImages(payload.images);
  }

  const sets = [];
  const params = [];
  for (const col of UPDATABLE_COLS) {
    if (Object.prototype.hasOwnProperty.call(payload, col)) {
      // JSONB columns need a JSON string when passed via pg's parameter
      // binding — pg won't stringify arrays/objects for us.
      const value = (col === 'images' || col === 'attributes')
        ? (payload[col] != null ? JSON.stringify(payload[col]) : payload[col])
        : payload[col];
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length === 0) {
    // No updatable keys — return the existing row so callers get a sensible
    // result instead of NULL.
    return getById(id);
  }
  sets.push('updated_at = NOW()');
  params.push(id);
  const result = await pool.query(
    `UPDATE items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE items SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, getById, getTagsByCategory, countsByCategory, create, update, softDelete };
