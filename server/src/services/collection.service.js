// pV2-ADDONS-02 Stage 1 — Collections = org-scoped tags (dimension='collection').
// An item can belong to any number of collections (item_tags membership). A supplier
// owns their own collection tags (RLS: tags_collection_owner). Runs on the request-
// pinned client (pool.query), so every write is RLS-scoped to the caller's org.
const pool = require('../db/pool');

function toRef(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'collection';
}

/** The org's collection tags — the picklist source. */
async function listForOrg(orgId) {
  const r = await pool.query(
    `SELECT id, name, ref FROM public.tags
      WHERE org_id = $1 AND dimension = 'collection' AND deleted_at IS NULL
      ORDER BY lower(name)`,
    [orgId]
  );
  return r.rows;
}

/** Create a collection for the org, idempotent on (org, lower(name)) — revives a
 *  soft-deleted one, returns the existing one if the name already exists. */
async function create(orgId, name) {
  const nm = String(name || '').trim();
  if (!nm) return null;
  const existing = await pool.query(
    `SELECT id, name, ref, deleted_at FROM public.tags
      WHERE org_id = $1 AND dimension = 'collection' AND lower(name) = lower($2) LIMIT 1`,
    [orgId, nm]
  );
  if (existing.rows.length) {
    const row = existing.rows[0];
    if (row.deleted_at) await pool.query(`UPDATE public.tags SET deleted_at = NULL, updated_at = NOW() WHERE id = $1`, [row.id]);
    return { id: row.id, name: row.name, ref: row.ref };
  }
  const r = await pool.query(
    `INSERT INTO public.tags (org_id, name, ref, dimension, status)
     VALUES ($1, $2, $3, 'collection', 'active') RETURNING id, name, ref`,
    [orgId, nm, toRef(nm)]
  );
  return r.rows[0];
}

/** The item's current collections (for loading the editor). */
async function getItemCollections(itemId) {
  const r = await pool.query(
    `SELECT t.id, t.name, t.ref FROM public.item_tags it
       JOIN public.tags t ON t.id = it.tag_id AND t.dimension = 'collection' AND t.deleted_at IS NULL
      WHERE it.item_id = $1 AND it.deleted_at IS NULL
      ORDER BY lower(t.name)`,
    [itemId]
  );
  return r.rows;
}

/** Sync the item's collection memberships (add/revive/soft-delete). Scoped to the
 *  org's OWN collection tags — ignores ids that aren't this org's collections, and
 *  only ever touches dimension='collection' links (never merchandising/What's Hot). */
async function setItemCollections(itemId, orgId, collectionIds) {
  const ids = [...new Set((Array.isArray(collectionIds) ? collectionIds : []).map((x) => String(x)))];
  const valid = ids.length
    ? (await pool.query(
        `SELECT id FROM public.tags
          WHERE id = ANY($1::uuid[]) AND org_id = $2 AND dimension = 'collection' AND deleted_at IS NULL`,
        [ids, orgId]
      )).rows.map((r) => r.id)
    : [];
  const wantSet = new Set(valid);
  const cur = (await pool.query(
    `SELECT it.tag_id FROM public.item_tags it
       JOIN public.tags t ON t.id = it.tag_id AND t.dimension = 'collection'
      WHERE it.item_id = $1 AND it.deleted_at IS NULL`,
    [itemId]
  )).rows.map((r) => r.tag_id);
  const curSet = new Set(cur);
  for (const tagId of valid) {
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
        `UPDATE public.item_tags SET deleted_at = NOW() WHERE item_id = $1 AND tag_id = $2 AND deleted_at IS NULL`,
        [itemId, tagId]
      );
    }
  }
  return valid;
}

// ── Related items (pV2-ADDONS-02) ───────────────────────────────────────────
// The item POINTS AT a collection (item_related_tags) it is NOT a member of, so that
// collection's members become the item's related complements. Same picklist + create
// as membership; only the junction differs. Authoring path (own-org writes, RLS-scoped).

/** The item's current Related-items links (collections it points at). */
async function getItemRelated(itemId) {
  const r = await pool.query(
    `SELECT t.id, t.name, t.ref FROM public.item_related_tags rt
       JOIN public.tags t ON t.id = rt.tag_id AND t.dimension = 'collection' AND t.deleted_at IS NULL
      WHERE rt.item_id = $1 AND rt.deleted_at IS NULL
      ORDER BY lower(t.name)`,
    [itemId]
  );
  return r.rows;
}

/** Sync the item's Related-items links (add/revive/soft-delete). Scoped to the org's OWN
 *  collection tags — ignores ids that aren't this org's collections. */
async function setItemRelated(itemId, orgId, collectionIds) {
  const ids = [...new Set((Array.isArray(collectionIds) ? collectionIds : []).map((x) => String(x)))];
  const valid = ids.length
    ? (await pool.query(
        `SELECT id FROM public.tags
          WHERE id = ANY($1::uuid[]) AND org_id = $2 AND dimension = 'collection' AND deleted_at IS NULL`,
        [ids, orgId]
      )).rows.map((r) => r.id)
    : [];
  const wantSet = new Set(valid);
  const cur = (await pool.query(
    `SELECT rt.tag_id FROM public.item_related_tags rt
      WHERE rt.item_id = $1 AND rt.deleted_at IS NULL`,
    [itemId]
  )).rows.map((r) => r.tag_id);
  const curSet = new Set(cur);
  for (const tagId of valid) {
    if (!curSet.has(tagId)) {
      await pool.query(
        `INSERT INTO public.item_related_tags (item_id, tag_id) VALUES ($1, $2)
         ON CONFLICT (item_id, tag_id) DO UPDATE SET deleted_at = NULL`,
        [itemId, tagId]
      );
    }
  }
  for (const tagId of cur) {
    if (!wantSet.has(tagId)) {
      await pool.query(
        `UPDATE public.item_related_tags SET deleted_at = NOW() WHERE item_id = $1 AND tag_id = $2 AND deleted_at IS NULL`,
        [itemId, tagId]
      );
    }
  }
  return valid;
}

/** Bulk ADD: put each of `itemIds` into each of `collectionIds` (membership), without
 *  disturbing their other memberships. Scoped to the org's OWN collections + OWN items —
 *  ignores anything that isn't. Used by the bulk Reclassify dialog. */
async function addItemsToCollections(orgId, collectionIds, itemIds) {
  const cols = [...new Set((Array.isArray(collectionIds) ? collectionIds : []).map((x) => String(x)))];
  const items = [...new Set((Array.isArray(itemIds) ? itemIds : []).map((x) => String(x)))];
  if (!cols.length || !items.length) return { added: 0 };
  const validCols = (await pool.query(
    `SELECT id FROM public.tags WHERE id = ANY($1::uuid[]) AND org_id = $2 AND dimension = 'collection' AND deleted_at IS NULL`,
    [cols, orgId]
  )).rows.map((r) => r.id);
  const validItems = (await pool.query(
    `SELECT id FROM public.items WHERE id = ANY($1::uuid[]) AND org_id = $2 AND deleted_at IS NULL`,
    [items, orgId]
  )).rows.map((r) => r.id);
  if (!validItems.length || !validCols.length) return { added: 0 };
  // One set-based upsert (items × collections) instead of N×M round-trips.
  const r = await pool.query(
    `INSERT INTO public.item_tags (item_id, tag_id)
       SELECT i, t FROM unnest($1::uuid[]) i CROSS JOIN unnest($2::uuid[]) t
     ON CONFLICT (item_id, tag_id) DO UPDATE SET deleted_at = NULL`,
    [validItems, validCols]
  );
  return { added: r.rowCount };
}

/** Bulk ADD related links: point each of `itemIds` at each of `collectionIds` (item_related_tags),
 *  without disturbing existing links. Own collections + own items only. The bulk Reclassify dialog. */
async function addItemsToRelated(orgId, collectionIds, itemIds) {
  const cols = [...new Set((Array.isArray(collectionIds) ? collectionIds : []).map((x) => String(x)))];
  const items = [...new Set((Array.isArray(itemIds) ? itemIds : []).map((x) => String(x)))];
  if (!cols.length || !items.length) return { added: 0 };
  const validCols = (await pool.query(
    `SELECT id FROM public.tags WHERE id = ANY($1::uuid[]) AND org_id = $2 AND dimension = 'collection' AND deleted_at IS NULL`,
    [cols, orgId]
  )).rows.map((r) => r.id);
  const validItems = (await pool.query(
    `SELECT id FROM public.items WHERE id = ANY($1::uuid[]) AND org_id = $2 AND deleted_at IS NULL`,
    [items, orgId]
  )).rows.map((r) => r.id);
  if (!validItems.length || !validCols.length) return { added: 0 };
  const r = await pool.query(
    `INSERT INTO public.item_related_tags (item_id, tag_id)
       SELECT i, t FROM unnest($1::uuid[]) i CROSS JOIN unnest($2::uuid[]) t
     ON CONFLICT (item_id, tag_id) DO UPDATE SET deleted_at = NULL`,
    [validItems, validCols]
  );
  return { added: r.rowCount };
}

/** The collections this item belongs to, each with its OTHER tagged MEMBERS (excluding
 *  self) — drives the quick-view strip. Membership-driven (no auto-expanding a member's
 *  children): a chip appears iff that item/child is itself tagged, so removing a tag
 *  removes the chip. Visibility follows the grid: active+approved for everyone, PLUS the
 *  viewer's own-org drafts/pending (My Shop) and everything for a ballpark admin. */
async function collectionsForItem(idOrBpin, viewerOrgId, isAdmin) {
  const own = (await pool.query(
    `SELECT id FROM public.items WHERE (id::text = $1 OR bpin = $1) AND deleted_at IS NULL LIMIT 1`, [String(idOrBpin)]
  )).rows[0];
  if (!own) return [];
  const r = await pool.query(
    `SELECT t.id AS collection_id, t.name AS collection_name,
            m.id, m.bpin, m.name, (m.images -> 0 ->> 'url') AS cover_url,
            (m.parent_item_id IS NOT NULL) AS is_child,
            (m.id = $1) AS is_current
       FROM public.item_tags me
       JOIN public.tags t      ON t.id = me.tag_id AND t.dimension = 'collection' AND t.deleted_at IS NULL
       JOIN public.item_tags mt ON mt.tag_id = t.id AND mt.deleted_at IS NULL
       JOIN public.items m      ON m.id = mt.item_id AND m.deleted_at IS NULL
            AND m.type IS DISTINCT FROM 'component'
            AND ( (m.status = 'active' AND m.approval_status = 'approved')  -- public scope
                  OR m.org_id = $2                                          -- own-org drafts (My Shop)
                  OR $3 )                                                   -- ballpark admin
      WHERE me.item_id = $1 AND me.deleted_at IS NULL
      -- current item first, then items before their children, then by name.
      ORDER BY lower(t.name), (m.id <> $1), (m.parent_item_id IS NOT NULL), lower(m.name)`,
    [own.id, viewerOrgId || null, !!isAdmin]
  );
  const byCol = new Map();
  for (const row of r.rows) {
    if (!byCol.has(row.collection_id)) byCol.set(row.collection_id, { id: row.collection_id, name: row.collection_name, items: [] });
    byCol.get(row.collection_id).items.push({
      id: row.id, bpin: row.bpin, name: row.name, coverUrl: row.cover_url, isChild: row.is_child, isCurrent: row.is_current,
    });
  }
  // Only worth a strip when there's at least one OTHER visible member besides the current.
  return [...byCol.values()].filter((c) => c.items.length >= 2);
}

/** Related items for the quick-view strip: the members of the collections this base item
 *  POINTS AT via item_related_tags (the base is NOT a member). One row per related collection,
 *  each with its visible members (cover + name). Visibility follows the grid: active+approved
 *  for everyone, PLUS the viewer's own-org drafts (My Shop) and everything for a ballpark admin.
 *  The base item itself is never a member, so there's no is_current here. */
async function relatedForItem(idOrBpin, viewerOrgId, isAdmin) {
  const own = (await pool.query(
    `SELECT id FROM public.items WHERE (id::text = $1 OR bpin = $1) AND deleted_at IS NULL LIMIT 1`, [String(idOrBpin)]
  )).rows[0];
  if (!own) return [];
  const r = await pool.query(
    `SELECT t.id AS collection_id, t.name AS collection_name,
            m.id, m.bpin, m.name, (m.images -> 0 ->> 'url') AS cover_url,
            (m.parent_item_id IS NOT NULL) AS is_child
       FROM public.item_related_tags rt
       JOIN public.tags t       ON t.id = rt.tag_id AND t.dimension = 'collection' AND t.deleted_at IS NULL
       JOIN public.item_tags mt ON mt.tag_id = t.id AND mt.deleted_at IS NULL
       JOIN public.items m      ON m.id = mt.item_id AND m.deleted_at IS NULL
            AND m.type IS DISTINCT FROM 'component'
            AND ( (m.status = 'active' AND m.approval_status = 'approved')  -- public scope
                  OR m.org_id = $2                                          -- own-org drafts (My Shop)
                  OR $3 )                                                   -- ballpark admin
      WHERE rt.item_id = $1 AND rt.deleted_at IS NULL
        AND m.id <> $1                                                      -- never the base itself
      -- items before their children, then by name.
      ORDER BY lower(t.name), (m.parent_item_id IS NOT NULL), lower(m.name)`,
    [own.id, viewerOrgId || null, !!isAdmin]
  );
  const byCol = new Map();
  for (const row of r.rows) {
    if (!byCol.has(row.collection_id)) byCol.set(row.collection_id, { id: row.collection_id, name: row.collection_name, items: [] });
    byCol.get(row.collection_id).items.push({
      id: row.id, bpin: row.bpin, name: row.name, coverUrl: row.cover_url, isChild: row.is_child,
    });
  }
  // Only worth a strip when the related collection has at least one visible member.
  return [...byCol.values()].filter((c) => c.items.length >= 1);
}

module.exports = { listForOrg, create, getItemCollections, setItemCollections, getItemRelated, setItemRelated, addItemsToCollections, addItemsToRelated, collectionsForItem, relatedForItem };
