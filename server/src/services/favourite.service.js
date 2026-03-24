const pool = require('../db/pool');

async function getAll(orgId) {
  const result = await pool.query(
    `SELECT f.*, 
      CASE WHEN f.type = 'supplier' THEN o.name ELSE i.name END as ref_name,
      CASE WHEN f.type = 'supplier' THEN o.cover_image_url ELSE NULL END as ref_image_url,
      CASE WHEN f.type = 'item' THEN i.base_price ELSE NULL END as ref_price,
      CASE WHEN f.type = 'item' THEN c.name ELSE NULL END as ref_category,
      CASE WHEN f.type = 'item' THEN o.name ELSE NULL END as supplier_name,
      CASE WHEN f.type = 'item' THEN o.id ELSE NULL END as supplier_org_id
     FROM favourites f
     LEFT JOIN orgs o ON (f.type = 'supplier' AND f.ref_id = o.id)
                      OR (f.type = 'item' AND o.id = (SELECT org_id FROM items WHERE id = f.ref_id LIMIT 1))
     LEFT JOIN items i ON f.type = 'item' AND f.ref_id = i.id
     LEFT JOIN categories c ON i.category_id = c.id
     WHERE f.org_id = $1 AND f.is_active = true
     ORDER BY f.created_at DESC`,
    [orgId]
  );
  return result.rows;
}

async function toggle(orgId, type, refId) {
  // Check if already exists
  const existing = await pool.query(
    'SELECT id FROM favourites WHERE org_id = $1 AND type = $2 AND ref_id = $3',
    [orgId, type, refId]
  );
  if (existing.rows.length > 0) {
    // Toggle is_active
    const current = await pool.query(
      'SELECT is_active FROM favourites WHERE id = $1', [existing.rows[0].id]
    );
    const newState = !current.rows[0].is_active;
    await pool.query(
      'UPDATE favourites SET is_active = $1, updated_at = NOW() WHERE id = $2',
      [newState, existing.rows[0].id]
    );
    return { favourited: newState };
  } else {
    // Create new
    await pool.query(
      'INSERT INTO favourites (org_id, type, ref_id) VALUES ($1, $2, $3)',
      [orgId, type, refId]
    );
    return { favourited: true };
  }
}

async function isFavourited(orgId, type, refId) {
  const result = await pool.query(
    'SELECT id FROM favourites WHERE org_id = $1 AND type = $2 AND ref_id = $3 AND is_active = true',
    [orgId, type, refId]
  );
  return result.rows.length > 0;
}

async function getFavouritedIds(orgId, type) {
  const result = await pool.query(
    'SELECT ref_id FROM favourites WHERE org_id = $1 AND type = $2 AND is_active = true',
    [orgId, type]
  );
  return result.rows.map(r => r.ref_id);
}

module.exports = { getAll, toggle, isFavourited, getFavouritedIds };
