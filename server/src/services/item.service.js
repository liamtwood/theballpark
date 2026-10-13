const pool = require('../db/pool');
const { withTransaction } = require('../db/with-transaction');

// v2dev item model (0015): ONE category_id at any depth (no subcategory_id);
// two lifecycle axes — status (new/active/retired) + approval_status; `type`
// (was `kind`) variant/addon/component dormant; media = images jsonb (the legacy
// image_url column is GONE → derived from the hero image on read). Public-live =
// status='active' AND approval_status='approved' (RLS enforces it too).

/** First entry with is_hero, else images[0]; null when empty. The read paths
 *  attach this as `image_url` so existing card/detail surfaces keep rendering
 *  the primary image without the dropped column. */
function heroFromImages(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const hero = images.find((i) => i && i.is_hero);
  const pick = hero || images[0];
  return pick && pick.url ? pick.url : null;
}

/** Attach the derived `image_url` (hero) so rows read like the old shape. */
function withHero(row) {
  if (!row) return row;
  row.image_url = heroFromImages(row.images);
  return row;
}

async function getAll(orgId, categoryId, _tag) {
  // Public marketplace browse. One home category_id at any depth: selecting a
  // category shows items classified AT it OR at any DESCENDANT (recursive tree) —
  // this replaces the old category_id/subcategory_id two-column filter. RLS gates
  // visibility; the explicit status/approval filter keeps the browse to live items.
  let query = `
    SELECT i.*,
      c.name AS category_name,
      o.name AS supplier_name,
      o.cover_image_url AS supplier_cover_url,
      o.image_display   AS supplier_image_display,
      '{}'::uuid[] AS tag_ids
    FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN orgs o ON i.org_id = o.id
    WHERE i.status = 'active' AND i.approval_status = 'approved' AND i.deleted_at IS NULL
      AND i.type IS DISTINCT FROM 'component'
      AND i.parent_item_id IS NULL
  `;
  const params = [];
  if (orgId) { params.push(orgId); query += ` AND i.org_id = $${params.length}`; }
  if (categoryId) {
    params.push(categoryId);
    query += ` AND i.category_id IN (
      WITH RECURSIVE cat_tree AS (
        SELECT id FROM categories WHERE id = $${params.length}
        UNION ALL
        SELECT c2.id FROM categories c2 JOIN cat_tree ON c2.parent_id = cat_tree.id
      ) SELECT id FROM cat_tree)`;
  }
  // (tag filter returns with the tags sub-slice — item_tags junction now exists but
  // tag discovery/filtering is wired in Stage 'tags'. `_tag` is a no-op for now.)
  query += ' ORDER BY i.created_at DESC';
  const result = await pool.query(query, params);
  return result.rows.map(withHero);
}

async function countsByCategory() {
  // Count live items per home category, then roll each count up through EVERY
  // ancestor (one category_id at any depth → a deep item contributes to all of
  // its ancestors, derived from the tree, not a single parent hop).
  const result = await pool.query(
    `WITH live AS (
       SELECT category_id, COUNT(*)::int AS count
       FROM items
       WHERE status = 'active' AND approval_status = 'approved' AND deleted_at IS NULL
         AND category_id IS NOT NULL
         AND type IS DISTINCT FROM 'component'
         AND parent_item_id IS NULL
       GROUP BY category_id
     ),
     rollup AS (
       SELECT l.count, a.id AS ancestor_id
       FROM live l
       CROSS JOIN LATERAL (
         WITH RECURSIVE up AS (
           SELECT id, parent_id FROM categories WHERE id = l.category_id
           UNION ALL
           SELECT c.id, c.parent_id FROM categories c JOIN up ON c.id = up.parent_id
         ) SELECT id FROM up
       ) a
     )
     SELECT ancestor_id AS category_id, SUM(count)::int AS count
     FROM rollup GROUP BY ancestor_id`
  );
  const map = {};
  let total = 0;
  const liveTotal = await pool.query(
    `SELECT COUNT(*)::int AS n FROM items
      WHERE status = 'active' AND approval_status = 'approved' AND deleted_at IS NULL
        AND category_id IS NOT NULL AND type IS DISTINCT FROM 'component' AND parent_item_id IS NULL`
  );
  total = liveTotal.rows[0]?.n ?? 0;
  for (const r of result.rows) map[r.category_id] = r.count;
  return { counts: map, total };
}

async function getTagsByCategory(_categoryId) {
  // Tag discovery returns with the tags sub-slice (item_tags + tags now exist in
  // 0015; the read/aggregate wiring lands in that stage). Empty for now.
  return [];
}

async function getById(id) {
  const result = await pool.query(
    `SELECT i.*,
      c.name AS category_name,
      o.name AS supplier_name,
      o.cover_image_url AS supplier_cover_url,
      o.image_display   AS supplier_image_display
     FROM items i
     LEFT JOIN categories c ON i.category_id = c.id
     LEFT JOIN orgs o ON i.org_id = o.id
     WHERE i.id = $1`,
    [id]
  );
  const item = withHero(result.rows[0] || null);
  if (!item) return null;
  // Item tags (item_tags → tags vocab). `tags` is the name list the editor binds;
  // `item_tags` carries id/dimension for richer display.
  const tagRows = await pool.query(
    `SELECT t.id AS tag_id, t.name, t.dimension
       FROM public.item_tags it JOIN public.tags t ON t.id = it.tag_id
      WHERE it.item_id = $1 AND it.deleted_at IS NULL AND t.deleted_at IS NULL
      ORDER BY t.name`,
    [id]
  );
  item.tags = tagRows.rows.map((r) => r.name);
  item.item_tags = tagRows.rows.map((r) => ({ tag_id: r.tag_id, dimension: r.dimension, label: r.name }));
  return item;
}

/** Reconcile an item's tag links to the submitted tag NAMES. Tags are an
 *  admin-curated vocabulary (suppliers can't create them — RLS), so each name is
 *  resolved to an EXISTING vocab tag; unknown names are ignored. Missing links are
 *  inserted (reviving a soft-deleted row), removed ones soft-deleted. Returns the
 *  resolved tag names now on the item; `undefined` input leaves links untouched. */
async function syncItemTags(itemId, tagNames) {
  if (tagNames === undefined) return undefined;
  const names = [...new Set((Array.isArray(tagNames) ? tagNames : [])
    .map((s) => String(s).trim()).filter(Boolean))];
  const vocab = names.length
    ? (await pool.query(
        `SELECT id, name FROM public.tags WHERE deleted_at IS NULL AND lower(name) = ANY($1)`,
        [names.map((n) => n.toLowerCase())])).rows
    : [];
  const wantIds = vocab.map((v) => v.id);
  const wantSet = new Set(wantIds);
  const cur = (await pool.query(
    `SELECT tag_id FROM public.item_tags WHERE item_id = $1 AND deleted_at IS NULL`,
    [itemId])).rows.map((r) => r.tag_id);
  const curSet = new Set(cur);
  for (const tagId of wantIds) {
    if (!curSet.has(tagId)) {
      await pool.query(
        `INSERT INTO public.item_tags (item_id, tag_id) VALUES ($1, $2)
         ON CONFLICT (item_id, tag_id) DO UPDATE SET deleted_at = NULL`,
        [itemId, tagId]
      );
    }
  }
  for (const tagId of cur) {
    if (!wantSet.has(tagId)) {
      await pool.query(
        `UPDATE public.item_tags SET deleted_at = NOW()
          WHERE item_id = $1 AND tag_id = $2 AND deleted_at IS NULL`,
        [itemId, tagId]
      );
    }
  }
  return vocab.map((v) => v.name);
}

// Columns a create accepts. `size` is descriptive → lands in attributes, not a column.
async function create(data) {
  const {
    org_id, category_id, name, description,
    unit, serves, time_unit, base_price, install_cost,
    lead_time_days, tier,
    image_display,
    derived_from_id, parent_item_id, attributes, images,
    // two lifecycle axes; create defaults status='new' (not live until approved + activated).
    approval_status, status,
    install_description, currency, install_unit,
    external_url,
    // item type — 'variant'/'addon'/'component' for child rows; null for normal.
    type,
  } = data;
  const result = await pool.query(
    `INSERT INTO items
      (org_id, category_id, name, description,
       unit, serves, time_unit, base_price, install_cost,
       lead_time_days, tier,
       image_display,
       derived_from_id, parent_item_id, attributes, images,
       approval_status, status,
       install_description, install_unit, type, external_url, currency)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
       COALESCE($23, (SELECT default_currency FROM orgs WHERE id = $1)))
     RETURNING *`,
    [org_id, category_id || null, name, description,
     unit, serves ?? null, time_unit || null, base_price, install_cost ?? null,
     lead_time_days ?? null, tier ?? null,
     image_display || 'cover',
     derived_from_id || null, parent_item_id || null, attributes || {},
     JSON.stringify(images || []),
     approval_status ?? 'draft', status ?? 'new',
     install_description ?? null, install_unit ?? null, type ?? null, external_url ?? null,
     currency ?? null]
  );
  return withHero(result.rows[0]);
}

// Whitelist of caller-updatable columns (order irrelevant). `null` is meaningful
// (clears an optional FK); an omitted key leaves the column alone.
const UPDATABLE_COLS = [
  'org_id', 'category_id', 'name', 'description',
  'unit', 'serves', 'time_unit', 'base_price', 'install_cost',
  'lead_time_days', 'tier',
  'image_display',
  'derived_from_id', 'parent_item_id', 'attributes', 'images',
  'install_description', 'currency', 'install_unit', 'external_url',
  // status — new/active/retired (publish/hide lifecycle, distinct from deleted_at).
  'status',
  // draft/submit/approve flow (callers gate which values they allow).
  'approval_status',
];

async function update(id, data) {
  const payload = { ...data };
  const sets = [];
  const params = [];
  for (const col of UPDATABLE_COLS) {
    if (Object.prototype.hasOwnProperty.call(payload, col)) {
      // JSONB columns need a JSON string through pg's parameter binding.
      const value = (col === 'images' || col === 'attributes')
        ? (payload[col] != null ? JSON.stringify(payload[col]) : payload[col])
        : payload[col];
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length === 0) return getById(id);
  sets.push('updated_at = NOW()');
  params.push(id);
  const result = await pool.query(
    `UPDATE items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return withHero(result.rows[0] || null);
}

// Soft-delete: parent-only; cascade to this item's child rows (type='component'/
// variant, parent_item_id = this item). Library copies (parent_item_id NULL) untouched.
async function softDelete(id) {
  const result = await pool.query(
    'UPDATE items SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *', [id]
  );
  if (result.rows[0]) {
    await pool.query(
      'UPDATE items SET deleted_at = NOW() WHERE parent_item_id = $1 AND deleted_at IS NULL', [id]
    );
  }
  return withHero(result.rows[0] || null);
}

// Duplicate an item: clones the row (images[] is jsonb, copies inline). The copy
// lands status='new' (hidden) + approval_status='draft' so the owner reviews before
// publishing. Via withTransaction (RLS pool) so the owner INSERTs their own copy.
async function duplicate(id) {
  return withTransaction(async (client) => {
    const ins = await client.query(
      `INSERT INTO items
         (org_id, category_id, name, description,
          unit, serves, time_unit, base_price, install_cost,
          lead_time_days, tier,
          image_display,
          derived_from_id, parent_item_id, attributes, images, status,
          approval_status,
          install_description, install_unit, type, external_url, currency)
       SELECT
          org_id, category_id, name || ' (copy)', description,
          unit, serves, time_unit, base_price, install_cost,
          lead_time_days, tier,
          image_display,
          derived_from_id, parent_item_id, attributes, images, 'new',
          'draft',
          install_description, install_unit, type, external_url, currency
       FROM items
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    const copy = withHero(ins.rows[0]);
    if (!copy) return null;
    // (item_tags copy returns with the tags sub-slice.)
    return copy;
  });
}

// ── pV2-BUILDUP-03 — item composition (SHELVED; columns dormant) ──────────────
// An item's buildup is CHILD items (parent_item_id = this item, type='component').
const toItemComponent = (c) => ({
  id: c.id, name: c.name, base_price: c.base_price, unit: c.unit,
  quantity: 1, category_id: c.category_id, kind: c.type,
  selection_type: 'selected', description: c.description, image_url: heroFromImages(c.images),
});

async function listComponents(orgId, itemId) {
  const own = await pool.query(
    `SELECT name, description, install_description FROM items
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [itemId, orgId]
  );
  if (!own.rows.length) return null;
  const r = await pool.query(
    `SELECT id, name, base_price, unit, category_id, type, description, images
       FROM items WHERE parent_item_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
    [itemId]
  );
  return {
    components: r.rows.map(toItemComponent),
    parentName: own.rows[0].name,
    parentDescription: own.rows[0].description,
    parentServices: own.rows[0].install_description,
    marginPct: null,
    defaultMarginPct: null,
  };
}

async function saveComponents(orgId, itemId, components, parentName, parentDescription, parentServices) {
  const list = Array.isArray(components) ? components : [];
  return withTransaction(async (client) => {
    const own = await client.query(
      `SELECT id FROM items WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`, [itemId, orgId]
    );
    if (!own.rows.length) return null;
    const existing = await client.query(
      `SELECT id FROM items WHERE parent_item_id = $1 AND deleted_at IS NULL`, [itemId]
    );
    const keep = new Set(list.filter((c) => c.id).map((c) => c.id));
    for (const row of existing.rows) {
      if (!keep.has(row.id)) await client.query(`UPDATE items SET deleted_at = NOW() WHERE id = $1`, [row.id]);
    }
    for (const c of list) {
      const nm = String(c.name || '').trim();
      if (!nm) continue;
      const cost = c.cost == null ? null : Number(c.cost);
      const img = c.image ? JSON.stringify([{ url: c.image, is_hero: true, sort_order: 0 }]) : '[]';
      if (c.id && keep.has(c.id)) {
        await client.query(
          `UPDATE items SET name=$2, base_price=$3, unit=$4, category_id=$5, type=$6, description=$7, images=$8::jsonb
            WHERE id=$1 AND parent_item_id=$9`,
          [c.id, nm, cost, c.unit || null, c.categoryId || null, c.kind || 'component', c.description || null, img, itemId]
        );
      } else {
        await client.query(
          `INSERT INTO items (org_id, parent_item_id, category_id, name, description, unit, base_price, type, images, status, approval_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'component', $8::jsonb, 'active', 'approved')`,
          [orgId, itemId, c.categoryId || null, nm, c.description || null, c.unit || null, cost, img]
        );
      }
      // Clone-up to the library (INSERT-ONLY, deduped by name).
      const exists = await client.query(
        `SELECT 1 FROM items WHERE org_id=$1 AND type='component' AND parent_item_id IS NULL AND deleted_at IS NULL AND lower(name)=lower($2) LIMIT 1`,
        [orgId, nm]
      );
      if (!exists.rows.length) {
        await client.query(
          `INSERT INTO items (org_id, category_id, name, description, unit, base_price, type, images, status, approval_status)
           VALUES ($1, $2, $3, $4, $5, $6, 'component', $7::jsonb, 'active', 'approved')`,
          [orgId, c.categoryId || null, nm, c.description || null, c.unit || null, cost, img]
        );
      }
    }
    if (typeof parentName === 'string' && parentName.trim())
      await client.query(`UPDATE items SET name=$2 WHERE id=$1 AND org_id=$3`, [itemId, parentName.trim(), orgId]);
    if (parentDescription !== undefined)
      await client.query(`UPDATE items SET description=$2 WHERE id=$1 AND org_id=$3`, [itemId, parentDescription || null, orgId]);
    if (parentServices !== undefined)
      await client.query(`UPDATE items SET install_description=$2 WHERE id=$1 AND org_id=$3`, [itemId, parentServices || null, orgId]);
    const rows = await client.query(
      `SELECT id, name, base_price, unit, category_id, type, description, images
         FROM items WHERE parent_item_id=$1 AND deleted_at IS NULL ORDER BY created_at`, [itemId]
    );
    return rows.rows.map(toItemComponent);
  });
}

async function listOptions(itemId) {
  const r = await pool.query(
    `SELECT id, name, base_price, unit, category_id, type, description, images
       FROM items WHERE parent_item_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
    [itemId]
  );
  return r.rows.map(toItemComponent);
}

/** Status rollup for ONE org's own items (supplier home "Next steps"). */
async function statusCountsForOrg(orgId) {
  const r = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE approval_status = 'draft')                             AS draft,
       COUNT(*) FILTER (WHERE approval_status = 'pending')                           AS pending,
       COUNT(*) FILTER (WHERE approval_status = 'rejected')                          AS rejected,
       COUNT(*) FILTER (WHERE approval_status = 'approved' AND status <> 'active')   AS ready_to_promote,
       COUNT(*) FILTER (WHERE approval_status = 'approved' AND status = 'active')    AS live,
       COUNT(*)                                                                       AS total
     FROM items
     WHERE org_id = $1 AND deleted_at IS NULL
       AND type IS DISTINCT FROM 'component'
       AND parent_item_id IS NULL`,
    [orgId]
  );
  const row = r.rows[0] || {};
  return {
    draft: Number(row.draft ?? 0),
    pending: Number(row.pending ?? 0),
    rejected: Number(row.rejected ?? 0),
    readyToPromote: Number(row.ready_to_promote ?? 0),
    live: Number(row.live ?? 0),
    total: Number(row.total ?? 0),
  };
}

// ── Shared item WRITE-POLICY (one definition) ────────────────────────────────
/** Create an item for `orgId`. approval_status defaults to `defaultStatus`
 *  (store: 'draft'; admin: 'pending'); status forced 'new' (only goes 'active'
 *  when a ballpark admin approves + it's activated). Fires the lazy auto-classify. */
async function createForOrg({ data, orgId, defaultStatus, skipClassify = false }) {
  const item = await create({
    ...data,
    org_id: orgId, // sacred — from the caller (session or :orgId), never the body
    approval_status: data.approval_status || defaultStatus,
    status: 'new',
  });
  const tagNames = await syncItemTags(item.id, data.tags);
  if (tagNames !== undefined) item.tags = tagNames;
  if (!skipClassify) {
    require('./taxonomy.service').classifyAndApply(item.id).catch((e) =>
      console.warn('[auto-classify] item', item.id, 'failed:', e.message)
    );
  }
  return item;
}

/** Edit a caller-owned item. Approved items: fields editable but photos + status
 *  LOCKED (no re-review, stays live). Non-approved: editing re-enters the
 *  draft/pending flow and the item goes offline (status='new') until re-approved. */
async function applyEdit(existing, data, { defaultStatus }) {
  let result;
  if (existing.approval_status === 'approved') {
    const fields = { ...data };
    delete fields.images;
    delete fields.approval_status;
    delete fields.status;
    result = await update(existing.id, fields);
  } else {
    result = await update(existing.id, {
      ...data,
      approval_status: data.approval_status || defaultStatus,
      status: 'new',
    });
  }
  // Tags are merchandising links, not an items column — synced here for both
  // branches (a What's Hot toggle on an approved item stays live, no re-review).
  const tagNames = await syncItemTags(existing.id, data.tags);
  if (tagNames !== undefined && result) result.tags = tagNames;
  return result;
}

module.exports = { getAll, getById, getTagsByCategory, countsByCategory, create, update, softDelete, duplicate, listComponents, saveComponents, listOptions, statusCountsForOrg, createForOrg, applyEdit };
