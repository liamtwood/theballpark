/**
 * TaxonomyService — the catalogue taxonomy TREE READER.
 *
 * After the BE-00112 decomposition this module is purely read-side: it loads
 * the category tree + dimension-scoped tags and exposes the small vocabulary
 * primitives the rest of the system builds on. The AI concerns that used to
 * live here were split out (Layer 1):
 *   - classification.service.js — classifyItem / apply / dismiss / tags / backfill
 *   - matching.service.js       — brief → item matcher
 *   - quote-request.service.js  — RFQ outreach
 *   - project-match.service.js  — Brief-tab match persistence
 * classification.service imports loadTaxonomy / loadChildren / norm from here
 * (the #2 → #1 dependency).
 *
 *   loadTaxonomy()            — the whole tree + tags in one pass.
 *   loadChildren(categoryId)  — a parent's direct children (label + id).
 *   getDimensions(categoryId) — tag dimensions + values for the edit panel / filter.
 *   categorySuppliers(id?)    — suppliers with active items in a category.
 *   eventTypes()              — event-type values with their tag ids (All-view filter).
 *   norm(s)                   — tolerant label comparison (case + whitespace).
 */
const pool = require('../db/pool');

function httpErr(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/** Normalise a label for tolerant comparison (case + whitespace). */
function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Load the children of a parent category (label + id) in sort_order. */
async function loadChildren(categoryId) {
  const r = await pool.query(
    `SELECT id, name
       FROM categories
      WHERE parent_id = $1
      ORDER BY sort_order ASC, name ASC`,
    [categoryId]
  );
  return r.rows;
}

/** Load the entire catalogue taxonomy in one pass:
      parents             — [{ id, name }] in sort order
      childrenByParentId  — Map(parentId → [{ id, name }])
      tagsByCategoryId    — Map(categoryId → [{ id, dimension, label }])  */
async function loadTaxonomy() {
  const cats = await pool.query(
    // Active only — the classifier must never suggest a deprecated/inactive
    // category (e.g. the retired "Chairs" mid-level that sits inactive beside
    // the active "Seating"). Inactive rows in the vocabulary made the AI pick
    // "Chairs" over "Seating".
    // REBUILD: categories are catalogue-only (no `namespace`); the rebuild table
    // has no `is_active` either — a live category is just deleted_at IS NULL.
    `SELECT id, name, parent_id
       FROM categories
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, name ASC`
  );
  const parents = cats.rows.filter(c => !c.parent_id);
  const childrenByParentId = new Map();
  for (const c of cats.rows) {
    if (!c.parent_id) continue;
    if (!childrenByParentId.has(c.parent_id)) childrenByParentId.set(c.parent_id, []);
    childrenByParentId.get(c.parent_id).push({ id: c.id, name: c.name });
  }
  const tags = await pool.query(
    `SELECT id, category_id, dimension, label, sort_order
       FROM tag
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC`
  );
  const tagsByCategoryId = new Map();
  for (const t of tags.rows) {
    if (!tagsByCategoryId.has(t.category_id)) tagsByCategoryId.set(t.category_id, []);
    tagsByCategoryId.get(t.category_id).push({
      id: t.id, dimension: t.dimension, label: t.label
    });
  }
  return { parents, childrenByParentId, tagsByCategoryId };
}

/** Tag dimensions + values for one parent category. Powers the
    "Edit classification" panel (and, later, the marketplace filter). */
async function getDimensions(categoryId) {
  if (!categoryId) throw httpErr('categoryId is required', 400);
  const r = await pool.query(
    `SELECT id, dimension, label, sort_order
       FROM tag
      WHERE category_id = $1
      ORDER BY dimension ASC, sort_order ASC`,
    [categoryId]
  );
  const map = new Map();
  for (const t of r.rows) {
    if (!map.has(t.dimension)) map.set(t.dimension, []);
    map.get(t.dimension).push({ tag_id: t.id, label: t.label });
  }
  return [...map.entries()].map(([dimension, values]) => ({ dimension, values }));
}

/**
 * Suppliers with at least one active item in a category — derived live
 * from the catalogue. Powers the category card's Suppliers section.
 * Returns [{ supplier_id, supplier_name, description, city, item_count }]
 * ordered by item_count desc.
 */
async function categorySuppliers(categoryId) {
  const params = [];
  // BE-00148 — rebuild-correct the published filter: items.is_active was dropped
  // in 0015; a live catalogue item is status='active' AND approval_status=
  // 'approved' AND deleted_at IS NULL (matches matching.service `published`).
  let filter = `i.status = 'active' AND i.approval_status = 'approved' AND i.deleted_at IS NULL`;
  if (categoryId) {
    params.push(categoryId);
    filter += ` AND (i.category_id = $1 OR i.category_id IN (SELECT id FROM categories WHERE parent_id = $1))`;
  }
  // BE-00148 — cross-org supplier read MUST go through supplier_directory (owner-run,
  // bypasses orgs RLS, scoped to active suppliers), NOT orgs_public (security_invoker
  // = own-org, which zeroes every cross-org row under the RLS flip). Same bite as
  // BE-00147 (matchItems) and the marketplace x3.
  const r = await pool.query(
    `SELECT o.id AS supplier_id, o.name AS supplier_name,
            o.description, o.city, COUNT(i.id)::int AS item_count
       FROM items i
       JOIN supplier_directory o ON o.id = i.org_id
      WHERE ${filter}
      GROUP BY o.id, o.name, o.description, o.city
      ORDER BY item_count DESC, o.name ASC`,
    params
  );
  return r.rows;
}

/**
 * Event-type values, each with every tag id that carries it. The
 * event-type dimension is duplicated per category, so the "All"
 * marketplace view needs all ids behind a value to filter across
 * categories. Returns [{ label, tag_ids: [...] }].
 */
async function eventTypes() {
  const r = await pool.query(
    `SELECT label, ARRAY_AGG(id) AS tag_ids
       FROM tag
      WHERE dimension = 'event-type'
      GROUP BY label
      ORDER BY MIN(sort_order)`
  );
  return r.rows;
}

module.exports = {
  loadTaxonomy,
  loadChildren,
  norm,
  getDimensions,
  categorySuppliers,
  eventTypes
};
