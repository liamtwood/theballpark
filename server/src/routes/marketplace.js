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
const { withTransaction } = require('../db/with-transaction');
const { requireActiveMembership } = require('../middleware/require-active-membership');
const { CategoryUpdateSchema, CategoryCreateSchema } = require('../schemas/category-admin.schema');
const { ItemsQuerySchema, PAGE_SIZE } = require('../schemas/marketplace-query.schema');

/** Hero image URL from the images[] jsonb (the legacy image_url column was dropped
 *  in 0015). First is_hero, else images[0]; null when empty. */
function heroUrl(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const pick = images.find((i) => i && i.is_hero) || images[0];
  return pick && pick.url ? pick.url : null;
}

/** All image URLs in DISPLAY order (cover/hero first, then the rest), deduped —
 *  feeds the Quick View carousel so it can page the whole gallery, not just the
 *  cover. Empty array when there are none. */
function imageUrls(images) {
  if (!Array.isArray(images)) return [];
  const hero = images.find((i) => i && i.is_hero);
  const ordered = hero ? [hero, ...images.filter((i) => i !== hero)] : images;
  return [...new Set(ordered.map((i) => i && i.url).filter(Boolean))];
}

/** Top-level catalogue categories + live item counts. Counts must match what
 *  the browse grid actually lists (active + APPROVED, top-level items only —
 *  no components/children), and must equal the sum of the subcategory counts
 *  (which already filter approved). Otherwise the pill over-counts (e.g. 9 vs
 *  the 5 shown). Items point at TOP-LEVEL categories via category_id;
 *  subcategory_id is a separate axis. */
// v2dev (rebuild): streamlined categories — `status` (not is_active), no
// `namespace` (catalogue is the only tree here; feedback has its own table).
// Item counts are 0 until the items slice lands (no `items` table yet).
const SELECT_CATEGORIES = `
  SELECT c.id, c.name, c.tagline, c.icon_name, (c.status = 'active') AS is_active, c.sort_order,
         0 AS item_count
    FROM categories c
   WHERE c.deleted_at IS NULL
     AND c.parent_id IS NULL
     %ACTIVE%
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
    const r = await pool.query(SELECT_CATEGORIES.replace('%ACTIVE%', "AND c.status = 'active'"));
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
          `SELECT c.id, c.name, c.tagline, c.icon_name, (c.status = 'active') AS is_active, c.sort_order,
                  0 AS item_count
             FROM categories c
            WHERE c.deleted_at IS NULL AND c.parent_id = $1
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

// POST /api/marketplace/categories — create a taxonomy node (category / subcategory
// / sub-subcategory). parentId null → top-level; else a child of that node. `level`
// is derived from the parent chain (ancestor count) so the column stays meaningful.
// Admin-gated (taxonomy management, not curation).
router.post(
  '/categories',
  requireActiveMembership('admin.cross_org_view'),
  async (req, res, next) => {
    try {
      const parsed = CategoryCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
      }
      const { name, parentId, tagline, isActive, sortOrder } = parsed.data;
      let level = 0;
      if (parentId) {
        // Depth of the parent chain = the new node's ancestor count = its level.
        const anc = await pool.query(
          `WITH RECURSIVE anc AS (
             SELECT id, parent_id, 1 AS depth FROM categories
              WHERE id = $1 AND deleted_at IS NULL
             UNION ALL
             SELECT c.id, c.parent_id, anc.depth + 1 FROM categories c JOIN anc ON c.id = anc.parent_id
           ) SELECT MAX(depth) AS d FROM anc`,
          [parentId]
        );
        if (!anc.rows[0]?.d) return res.status(400).json({ error: 'Parent category not found' });
        level = Number(anc.rows[0].d);
        // 3 levels max (0/1/2) — a sub-subcategory can't have children.
        if (level > 2) return res.status(409).json({ error: 'too_deep', message: 'Only 3 levels are supported (Category ▸ Subcategory ▸ Sub-subcategory).' });
      }
      // v2dev: streamlined shape — org_id = Ballpark root (shared taxonomy),
      // status enum (not is_active/enabled), level derived (not stored),
      // created_by stamped from the request GUC. `level` above only enforces the
      // 3-level cap.
      const ins = await pool.query(
        `INSERT INTO categories (name, parent_id, org_id, status, sort_order, created_by, updated_by)
           VALUES ($1, $2, '00000000-0000-0000-0000-000000000001', $3, $4,
                   app_current_user_id(), app_current_user_id())
         RETURNING id, name, tagline, icon_name, (status = 'active') AS is_active, sort_order, parent_id`,
        [name, parentId || null, (isActive ?? true) ? 'active' : 'retired', sortOrder ?? 999]
      );
      res.status(201).json(toCategory({ ...ins.rows[0], item_count: 0 }));
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
        // v2dev: is_active toggle maps onto the status enum.
        status: p.isActive === undefined ? undefined : (p.isActive ? 'active' : 'retired'),
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
          RETURNING id, parent_id`,
        vals
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Category not found' });
      // Fresh row; item counts are 0 until the items slice lands.
      const fresh = await pool.query(
        `SELECT c.id, c.name, c.tagline, c.icon_name, (c.status = 'active') AS is_active, c.sort_order,
                0 AS item_count
           FROM categories c WHERE c.id = $1`,
        [id.data]
      );
      res.json(toCategory(fresh.rows[0]));
    } catch (err) { next(err); }
  }
);

// DELETE /api/marketplace/categories/:id[?cascade=true] — soft-delete a taxonomy node.
// SUBTREE-AWARE: a node with children or items is refused (409 not_empty + the real
// subtree counts, incl. pending items) unless cascade=true, which then soft-deletes the
// whole subtree AND the items in it. Never silently orphans (the "0 approved / N pending"
// trap). Admin-gated.
router.delete(
  '/categories/:id',
  requireActiveMembership('admin.cross_org_view'),
  async (req, res, next) => {
    try {
      const id = z.uuid().safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ error: 'Invalid id' });
      const cascade = String(req.query.cascade) === 'true';
      const sub = await pool.query(
        `WITH RECURSIVE t AS (
           SELECT id FROM categories WHERE id=$1 AND deleted_at IS NULL
           UNION ALL
           SELECT c.id FROM categories c JOIN t ON c.parent_id=t.id WHERE c.deleted_at IS NULL
         ) SELECT id FROM t`,
        [id.data]
      );
      if (!sub.rows.length) return res.status(404).json({ error: 'Category not found' });
      const ids = sub.rows.map((r) => r.id);
      const subcats = ids.length - 1;
      // v2dev: no `items` table yet (items slice) — item count is 0 for now.
      const items = 0;
      if (subcats > 0 && !cascade) {
        return res.status(409).json({ error: 'not_empty', subcats, items });
      }
      await withTransaction(async (client) => {
        await client.query(`UPDATE categories SET deleted_at=NOW() WHERE id = ANY($1::uuid[])`, [ids]);
      });
      res.json({ deleted: true, subcats, items });
    } catch (err) { next(err); }
  }
);

// PATCH /api/marketplace/categories/:id/move { parentId } — reparent a node (parentId
// null → top-level). Re-levels the node + its whole subtree, guards the 3-level depth
// (deepest descendant must stay ≤ level 2), and — when the top-level ancestor changes —
// repoints affected items' category_id so the descendant trigger stays valid. Admin-gated.
router.patch(
  '/categories/:id/move',
  requireActiveMembership('admin.cross_org_view'),
  async (req, res, next) => {
    try {
      const id = z.uuid().safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ error: 'Invalid id' });
      const parentId = req.body?.parentId ?? null;
      if (parentId !== null && !z.uuid().safeParse(parentId).success) return res.status(400).json({ error: 'Invalid parentId' });
      if (parentId === id.data) return res.status(400).json({ error: 'Cannot move a node onto itself' });

      const nodeR = await pool.query(`SELECT id FROM categories WHERE id=$1 AND deleted_at IS NULL`, [id.data]);
      if (!nodeR.rows.length) return res.status(404).json({ error: 'Category not found' });

      // v2dev: no stored `level` — derive. Subtree of the moved node + its deepest
      // RELATIVE depth (0 = the node alone).
      const subR = await pool.query(
        `WITH RECURSIVE t AS (
           SELECT id, 0 AS d FROM categories WHERE id=$1 AND deleted_at IS NULL
           UNION ALL SELECT c.id, t.d+1 FROM categories c JOIN t ON c.parent_id=t.id WHERE c.deleted_at IS NULL
         ) SELECT id, d FROM t`, [id.data]);
      const subIds = subR.rows.map((r) => r.id);
      const subDepth = Math.max(...subR.rows.map((r) => Number(r.d)));
      if (parentId && subIds.includes(parentId)) return res.status(400).json({ error: 'Cannot move a node under its own descendant' });

      let newBase = 0, newTop = id.data; // top-level default
      if (parentId) {
        // Parent's absolute depth (ancestor count) + its top-level ancestor, walked UP.
        const up = await pool.query(
          `WITH RECURSIVE up AS (
             SELECT id, parent_id, 0 AS d FROM categories WHERE id=$1 AND deleted_at IS NULL
             UNION ALL SELECT c.id, c.parent_id, up.d+1 FROM categories c JOIN up ON c.id=up.parent_id
           ) SELECT (SELECT MAX(d) FROM up) AS depth, (SELECT id FROM up WHERE parent_id IS NULL LIMIT 1) AS top`,
          [parentId]);
        if (up.rows[0].depth === null) return res.status(400).json({ error: 'Parent not found' });
        newBase = Number(up.rows[0].depth) + 1;
        newTop = up.rows[0].top || parentId;
      }
      // 3 levels max: top(0) ▸ sub(1) ▸ sub-sub(2) — deepest descendant must stay ≤ 2.
      if (newBase + subDepth > 2) {
        return res.status(409).json({ error: 'too_deep', message: 'Move would exceed 3 levels — move it higher, or move a shallower branch.' });
      }
      await withTransaction(async (client) => {
        await client.query(`UPDATE categories SET parent_id=$2, updated_at=NOW() WHERE id=$1`, [id.data, parentId]);
        // No item repoint needed: items carry ONE category_id at any depth, so a
        // moved node keeps its items — their category_id still points at it (0015).
      });
      void newTop; void subIds;
      res.json({ moved: true, level: newBase });
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
    // Count is tree-aware: a subcategory's count includes items classified to any
    // of its descendants (so the rail count matches the tree-aware browse grid).
    // v2dev: streamlined shape — status (not is_active), no namespace; item
    // counts are 0 until the items slice lands (tree-aware count returns with it).
    const r = await pool.query(
      `SELECT c.id, c.name, c.tagline, c.icon_name, (c.status = 'active') AS is_active, c.sort_order,
              0 AS item_count
         FROM categories c
        WHERE c.deleted_at IS NULL AND c.parent_id = $1 AND c.status = 'active'
        ORDER BY c.sort_order ASC NULLS LAST, c.name ASC`,
      [id.data]
    );
    res.json(r.rows.map(toCategory));
  } catch (err) { next(err); }
});

/** GET /api/marketplace/categories/:id/path — the ancestor chain ROOT→leaf for a
 *  category node, as [{ id, name }] (top-level first). Lets the item editor rebuild
 *  the Category ▸ Subcategory ▸ Sub-subcategory cascade from the single saved
 *  category_id at any depth (0015) — without it a deep node loads blank. */
router.get('/categories/:id/path', async (req, res, next) => {
  try {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid id' });
    const r = await pool.query(
      `WITH RECURSIVE up AS (
         SELECT id, name, parent_id, 0 AS depth
           FROM categories WHERE id = $1 AND deleted_at IS NULL
         UNION ALL
         SELECT c.id, c.name, c.parent_id, up.depth + 1
           FROM categories c JOIN up ON c.id = up.parent_id
          WHERE c.deleted_at IS NULL
       )
       SELECT id, name FROM up ORDER BY depth DESC`,
      [id.data]
    );
    res.json(r.rows); // root → leaf
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
    const { cat, sub, q, offset, priceMin, priceMax, tier, supplier, status, active, tag } = parsed.data;
    const vals = [req.user.org_id]; // $1 — ownership flag, never from the client
    // kind='component' items are the supplier's private cost-buildup library —
    // surfaced ONLY in Customize (Explore), never in the marketplace browse
    // (pV2-BUILDUP-02). parent_item_id IS NOT NULL rows are an item's child
    // options/components (pV2-BUILDUP-03) — they belong to their parent, never
    // browsable on their own.
    const where = [`i.deleted_at IS NULL`, `i.type IS DISTINCT FROM 'component'`, `i.parent_item_id IS NULL`];
    // pV2-STORE-01 — non-public visibility. The `status`/`active` filters are
    // honoured for two callers only: (1) the OWNER of the pinned supplier org
    // — a supplier sees their own draft/pending/inactive items; (2) a BALLPARK
    // ADMIN (admin.cross_org_view) — moderation sees any supplier's items
    // cross-org. Everyone else (incl. an owner browsing another store) gets the
    // public marketplace filter: active + approved only.
    // scope=public — the Shopfront (public brand page) forces the public item set
    // (approved + active) for EVERY viewer, so an owner or ballpark admin previewing
    // the Shopfront sees exactly what a customer sees. Overrides owner/admin scope.
    const publicScope = req.query.scope === 'public';
    const ownerScope = !publicScope && !!supplier && supplier === req.user.org_id;
    const adminScope = !publicScope && req.user.role === 'ballpark_admin';
    // A MANAGEMENT context — a pinned supplier store (owner/admin managing it) OR an
    // explicit status/active filter (e.g. the Approvals nav → /marketplace?status=pending).
    // ONLY there do owner/admin see non-public items. The plain global /marketplace
    // browse is the live catalogue for EVERYONE — admin included (same view for all
    // users); moderation lives in Approvals (explicit ?status) and the supplier Shop.
    const managementContext = (ownerScope || adminScope) && (!!supplier || !!status || !!active);
    if (managementContext) {
      if (status && status !== 'all') {
        vals.push(status); where.push(`i.approval_status = $${vals.length}`);
      } else if (adminScope && !status && !active) {
        // FR-00215 visibility rule — admin default in a management context (no explicit
        // status/publish filter): live OR awaiting review OR APPROVED-not-yet-active (so
        // an item approved but not published still shows and can be activated). Excludes
        // rejected + drafts. ?status=all skips this (whole catalogue); ?status=pending
        // narrows to the approval queue. Owner default falls through to whole catalogue.
        where.push(`(i.status = 'active' OR i.approval_status IN ('pending', 'approved'))`);
      }
      if (active === 'active') where.push(`i.status = 'active'`);
      else if (active === 'inactive') where.push(`i.status <> 'active'`);
      // active 'all' / unset → both (the supplier sees their whole catalogue)
    } else {
      where.push(`i.status = 'active'`, `i.approval_status = 'approved'`);
    }
    // ONE category axis at ANY depth (0015): selecting a node shows items classified
    // AT it OR at any DESCENDANT (recursive tree), so a deeper classification never
    // hides an item from a parent-level browse. `sub` is gone (merged into `cat`).
    // 'uncategorised' → the null-category bucket (pulled items awaiting review);
    // must stay browsable so an unclassified item is never invisible.
    const node = cat === 'uncategorised' ? null : (sub || cat); // sub (deeper pick) wins when present
    if (cat === 'uncategorised') { where.push(`i.category_id IS NULL`); }
    else if (node) {
      vals.push(node);
      where.push(`i.category_id IN (
        WITH RECURSIVE cat_tree AS (
          SELECT id FROM categories WHERE id = $${vals.length}
          UNION ALL
          SELECT c2.id FROM categories c2 JOIN cat_tree ON c2.parent_id = cat_tree.id
        ) SELECT id FROM cat_tree)`);
    }
    if (priceMin !== undefined) { vals.push(priceMin); where.push(`i.base_price >= $${vals.length}`); }
    if (priceMax !== undefined) { vals.push(priceMax); where.push(`i.base_price <= $${vals.length}`); }
    if (tier) { vals.push(tier); where.push(`i.tier = $${vals.length}`); }
    if (supplier) { vals.push(supplier); where.push(`i.org_id = $${vals.length}`); }
    // pV2-STORE-WHATS-HOT-01 — tag filter (e.g. the shopfront "What's Hot" menu).
    // v2dev: items.tags was dropped (item tags = the parked junction sub-slice), so
    // no item is tagged → a tag filter matches nothing. TODO: wire supplier_item_tag.
    if (tag) { where.push('false'); }
    if (q) {
      vals.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
      where.push(`(i.name ILIKE $${vals.length} OR i.description ILIKE $${vals.length})`);
    }
    vals.push(PAGE_SIZE, offset);
    const r = await pool.query(
      `SELECT i.id, i.name, i.description, i.install_description, i.base_price, i.unit, i.images,
              i.attributes,
              i.category_id, i.approval_status, i.status,
              -- v2dev: city/country moved to the address satellite (not on orgs/orgs_public);
              -- nulled here to keep the response shape. TODO: join primary_address for location.
              i.org_id AS supplier_id, o.name AS supplier_name, NULL::text AS supplier_city,
              c.name AS category_name,
              (i.org_id = $1) AS owned_by_active_org,
              COUNT(*) OVER() AS total
         FROM items i
         -- BE-00115 — cross-org: the supplier name/city come from the orgs_public
         -- VIEW (base orgs is RLS-hidden cross-org, which emptied the marketplace).
         -- The view is supplier + active + not-deleted; approved cross-org items
         -- all belong to such orgs, and an owner's own org qualifies too.
         JOIN orgs_public o ON o.id = i.org_id
         LEFT JOIN categories c ON c.id = i.category_id
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
      installDescription: row.install_description,
      basePrice: row.base_price === null ? null : Number(row.base_price),
      unit: row.unit,
      coverUrl: heroUrl(row.images),
      // Full gallery in display order (cover first) — the Quick View carousel.
      images: imageUrls(row.images),
      // pV2-STORE-ATTRIBUTE-GROUPS-01 — the grouped attributes power the quick-view
      // spec cards + variants picker (rendered from the already-loaded list row).
      attributes: row.attributes ?? null,
      categoryId: row.category_id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      supplierCity: row.supplier_city,
      categoryName: row.category_name,
      ownedByActiveOrg: !!row.owned_by_active_org,
      approvalStatus: row.approval_status,
      status: row.status,
      isActive: row.status === 'active',
    }));
    res.json({ items, total, hasMore: offset + items.length < total });
  } catch (err) { next(err); }
});

/** GET /api/marketplace/items/:id — a single PUBLIC item, for the read-only
 *  view page (any active member, e.g. an agent). Visibility is the public
 *  marketplace rule: approved + active only — drafts/pending/rejected/hidden
 *  items 404 here (owners use /store/items/:id, admins /admin/items/:id).
 *  Returns the raw row (StoreItem shape) the item page already consumes. */
router.get('/items/:id', async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT i.*, c.name AS category_name
         FROM items i
         LEFT JOIN categories c ON c.id = i.category_id
        WHERE i.id = $1 AND i.deleted_at IS NULL
          AND i.status = 'active' AND i.approval_status = 'approved'
          -- Components + child options are never marketplace-visible, even by
          -- direct link (pV2-BUILDUP-03).
          AND i.type IS DISTINCT FROM 'component' AND i.parent_item_id IS NULL`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    const row = r.rows[0];
    row.image_url = heroUrl(row.images); // derived (image_url column dropped in 0015)
    res.json(row);
  } catch (err) { next(err); }
});

/** GET /api/marketplace/items/:id/options — the item's options (child items),
 *  for the Final Quote Options picker. PUBLIC read (the agent isn't the owner). */
router.get('/items/:id/options', async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id, name, base_price, unit, category_id, type, description, images
         FROM items WHERE parent_item_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [req.params.id]
    );
    res.json(r.rows.map((c) => ({
      id: c.id, name: c.name, base_price: c.base_price, unit: c.unit, quantity: 1,
      category_id: c.category_id, kind: c.type, selection_type: 'selected',
      description: c.description, image_url: heroUrl(c.images),
    })));
  } catch (err) { next(err); }
});

// Favourites (pV2-06d) extracted to routes/marketplace-favourites.js
// (cards-audit F-8 — keep this file under the 300-line route alarm).

module.exports = router;
