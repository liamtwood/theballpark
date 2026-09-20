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

/** pV2-STORE-CAT-DISPLAY-01 — the item-visibility scope for a store's counts,
 *  mirroring GET /api/marketplace/items: the OWNER of the store (and a ballpark
 *  admin) sees their whole catalogue (draft/pending/inactive), so their counts
 *  must too; everyone else sees live + approved only. Returns a SQL fragment
 *  (no user input — orgId is the validated URL param, alias is a literal), or ''
 *  for owner/admin. Keeps rail counts == the /items grid for the same scope. */
function ownerVisibleFilter(req, orgId, alias = 'i') {
  const isOwner = req.user?.org_id === orgId;
  const isAdmin = req.user?.role === 'ballpark_admin';
  return (isOwner || isAdmin)
    ? ''
    : `AND ${alias}.is_active AND ${alias}.approval_status = 'approved'`;
}

/** GET /api/marketplace/suppliers/options — lightweight supplier list for
 *  the filter dropdown (id, name, active-item count). */
router.get('/suppliers/options', async (req, res, next) => {
  try {
    const r = await pool.query(
      // BE-00115 — cross-org supplier read: use the orgs_public VIEW (bypasses
      // orgs_self RLS, which would hide every other supplier's row and empty the
      // marketplace). The view already filters supplier + active + not-deleted.
      `SELECT o.id, o.name, COUNT(i.id) AS item_count
         FROM orgs_public o
         JOIN items i ON i.org_id = o.id
        WHERE i.deleted_at IS NULL AND i.is_active AND i.approval_status = 'approved'
        -- BE-00129 — orgs_public is a VIEW (no PK), so Postgres can't infer the
        -- o.id → o.name functional dependency; every selected non-aggregate must
        -- be grouped (a base-table GROUP BY o.id would have sufficed).
        GROUP BY o.id, o.name
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
    // BE-00115 — cross-org: read suppliers from the orgs_public VIEW (it already
    // enforces supplier + active + not-deleted; base orgs is RLS-hidden cross-org).
    const where = [];
    if (q) {
      vals.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
      where.push(`(o.name ILIKE $${vals.length} OR o.description ILIKE $${vals.length})`);
    }
    if (cat) { vals.push(cat); }
    const catClause = cat ? `AND i.category_id = $${vals.length}` : '';
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    vals.push(PAGE_SIZE, offset);
    const r = await pool.query(
      `SELECT o.id, o.name, o.city, o.description, o.logo_url, o.cover_image_url,
              COUNT(i.id) AS item_count,
              COUNT(*) OVER() AS total
         FROM orgs_public o
         JOIN items i ON i.org_id = o.id AND i.deleted_at IS NULL
              AND i.is_active AND i.approval_status = 'approved' ${catClause}
        ${whereSql}
        -- BE-00129 — group every selected orgs_public column (it's a VIEW, no PK
        -- functional dependency; see /suppliers/options above).
        GROUP BY o.id, o.name, o.city, o.description, o.logo_url, o.cover_image_url
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
    // BE-00115 — cross-org shopfront read via the orgs_public VIEW (RLS hides the
    // base orgs row cross-org). The view exposes only safe columns — supplier
    // contact PII (address/phone/email/website) is deliberately NOT public
    // (contact runs through the platform inbox); those are nulled below so the
    // response shape is unchanged for any client that reads the keys.
    const r = await pool.query(
      `SELECT id, name, city, country, description, logo_url, cover_image_url, images
         FROM orgs_public
        WHERE id = $1`,
      [id.data]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Supplier not found' });
    // pV2-STORE-CAT-DISPLAY-01 — counts must match the /items list SCOPE, or the
    // rail and the grid disagree. The owner of the store (and a ballpark admin)
    // sees their whole catalogue in the list (draft/pending/inactive), so their
    // counts must include those too; the public sees live+approved only. Also
    // note: no c.is_active/deleted_at gate on the category — display follows the
    // items (a category with ≥1 in-scope item shows, whatever its status).
    const liveFilter = ownerVisibleFilter(req, id.data, 'i');
    const cats = await pool.query(
      `SELECT c.id, c.name, COUNT(i.id) AS item_count
         FROM items i
         JOIN categories c ON c.id = i.category_id
        WHERE i.org_id = $1 AND i.deleted_at IS NULL ${liveFilter}
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
      // Not public on the shopfront (BE-00115) — kept in the shape as null.
      address: null,
      phone: null,
      email: null,
      website: null,
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
    // pV2-STORE-CAT-DISPLAY-01 — same owner/admin-aware scope as the /items list
    // so the rail counts equal what the grid shows. Real subcats via JOIN on
    // subcategory_id (status-agnostic on the category — a subcat shows iff it has
    // ≥1 in-scope item), plus a catch-all row per category rolling up the
    // uncategorised (subcategory_id IS NULL) items to their macro.
    const liveOuter = ownerVisibleFilter(req, id.data, 'i');
    const liveCover = ownerVisibleFilter(req, id.data, 'i2');
    const r = await pool.query(
      `SELECT sc.id, sc.name, sc.parent_id, false AS is_catch_all,
              COUNT(i.id) AS item_count,
              (SELECT i2.image_url FROM items i2
                WHERE i2.org_id = $1 AND i2.subcategory_id = sc.id
                  AND i2.deleted_at IS NULL ${liveCover} AND i2.image_url IS NOT NULL
                ORDER BY i2.name ASC LIMIT 1) AS cover_url
         FROM items i
         JOIN categories sc ON sc.id = i.subcategory_id
        WHERE i.org_id = $1 AND i.deleted_at IS NULL ${liveOuter}
        GROUP BY sc.id, sc.name, sc.parent_id
       UNION ALL
       SELECT c.id, c.name, c.id AS parent_id, true AS is_catch_all,
              COUNT(i.id) AS item_count,
              (SELECT i2.image_url FROM items i2
                WHERE i2.org_id = $1 AND i2.category_id = c.id
                  AND i2.subcategory_id IS NULL
                  AND i2.deleted_at IS NULL ${liveCover} AND i2.image_url IS NOT NULL
                ORDER BY i2.name ASC LIMIT 1) AS cover_url
         FROM items i
         JOIN categories c ON c.id = i.category_id
        WHERE i.org_id = $1 AND i.subcategory_id IS NULL
          AND i.deleted_at IS NULL ${liveOuter}
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
