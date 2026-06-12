// pV2-MARKET-00 — the v2 marketplace surface. Mounted on the GATED v2
// router (`v2.use('/marketplace', …)`): every endpoint inherits
// authenticate + requireActiveMembership (any active member browses; the
// catalogue is platform-wide data, never org-scoped reads).
//
//   GET   /api/marketplace/categories        → ACTIVE top-level catalogue
//                                              categories + item counts
//                                              (the marketplace rail)
//   GET   /api/marketplace/categories/all    → every top-level category
//                                              incl. inactive (curation
//                                              table; platform admins)
//   PATCH /api/marketplace/categories/:id    → curation update (platform
//                                              admins; Zod partial)
//
// Items/suppliers list endpoints land in pV2-06a with the paginated
// { items, total, hasMore } envelope (see pV2-06-angular-architecture.md).

const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const { requireActiveMembership } = require('../middleware/require-active-membership');
const { CategoryUpdateSchema } = require('../schemas/category-admin.schema');
const { ItemsQuerySchema, PAGE_SIZE } = require('../schemas/marketplace-query.schema');

/** Top-level catalogue categories + live item counts. Counts roll up from
 *  active, non-deleted items (items point at TOP-LEVEL categories via
 *  category_id; subcategory_id is a separate axis). */
const SELECT_CATEGORIES = `
  SELECT c.id, c.name, c.tagline, c.icon_name, c.is_active, c.sort_order,
         COUNT(i.id) FILTER (WHERE i.deleted_at IS NULL AND i.is_active) AS item_count
    FROM categories c
    LEFT JOIN items i ON i.category_id = c.id
   WHERE c.deleted_at IS NULL
     AND c.parent_id IS NULL
     AND c.namespace = 'catalogue'
     %ACTIVE%
   GROUP BY c.id
   ORDER BY c.sort_order ASC NULLS LAST, c.name ASC`;

function toCategory(row) {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    iconName: row.icon_name,
    isActive: !!row.is_active,
    sortOrder: row.sort_order === null ? null : Number(row.sort_order),
    count: Number(row.item_count ?? 0),
  };
}

// GET /api/marketplace/categories — the browse rail (active only).
router.get('/categories', async (req, res, next) => {
  try {
    const r = await pool.query(SELECT_CATEGORIES.replace('%ACTIVE%', 'AND c.is_active'));
    res.json(r.rows.map(toCategory));
  } catch (err) { next(err); }
});

// GET /api/marketplace/categories/all — curation list (incl. inactive).
// Platform admins only: same admin.cross_org_view gate as page settings —
// categories are org_type-agnostic platform data.
router.get(
  '/categories/all',
  requireActiveMembership('admin.cross_org_view'),
  async (req, res, next) => {
    try {
      const r = await pool.query(SELECT_CATEGORIES.replace('%ACTIVE%', ''));
      res.json(r.rows.map(toCategory));
    } catch (err) { next(err); }
  }
);

// PATCH /api/marketplace/categories/:id — curation update. Single dynamic
// UPDATE over the whitelisted columns; 404 covers both absent and
// non-top-level/non-catalogue ids (no information disclosure).
router.patch(
  '/categories/:id',
  requireActiveMembership('admin.cross_org_view'),
  async (req, res, next) => {
    try {
      const id = z.uuid().safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ error: 'Invalid id' });
      const parsed = CategoryUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid input',
          details: z.flattenError(parsed.error).fieldErrors,
        });
      }
      const p = parsed.data;
      const map = {
        name: p.name,
        tagline: p.tagline,
        is_active: p.isActive,
        sort_order: p.sortOrder,
      };
      const sets = [];
      const vals = [];
      for (const [col, val] of Object.entries(map)) {
        if (val !== undefined) {
          vals.push(val);
          sets.push(`${col} = $${vals.length}`);
        }
      }
      vals.push(id.data);
      const r = await pool.query(
        `UPDATE categories SET ${sets.join(', ')}, updated_at = NOW()
          WHERE id = $${vals.length} AND deleted_at IS NULL
            AND parent_id IS NULL AND namespace = 'catalogue'
          RETURNING id`,
        vals
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Category not found' });
      // Return the fresh row WITH its live count (the table re-renders it).
      const fresh = await pool.query(
        SELECT_CATEGORIES.replace('%ACTIVE%', 'AND c.id = $1'),
        [id.data]
      );
      res.json(toCategory(fresh.rows[0]));
    } catch (err) { next(err); }
  }
);

// ── Items (pV2-06a) ─────────────────────────────────────────────────────────

/** GET /api/marketplace/items?cat&sub&q&offset — the browse grid. Born
 *  paginated ({ items, total, hasMore } envelope, PAGE_SIZE 48); marketplace
 *  shows ACTIVE + APPROVED items only (the v1 "144"). ownedByActiveOrg is
 *  server-derived from req.user.org_id (MARKETPLACE.md ownership model) —
 *  the client never compares org ids. Zod-validated params; every value
 *  reaches SQL as a bound parameter. */
router.get('/items', async (req, res, next) => {
  try {
    const parsed = ItemsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid query',
        details: z.flattenError(parsed.error).fieldErrors,
      });
    }
    const { cat, sub, q, offset } = parsed.data;
    const where = [`i.deleted_at IS NULL`, `i.is_active`, `i.approval_status = 'approved'`];
    const vals = [req.user.org_id]; // $1 — ownership flag, never from the client
    if (cat) { vals.push(cat); where.push(`i.category_id = $${vals.length}`); }
    if (sub) { vals.push(sub); where.push(`i.subcategory_id = $${vals.length}`); }
    if (q) {
      vals.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
      where.push(`(i.name ILIKE $${vals.length} OR i.description ILIKE $${vals.length})`);
    }
    vals.push(PAGE_SIZE, offset);
    const r = await pool.query(
      `SELECT i.id, i.name, i.description, i.base_price, i.unit, i.image_url,
              i.category_id, i.subcategory_id,
              i.org_id AS supplier_id, o.name AS supplier_name,
              (i.org_id = $1) AS owned_by_active_org,
              COUNT(*) OVER() AS total
         FROM items i
         JOIN orgs o ON o.id = i.org_id AND o.deleted_at IS NULL
        WHERE ${where.join(' AND ')}
        ORDER BY i.name ASC
        LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
      vals
    );
    const total = r.rows.length ? Number(r.rows[0].total) : 0;
    const items = r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      basePrice: row.base_price === null ? null : Number(row.base_price),
      unit: row.unit,
      coverUrl: row.image_url,
      categoryId: row.category_id,
      subcategoryId: row.subcategory_id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      ownedByActiveOrg: !!row.owned_by_active_org,
    }));
    res.json({ items, total, hasMore: offset + items.length < total });
  } catch (err) { next(err); }
});

module.exports = router;
