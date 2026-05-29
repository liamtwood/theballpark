const pool = require('../db/pool');

// Project-scoped "cart" — selected (tick) and liked (heart) catalogue items
// recorded on a project before any pricing exists. See v1.13 schema.

/** v1.65cq — recompute project_categories.ballpark_cost for every
    active category on a project from the current project_items + items
    catalogue. Single SQL round-trip. Each category sums the base_price
    of project_items whose item.category_id matches the category_id OR
    is a child (parent_id = category_id) — mirrors the walk-up in
    taxonomy.service.recomputeCategoryBallpark, but in bulk.

    Called on every project_items add/remove so the Estimate drawer +
    Overview Estimate card see fresh ballpark_cost. Previously this
    only fired on the AI-matcher (addMatchToProject) write path, so
    items added through the regular Marketplace + button left their
    category's ballpark_cost at 0.

    v1.65ei (p0015 demo) — per-attendee math. Items whose unit is
    'cover' or 'head' bill per guest, so the line cost is
    base_price × project.guest_count. Other units (each, platter,
    event, day, …) stay flat. ballpark_cost still represents "your
    cost" (no margin or VAT) so the Estimate page's recalc() can
    layer those on top without double-counting; the catalogue-grid's
    per-category Estimate panel applies margin + VAT at display time
    so it reads as a client-facing figure.

    v1.65f2 — buy quantity. Each project_items row now carries a
    NUMERIC `quantity` (default 1). The line cost multiplies by
    pi.quantity IN ADDITION to the per-head guest_count multiplier:
      line = base_price × quantity × (guest_count when per-head else 1)
    So "10 platters × 250 guests × £6.25" reads as £15,625 (qty 10,
    unit 'cover' → both multipliers apply); "3 days AV crew × £800"
    reads as £2,400 (qty 3, unit 'day' → only qty applies). */
async function recomputeProjectBallparks(projectId) {
  // v1.65fA — recompute now reads from the project_items SNAPSHOT
  // first (pi.base_price + pi.unit), falling back to the catalogue
  // (i.base_price + i.unit) only when the snapshot column is NULL.
  // This means an agent's per-brief tweak to price (e.g. £85 → £80)
  // flows through to the project's ballpark_cost immediately, with
  // zero impact on the catalogue master other projects reference.
  await pool.query(
    `UPDATE project_categories pc
        SET ballpark_cost = COALESCE((
              SELECT SUM(
                       COALESCE(pi.base_price, i.base_price, 0)
                       * COALESCE(pi.quantity, 1)
                       * CASE
                           WHEN LOWER(COALESCE(pi.unit, i.unit, '')) IN ('cover', 'head')
                             THEN COALESCE(p.guest_count, 1)
                           ELSE 1
                         END
                     )
                FROM project_items pi
                JOIN items i ON i.id = pi.item_id
                JOIN projects p ON p.id = pi.project_id
               WHERE pi.project_id = pc.project_id
                 AND (
                   i.category_id = pc.category_id
                   OR i.category_id IN (
                     SELECT id FROM categories WHERE parent_id = pc.category_id
                   )
                 )
            ), 0),
            updated_at = NOW()
      WHERE pc.project_id = $1 AND pc.is_active = true`,
    [projectId]
  );
}

async function getByProject(projectId) {
  // v1.18: also return `i.category_id AS item_category_id` so the Build
  // tab can bucket project_items under a project_category whose category
  // matches the item's category — even when an older project_items row
  // was created without project_category_id set (the v1.17 catalogue-grid
  // detail-panel + button didn't pass it through). New writes still go
  // through add() with project_category_id when the caller has it.
  //
  // v1.22: also return i.lead_time_days and the joined supplier (org)
  // name. The redesigned category-context-panel surfaces both — the
  // "longest lead" summary and the per-row "{supplier} · {N} days
  // lead" subtitle.
  //
  // v1.23: also return c.icon_name AS category_icon_name so the
  // shared category-card-header can render an icon when the project_item
  // is grouped without re-joining categories on the client.
  // v1.65ab — also return i.description and the supplier/category cover
  // assets so the Project Items cart drawer can show the hover-description
  // tooltip and walk the image fallback chain
  // (item.image_url → supplier cover → category icon colour).
  // v1.65el — also return o.id AS supplier_org_id so the Cart drawer's
  // "Send brief to suppliers" CTA can group the cart by supplier and
  // pre-tick those suppliers in the outreach 4-step. Was previously
  // only joining for supplier_name, which left the CTA gate
  // (canSendBrief checks supplier_org_id) permanently disabled.
  // v1.65fA — project_items now carries its own snapshot of
  // name / base_price / unit / description. Prefer pi.<col> (the
  // snapshot) and fall back to i.<col> (the catalogue master) for
  // legacy rows that never had a snapshot back-filled or for the
  // image/time_unit/tier/lead_time fields we haven't snapshotted
  // (yet — those still come from the catalogue).
  // v1.65fH — also aggregate the per-item supplier roster (the set
  // of suppliers ticked to receive a quote request on this line)
  // via array_agg from project_item_suppliers. ARRAY_REMOVE strips
  // the NULL the LEFT JOIN injects when the row has no rosters
  // (ad-hoc items pre-tick).
  const result = await pool.query(
    `SELECT pi.*,
            COALESCE(pi.name,        i.name)        AS name,
            COALESCE(pi.description, i.description) AS description,
            COALESCE(pi.base_price,  i.base_price)  AS base_price,
            COALESCE(pi.unit,        i.unit)        AS unit,
            i.time_unit,
            COALESCE(pi.image_url,   i.image_url)   AS image_url,
            i.tier,
            i.lead_time_days,
            i.category_id     AS item_category_id,
            c.name            AS category_name,
            c.icon_name       AS category_icon_name,
            c.icon_color      AS category_icon_color,
            o.id              AS supplier_org_id,
            o.name            AS supplier_name,
            o.cover_image_url AS supplier_cover_url,
            ARRAY_REMOVE(ARRAY_AGG(pis.supplier_org_id), NULL) AS asked_supplier_ids
       FROM project_items pi
       LEFT JOIN items                  i   ON pi.item_id = i.id
       LEFT JOIN categories             c   ON i.category_id = c.id
       LEFT JOIN orgs                   o   ON i.org_id = o.id
       LEFT JOIN project_item_suppliers pis ON pis.project_item_id = pi.id
      WHERE pi.project_id = $1
      GROUP BY pi.id, i.id, c.id, o.id
      ORDER BY pi.created_at ASC`,
    [projectId]
  );
  return result.rows;
}

/** v1.65fI — promote an ad-hoc ask into a real cart line. Creates
    an `items` row (agency-owned, is_active=false, approval_status=
    'pending') so the new ask can be edited like a catalogue item,
    plus the corresponding `project_items` snapshot row. One
    transaction. No supplier roster — the agent has to pick before
    Send. Returns the project_items row in the same shape
    getByProject would. */
async function addAdhoc(data) {
  // v1.65fI fix — callers may pass either:
  //   project_category_id (the project_categories.id, used by the
  //                        catalogue-grid's Build flow)
  //   category_id         (the catalogue categories.id, used by the
  //                        cart drawer's contextCategoryId)
  // We accept both shapes — resolve to BOTH a project_categories.id
  // (FK on project_items) AND a categories.id (FK on items) before
  // INSERT, so neither FK fails.
  const { project_id, project_category_id, category_id, name, base_price, unit, description } = data || {};
  if (!project_id) {
    const err = new Error('project_id is required'); err.status = 400; throw err;
  }
  if (!name || !String(name).trim()) {
    const err = new Error('name is required'); err.status = 400; throw err;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1. Look up the project's owning org (agency) — the items row
    //    is owned by them by convention; the supplier slot stays
    //    empty until the brief fans out at Send time.
    const proj = await client.query(
      'SELECT org_id FROM projects WHERE id = $1',
      [project_id]
    );
    if (!proj.rows[0]) {
      const err = new Error('project not found'); err.status = 404; throw err;
    }
    const agencyOrgId = proj.rows[0].org_id;
    // 2. Resolve project_categories.id + categories.id, accepting
    //    either input. project_category_id wins when present.
    let pcId = null;
    let categoryId = null;
    if (project_category_id) {
      const pc = await client.query(
        'SELECT id, category_id FROM project_categories WHERE id = $1 AND project_id = $2',
        [project_category_id, project_id]
      );
      pcId = pc.rows[0]?.id || null;
      categoryId = pc.rows[0]?.category_id || null;
    } else if (category_id) {
      const pc = await client.query(
        `SELECT id FROM project_categories
          WHERE project_id = $1 AND category_id = $2
          LIMIT 1`,
        [project_id, category_id]
      );
      pcId = pc.rows[0]?.id || null;
      categoryId = category_id;
    }
    // 2. Create the items row. UNIQUE(org_id, name) means re-adding
    //    the same ask name re-uses the existing items row — keeps
    //    things idempotent.
    const it = await client.query(
      `INSERT INTO items (org_id, category_id, name, description, unit, base_price,
                          is_active, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6, false, 'pending')
       ON CONFLICT (org_id, name) DO UPDATE SET
         category_id = COALESCE(EXCLUDED.category_id, items.category_id),
         description = COALESCE(EXCLUDED.description, items.description),
         unit        = COALESCE(EXCLUDED.unit,        items.unit),
         base_price  = COALESCE(EXCLUDED.base_price,  items.base_price),
         updated_at  = NOW()
       RETURNING id`,
      [agencyOrgId, categoryId, String(name).trim(), description || null, unit || null, base_price || null]
    );
    const newItemId = it.rows[0].id;
    // 3. Create the project_items row, snapshot fields copied.
    //    Use the resolved pcId (a real project_categories.id) so the
    //    FK never fires on a raw catalogue category id.
    const pi = await client.query(
      `INSERT INTO project_items
         (project_id, item_id, project_category_id, selection_type,
          name, base_price, unit, description)
       VALUES ($1, $2, $3, 'selected', $4, $5, $6, $7)
       ON CONFLICT (project_id, item_id) DO UPDATE SET
         selection_type      = 'selected',
         project_category_id = COALESCE(EXCLUDED.project_category_id, project_items.project_category_id),
         name                = COALESCE(EXCLUDED.name,        project_items.name),
         base_price          = COALESCE(EXCLUDED.base_price,  project_items.base_price),
         unit                = COALESCE(EXCLUDED.unit,        project_items.unit),
         description         = COALESCE(EXCLUDED.description, project_items.description)
       RETURNING *`,
      [project_id, newItemId, pcId,
       String(name).trim(), base_price || null, unit || null, description || null]
    );
    await client.query('COMMIT');
    await recomputeProjectBallparks(project_id);
    return pi.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** v1.65fH — list suppliers ticked on a single cart row. */
async function listItemSuppliers(projectId, itemId) {
  const r = await pool.query(
    `SELECT pis.supplier_org_id
       FROM project_item_suppliers pis
       JOIN project_items pi ON pi.id = pis.project_item_id
      WHERE pi.project_id = $1 AND pi.item_id = $2`,
    [projectId, itemId]
  );
  return r.rows.map(x => x.supplier_org_id);
}

/** v1.65fH — tick a supplier for a cart row. Idempotent via the
    UNIQUE primary key on (project_item_id, supplier_org_id). */
async function addItemSupplier(projectId, itemId, supplierOrgId) {
  if (!supplierOrgId) {
    const err = new Error('supplier_org_id is required');
    err.status = 400;
    throw err;
  }
  const pi = await pool.query(
    `SELECT id FROM project_items WHERE project_id = $1 AND item_id = $2`,
    [projectId, itemId]
  );
  if (!pi.rows[0]) {
    const err = new Error('project_item not found');
    err.status = 404;
    throw err;
  }
  await pool.query(
    `INSERT INTO project_item_suppliers (project_item_id, supplier_org_id)
     VALUES ($1, $2)
     ON CONFLICT (project_item_id, supplier_org_id) DO NOTHING`,
    [pi.rows[0].id, supplierOrgId]
  );
  return await listItemSuppliers(projectId, itemId);
}

/** v1.65fH — untick a supplier. No-op when not currently ticked. */
async function removeItemSupplier(projectId, itemId, supplierOrgId) {
  await pool.query(
    `DELETE FROM project_item_suppliers pis
       USING project_items pi
      WHERE pis.project_item_id = pi.id
        AND pi.project_id = $1 AND pi.item_id = $2
        AND pis.supplier_org_id = $3`,
    [projectId, itemId, supplierOrgId]
  );
  return await listItemSuppliers(projectId, itemId);
}

async function add(data) {
  const { project_id, item_id, project_category_id, selection_type } = data;
  if (!project_id || !item_id) {
    const err = new Error('project_id and item_id are required');
    err.status = 400;
    throw err;
  }
  const type = selection_type || 'selected';
  if (type !== 'selected' && type !== 'liked') {
    const err = new Error(`selection_type must be 'selected' or 'liked'`);
    err.status = 400;
    throw err;
  }

  // Upsert: tick overwrites heart and vice versa. project_category_id is
  // preserved if the existing row had one and the new payload doesn't.
  //
  // v1.65fA — on INSERT, copy name/base_price/unit/description from
  // the catalogue items row so the project_items row IS the snapshot
  // from the moment it lands in the cart. On UPDATE (re-tick of an
  // existing row) we don't re-copy: the user may have already
  // tweaked the snapshot and we'd be clobbering their edits. The
  // catalogue copy lives in a subquery on the same statement so we
  // make one round-trip instead of two.
  const result = await pool.query(
    `INSERT INTO project_items
       (project_id, item_id, project_category_id, selection_type,
        name, base_price, unit, description)
     SELECT $1, $2, $3, $4,
            i.name, i.base_price, i.unit, i.description
       FROM items i
      WHERE i.id = $2
     ON CONFLICT (project_id, item_id) DO UPDATE SET
       selection_type      = EXCLUDED.selection_type,
       project_category_id = COALESCE(EXCLUDED.project_category_id, project_items.project_category_id)
     RETURNING *`,
    [project_id, item_id, project_category_id ?? null, type]
  );
  // v1.65fH — tick the source supplier on cart-add so the new line
  // defaults to "ask the supplier who listed it". Skipped silently
  // for agency-owned items (ad-hoc placeholders) — those start with
  // an empty supplier set and require an explicit pick before Send.
  await pool.query(
    `INSERT INTO project_item_suppliers (project_item_id, supplier_org_id)
     SELECT $1, i.org_id
       FROM items i
       JOIN orgs  o ON o.id = i.org_id AND o.type = 'supplier'
      WHERE i.id = $2
     ON CONFLICT (project_item_id, supplier_org_id) DO NOTHING`,
    [result.rows[0].id, item_id]
  );
  // v1.65cq — keep project_categories.ballpark_cost in sync after every
  // regular-Marketplace add so the Estimate drawer + Overview cards
  // reflect the new cart. Previously only the AI-matcher path did this.
  await recomputeProjectBallparks(project_id);
  return result.rows[0];
}

/** v1.65fA — partial update for the project_items snapshot. Accepts
    any subset of { name, base_price, unit, description, quantity }
    and patches only the provided keys via a COALESCE pattern so
    untouched columns stay as they were. base_price + unit changes
    trigger recomputeProjectBallparks so the Estimate stays live.
    Returns the updated row, or null if the row doesn't exist.

    Why a single update() instead of per-field setters: the cart UI's
    Adjust form typically saves name + price + unit + description in
    one click — sending them as one PATCH is faster + atomic. */
async function update(projectId, itemId, patch) {
  const p = patch || {};
  const cols = ['name', 'base_price', 'unit', 'description', 'quantity', 'image_url'];
  const hasAny = cols.some(c => p[c] !== undefined);
  if (!hasAny) {
    const err = new Error('At least one of name/base_price/unit/description/quantity/image_url is required');
    err.status = 400;
    throw err;
  }
  // Quantity floor: 1 (zero/negative reserved for DELETE).
  const qty = p.quantity !== undefined ? Math.max(1, Number(p.quantity) || 1) : undefined;
  const result = await pool.query(
    `UPDATE project_items
        SET name        = COALESCE($3, name),
            base_price  = COALESCE($4, base_price),
            unit        = COALESCE($5, unit),
            description = COALESCE($6, description),
            quantity    = COALESCE($7, quantity),
            image_url   = COALESCE($8, image_url)
      WHERE project_id = $1 AND item_id = $2
      RETURNING *`,
    [
      projectId,
      itemId,
      p.name        ?? null,
      p.base_price  ?? null,
      p.unit        ?? null,
      p.description ?? null,
      qty           ?? null,
      p.image_url   ?? null,
    ]
  );
  if (!result.rows[0]) return null;
  // Only recompute when something money-relevant changed (skip when
  // only name or description were patched — cosmetic).
  if (p.base_price !== undefined || p.unit !== undefined || p.quantity !== undefined) {
    await recomputeProjectBallparks(projectId);
  }
  return result.rows[0];
}

/** v1.65f2 — update the buy-quantity on a project_items row. Clamps to
    a minimum of 1 (zero / negative are nonsense for a cart line; use
    DELETE to remove a row instead). Caller passes the canonical
    projectId + itemId pair that uniquely identifies the row. Returns
    the updated row, or null if the row doesn't exist. Recomputes
    category ballpark on success so the Estimate stays live. */
async function setQuantity(projectId, itemId, quantity) {
  const qty = Math.max(1, Number(quantity) || 1);
  const result = await pool.query(
    `UPDATE project_items
        SET quantity = $3
      WHERE project_id = $1 AND item_id = $2
      RETURNING *`,
    [projectId, itemId, qty]
  );
  if (!result.rows[0]) return null;
  await recomputeProjectBallparks(projectId);
  return result.rows[0];
}

async function remove(projectId, itemId) {
  const result = await pool.query(
    `DELETE FROM project_items
      WHERE project_id = $1 AND item_id = $2
      RETURNING *`,
    [projectId, itemId]
  );
  // v1.65cq — recompute on remove too so deleting an item from the cart
  // drops the corresponding cost from the category's ballpark.
  await recomputeProjectBallparks(projectId);
  return result.rows[0] || null;
}

module.exports = {
  getByProject, add, addAdhoc, update, setQuantity, remove,
  listItemSuppliers, addItemSupplier, removeItemSupplier,
  recomputeProjectBallparks,
};
