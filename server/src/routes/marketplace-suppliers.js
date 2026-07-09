// pV2-06d — the marketplace SUPPLIERS endpoints, extracted from marketplace.js
// (STORE-01 architect audit F-2 — keep marketplace.js under the 300-line route
// alarm). Mounted on the gated v2 router at /marketplace (BEFORE the main
// marketplace router), so these inherit authenticate + requireActiveMembership.
// Public marketplace fields only — financial columns are NEVER projected here.
//
//   GET /api/marketplace/suppliers/options          → filter-dropdown list
//   GET /api/marketplace/suppliers?cat&q&offset     → suppliers browse (envelope)
//   GET /api/marketplace/suppliers/:id              → storefront projection
//   GET /api/marketplace/suppliers/:id/subcategories → storefront subcat cards

const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const { PAGE_SIZE } = require('../schemas/marketplace-query.schema');
const { SuppliersQuerySchema } = require('../schemas/marketplace-suppliers.schema');

/** GET /api/marketplace/suppliers/options — lightweight supplier list for
 *  the filter dropdown (id, name, active-item count). */
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

module.exports = router;
