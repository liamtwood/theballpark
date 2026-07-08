const pool = require('../db/pool');
const { als } = require('../db/request-context');

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
      o.image_display   AS supplier_image_display,
      COALESCE((SELECT array_agg(sit.tag_id)
                  FROM supplier_item_tag sit WHERE sit.item_id = i.id), '{}') AS tag_ids
    FROM items i
    LEFT JOIN categories c  ON i.category_id    = c.id
    LEFT JOIN categories sc ON i.subcategory_id = sc.id
    LEFT JOIN orgs o ON i.org_id = o.id
    WHERE i.is_active = true AND i.deleted_at IS NULL
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
     WHERE i.is_active = true AND i.deleted_at IS NULL AND i.category_id IS NOT NULL
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
       AND is_active = true AND deleted_at IS NULL AND tags IS NOT NULL AND array_length(tags, 1) > 0
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
  const item = result.rows[0] || null;
  if (!item) return null;
  // v1.43: hydrate the structured (dimension-scoped) tags from the
  // supplier_item_tag junction so detail/drawer surfaces can show them.
  const tags = await pool.query(
    `SELECT t.id AS tag_id, t.dimension, t.label
       FROM supplier_item_tag sit
       JOIN tag t ON t.id = sit.tag_id
      WHERE sit.item_id = $1
      ORDER BY t.dimension ASC, t.sort_order ASC`,
    [id]
  );
  item.item_tags = tags.rows;
  return item;
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
    unit, time_unit, base_price, install_cost,
    lead_time_days, coverage_area, tier, tags,
    image_url, image_display, external_url,
    derived_from_id, parent_item_id, attributes, images,
    // pV2-STORE-01 — the supplier draft/submit flow sets these explicitly. When
    // omitted (v1 callers) the column defaults stand in: 'approved' + true, so
    // existing behaviour is unchanged.
    approval_status, is_active,
    // pV2-STORE-01 (data model) — install_description = "Included Services";
    // location_coverage = free text; currency defaults to the supplier's org
    // currency when not supplied (the COALESCE below).
    install_description, location_coverage, currency
  } = data;
  // Keep image_url in sync with the hero image on the new array, so existing
  // cards / detail surfaces continue to render the same primary image
  // without reading images[].
  const heroUrl = heroFromImages(images);
  const finalImageUrl = heroUrl != null ? heroUrl : (image_url ?? null);
  const result = await pool.query(
    `INSERT INTO items
      (org_id, category_id, subcategory_id, name, description,
       unit, time_unit, base_price, install_cost,
       lead_time_days, coverage_area, tier, tags,
       image_url, image_display, external_url,
       derived_from_id, parent_item_id, attributes, images,
       approval_status, is_active,
       install_description, location_coverage, currency)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
       COALESCE($25, (SELECT default_currency FROM orgs WHERE id = $1)))
     RETURNING *`,
    [org_id, category_id, subcategory_id || null, name, description,
     unit, time_unit || null, base_price, install_cost ?? null,
     lead_time_days, coverage_area, tier, tags || [],
     finalImageUrl, image_display || 'cover', external_url || null,
     derived_from_id || null, parent_item_id || null, attributes || {},
     JSON.stringify(images || []),
     approval_status ?? 'approved', is_active ?? true,
     install_description ?? null, location_coverage ?? null, currency ?? null]
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
  'unit', 'time_unit', 'base_price', 'install_cost',
  'lead_time_days', 'coverage_area', 'tier', 'tags',
  'image_url', 'image_display', 'external_url',
  'derived_from_id', 'parent_item_id', 'attributes', 'images',
  // pV2-STORE-01 (data model) — install cost / included services / coverage /
  // currency.
  'install_description', 'location_coverage', 'currency', 'install_unit',
  // v1.68b — is_active is the publish/hide toggle (distinct from the
  // deleted_at soft-delete). The supplier store's eye/eye-off action
  // PUTs { is_active } through update() to hide/show an item.
  'is_active',
  // pV2-STORE-01 — draft/submit/approve flow. Callers gate which values they
  // allow (supplier: draft|pending; ballpark admin: approved|rejected).
  'approval_status'
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

// v1.68b — items converged to the deleted_at soft-delete pattern (was the
// legacy is_active=false). deleted_at REMOVES the item; is_active is now an
// independent publish/hide toggle. The BEFORE-DELETE hard-delete guard and
// the audit stamp trigger (deleted_by from app.current_user_id, set per
// request in pool.js) are already installed on items (Item 1, v1.66e6).
async function softDelete(id) {
  const result = await pool.query(
    'UPDATE items SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *', [id]
  );
  return result.rows[0] || null;
}

// v1.68b — duplicate an item: clones the items row (the images[] gallery is a
// JSONB column, so it copies inline) + the supplier_item_tag taxonomy rows, in
// one transaction. The copy lands is_active=false (hidden) so the owner reviews
// before publishing. pool.query's auto-GUC only wraps single statements, so we
// run our own transaction and SET LOCAL app.current_user_id (mirrors pool.js)
// for correct created_by attribution.
async function duplicate(id) {
  const ctx = als.getStore && als.getStore();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (ctx && ctx.userId) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [ctx.userId]);
    }
    const ins = await client.query(
      `INSERT INTO items
         (org_id, category_id, subcategory_id, name, description,
          unit, time_unit, base_price, install_cost,
          lead_time_days, coverage_area, tier, tags,
          image_url, image_display, external_url,
          derived_from_id, parent_item_id, attributes, images, is_active,
          approval_status,
          install_description, location_coverage, currency)
       SELECT
          org_id, category_id, subcategory_id, name || ' (copy)', description,
          unit, time_unit, base_price, install_cost,
          lead_time_days, coverage_area, tier, tags,
          image_url, image_display, external_url,
          derived_from_id, parent_item_id, attributes, images, false,
          'draft',
          install_description, location_coverage, currency
       FROM items
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    const copy = ins.rows[0];
    if (!copy) { await client.query('ROLLBACK'); return null; }
    await client.query(
      `INSERT INTO supplier_item_tag (item_id, tag_id)
       SELECT $1, tag_id FROM supplier_item_tag WHERE item_id = $2`,
      [copy.id, id]
    );
    await client.query('COMMIT');
    return copy;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getAll, getById, getTagsByCategory, countsByCategory, create, update, softDelete, duplicate };
