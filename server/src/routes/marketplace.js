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

module.exports = router;
