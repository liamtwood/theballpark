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
const { SuppliersQuerySchema } = require('../schemas/marketplace-suppliers.schema');

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
      const parent = req.query.parent === undefined ? null : z.uuid().safeParse(req.query.parent);
      if (parent && !parent.success) return res.status(400).json({ error: 'Invalid parent' });
      if (parent) {
        // Subcategory curation rows (pV2-06-subcats): counts by subcategory_id.
        const r = await pool.query(
          `SELECT c.id, c.name, c.tagline, c.icon_name, c.is_active, c.sort_order,
                  COUNT(i.id) FILTER (WHERE i.deleted_at IS NULL AND i.is_active) AS item_count
             FROM categories c
             LEFT JOIN items i ON i.subcategory_id = c.id
            WHERE c.deleted_at IS NULL AND c.namespace = 'catalogue' AND c.parent_id = $1
            GROUP BY c.id
            ORDER BY c.sort_order ASC NULLS LAST, c.name ASC`,
          [parent.data]
        );
        return res.json(r.rows.map(toCategory));
      }
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
            AND namespace = 'catalogue'
          RETURNING id, parent_id`,
        vals
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Category not found' });
      // Return the fresh row WITH its live count — count axis depends on the
      // level (top-level: items.category_id; subcat: items.subcategory_id).
      const isSub = !!r.rows[0].parent_id;
      const fresh = await pool.query(
        `SELECT c.id, c.name, c.tagline, c.icon_name, c.is_active, c.sort_order,
                COUNT(i.id) FILTER (WHERE i.deleted_at IS NULL AND i.is_active) AS item_count
           FROM categories c
           LEFT JOIN items i ON ${isSub ? 'i.subcategory_id' : 'i.category_id'} = c.id
          WHERE c.id = $1
          GROUP BY c.id`,
        [id.data]
      );
      res.json(toCategory(fresh.rows[0]));
    } catch (err) { next(err); }
  }
);

/** GET /api/marketplace/categories/:id/subcategories — the browse strip
 *  (pV2-06-subcats): ACTIVE subcategories of a top-level category with
 *  live item counts (items point at subcats via subcategory_id). */
router.get('/categories/:id/subcategories', async (req, res, next) => {
  try {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid id' });
    const r = await pool.query(
      `SELECT c.id, c.name, c.tagline, c.icon_name, c.is_active, c.sort_order,
              COUNT(i.id) FILTER (WHERE i.deleted_at IS NULL AND i.is_active
                                    AND i.approval_status = 'approved') AS item_count
         FROM categories c
         LEFT JOIN items i ON i.subcategory_id = c.id
        WHERE c.deleted_at IS NULL AND c.namespace = 'catalogue'
          AND c.parent_id = $1 AND c.is_active
        GROUP BY c.id
        ORDER BY c.sort_order ASC NULLS LAST, c.name ASC`,
      [id.data]
    );
    res.json(r.rows.map(toCategory));
  } catch (err) { next(err); }
});

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
    const { cat, sub, q, offset, priceMin, priceMax, tier, supplier, status, active } = parsed.data;
    const vals = [req.user.org_id]; // $1 — ownership flag, never from the client
    const where = [`i.deleted_at IS NULL`];
    // pV2-STORE-01 — non-public visibility. The `status`/`active` filters are
    // honoured for two callers only: (1) the OWNER of the pinned supplier org
    // — a supplier sees their own draft/pending/inactive items; (2) a BALLPARK
    // ADMIN (admin.cross_org_view) — moderation sees any supplier's items
    // cross-org. Everyone else (incl. an owner browsing another store) gets the
    // public marketplace filter: active + approved only.
    const ownerScope = !!supplier && supplier === req.user.org_id;
    const adminScope = req.user.role === 'ballpark_admin';
    if (ownerScope || adminScope) {
      if (status && status !== 'all') { vals.push(status); where.push(`i.approval_status = $${vals.length}`); }
      if (active === 'active') where.push(`i.is_active`);
      else if (active === 'inactive') where.push(`NOT i.is_active`);
      // active 'all' / unset → both (the supplier sees their whole catalogue)
    } else {
      where.push(`i.is_active`, `i.approval_status = 'approved'`);
    }
    if (cat) { vals.push(cat); where.push(`i.category_id = $${vals.length}`); }
    if (sub) { vals.push(sub); where.push(`i.subcategory_id = $${vals.length}`); }
    if (priceMin !== undefined) { vals.push(priceMin); where.push(`i.base_price >= $${vals.length}`); }
    if (priceMax !== undefined) { vals.push(priceMax); where.push(`i.base_price <= $${vals.length}`); }
    if (tier) { vals.push(tier); where.push(`i.tier = $${vals.length}`); }
    if (supplier) { vals.push(supplier); where.push(`i.org_id = $${vals.length}`); }
    if (q) {
      vals.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
      where.push(`(i.name ILIKE $${vals.length} OR i.description ILIKE $${vals.length})`);
    }
    vals.push(PAGE_SIZE, offset);
    const r = await pool.query(
      `SELECT i.id, i.name, i.description, i.base_price, i.unit, i.image_url,
              i.category_id, i.subcategory_id, i.approval_status, i.is_active,
              i.org_id AS supplier_id, o.name AS supplier_name, o.city AS supplier_city,
              c.name AS category_name, sc.name AS subcategory_name,
              (i.org_id = $1) AS owned_by_active_org,
              COUNT(*) OVER() AS total
         FROM items i
         JOIN orgs o ON o.id = i.org_id AND o.deleted_at IS NULL
         LEFT JOIN categories c ON c.id = i.category_id
         LEFT JOIN categories sc ON sc.id = i.subcategory_id
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
      supplierCity: row.supplier_city,
      categoryName: row.category_name,
      subcategoryName: row.subcategory_name,
      ownedByActiveOrg: !!row.owned_by_active_org,
      approvalStatus: row.approval_status,
      isActive: !!row.is_active,
    }));
    res.json({ items, total, hasMore: offset + items.length < total });
  } catch (err) { next(err); }
});

/** GET /api/marketplace/suppliers/options — lightweight supplier list for
 *  the filter dropdown (id, name, active-item count). The full suppliers
 *  browse (cards + envelope) lands in pV2-06d. */
router.get('/suppliers/options', async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT o.id, o.name, COUNT(i.id) AS item_count
         FROM orgs o
         JOIN items i ON i.org_id = o.id
        WHERE o.deleted_at IS NULL
          AND i.deleted_at IS NULL AND i.is_active AND i.approval_status = 'approved'
        GROUP BY o.id
        ORDER BY o.name ASC`
    );
    res.json(r.rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.item_count) })));
  } catch (err) { next(err); }
});

// ── Suppliers (pV2-06d) ─────────────────────────────────────────────────────

/** GET /api/marketplace/suppliers?cat&q&offset — the suppliers browse.
 *  Same paginated envelope as items. A supplier = an org of type
 *  'supplier' with at least one active approved item; `cat` narrows to
 *  suppliers serving that category (EXISTS, not join-fanout). */
router.get('/suppliers', async (req, res, next) => {
  try {
    const parsed = SuppliersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid query',
        details: z.flattenError(parsed.error).fieldErrors,
      });
    }
    const { cat, q, offset } = parsed.data;
    const vals = [];
    const where = [`o.deleted_at IS NULL`, `o.type = 'supplier'`];
    if (q) {
      vals.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
      where.push(`(o.name ILIKE $${vals.length} OR o.description ILIKE $${vals.length})`);
    }
    if (cat) { vals.push(cat); }
    const catClause = cat ? `AND i.category_id = $${vals.length}` : '';
    vals.push(PAGE_SIZE, offset);
    const r = await pool.query(
      `SELECT o.id, o.name, o.city, o.description, o.logo_url, o.cover_image_url,
              COUNT(i.id) AS item_count,
              COUNT(*) OVER() AS total
         FROM orgs o
         JOIN items i ON i.org_id = o.id AND i.deleted_at IS NULL
              AND i.is_active AND i.approval_status = 'approved' ${catClause}
        WHERE ${where.join(' AND ')}
        GROUP BY o.id
        ORDER BY o.name ASC
        LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
      vals
    );
    const total = r.rows.length ? Number(r.rows[0].total) : 0;
    const items = r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      description: row.description,
      logoUrl: row.logo_url,
      coverUrl: row.cover_image_url,
      count: Number(row.item_count),
    }));
    res.json({ items, total, hasMore: offset + items.length < total });
  } catch (err) { next(err); }
});

/** GET /api/marketplace/suppliers/:id — the storefront projection:
 *  identity + contact + per-category item counts. Items come from
 *  /items?supplier= (one list path). NOTE: financial columns are NEVER
 *  projected here — marketplace-public fields only. */
router.get('/suppliers/:id', async (req, res, next) => {
  try {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid id' });
    const r = await pool.query(
      `SELECT id, name, city, country, address, phone, email, website,
              description, logo_url, cover_image_url, images
         FROM orgs
        WHERE id = $1 AND type = 'supplier' AND deleted_at IS NULL`,
      [id.data]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Supplier not found' });
    const cats = await pool.query(
      `SELECT c.id, c.name, COUNT(i.id) AS item_count
         FROM items i
         JOIN categories c ON c.id = i.category_id
        WHERE i.org_id = $1 AND i.deleted_at IS NULL
          AND i.is_active AND i.approval_status = 'approved'
        GROUP BY c.id
        ORDER BY c.name ASC`,
      [id.data]
    );
    const row = r.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      city: row.city,
      country: row.country,
      address: row.address,
      phone: row.phone,
      email: row.email,
      website: row.website,
      description: row.description,
      logoUrl: row.logo_url,
      coverUrl: row.cover_image_url,
      // orgs.images is NOT NULL DEFAULT '[]' — pg parses jsonb to a JS array.
      images: row.images ?? [],
      categories: cats.rows.map((c) => ({ id: c.id, name: c.name, count: Number(c.item_count) })),
    });
  } catch (err) { next(err); }
});

/** GET /api/marketplace/suppliers/:id/subcategories — the storefront's
 *  subcat-card grid (pV2-CARDS-01 QC #5, CARDS.md image 7): one row per
 *  subcategory the supplier has live items in, with the first item's
 *  image as the card cover. parentId lets the client drill the Store
 *  tab to cat+sub in one navigation.
 *  PERF (audit cards-F-3): the first-image lookups are correlated
 *  subqueries — O(rows) against items, fine at the typical 10–50
 *  subcats per supplier. If a supplier ever carries 100+, precompute a
 *  cover column on categories instead of widening this query. */
router.get('/suppliers/:id/subcategories', async (req, res, next) => {
  try {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid id' });
    // Two row kinds, one shape: real subcats + a CATCH-ALL row per category
    // for the supplier's items that have a category but no subcat (the
    // screenshot's "Catering / 3 items" card). Catch-all drills cat-only.
    const r = await pool.query(
      `SELECT sc.id, sc.name, sc.parent_id, false AS is_catch_all,
              COUNT(i.id) AS item_count,
              (SELECT i2.image_url FROM items i2
                WHERE i2.org_id = $1 AND i2.subcategory_id = sc.id
                  AND i2.deleted_at IS NULL AND i2.is_active
                  AND i2.approval_status = 'approved' AND i2.image_url IS NOT NULL
                ORDER BY i2.name ASC LIMIT 1) AS cover_url
         FROM items i
         JOIN categories sc ON sc.id = i.subcategory_id
        WHERE i.org_id = $1 AND i.deleted_at IS NULL
          AND i.is_active AND i.approval_status = 'approved'
        GROUP BY sc.id, sc.name, sc.parent_id
       UNION ALL
       SELECT c.id, c.name, c.id AS parent_id, true AS is_catch_all,
              COUNT(i.id) AS item_count,
              (SELECT i2.image_url FROM items i2
                WHERE i2.org_id = $1 AND i2.category_id = c.id
                  AND i2.subcategory_id IS NULL
                  AND i2.deleted_at IS NULL AND i2.is_active
                  AND i2.approval_status = 'approved' AND i2.image_url IS NOT NULL
                ORDER BY i2.name ASC LIMIT 1) AS cover_url
         FROM items i
         JOIN categories c ON c.id = i.category_id
        WHERE i.org_id = $1 AND i.subcategory_id IS NULL
          AND i.deleted_at IS NULL AND i.is_active AND i.approval_status = 'approved'
        GROUP BY c.id, c.name
        ORDER BY name ASC`,
      [id.data]
    );
    res.json(
      r.rows.map((row) => ({
        id: row.id,
        name: row.name,
        parentId: row.parent_id,
        isCatchAll: row.is_catch_all,
        count: Number(row.item_count),
        coverUrl: row.cover_url,
      }))
    );
  } catch (err) { next(err); }
});

// Favourites (pV2-06d) extracted to routes/marketplace-favourites.js
// (cards-audit F-8 — keep this file under the 300-line route alarm).

module.exports = router;
