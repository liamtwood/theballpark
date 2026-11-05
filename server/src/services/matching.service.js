/**
 * MatchingService — brief → catalogue item matcher (Brief tab / recommend).
 *
 * Extracted from taxonomy.service.js in the BE-00112 decomposition (Layer 1).
 * The AI call is collapsed onto ai.service.callHaikuJson (dropped taxonomy's
 * duplicate Haiku client — same model + max_tokens, maxRetries:8, 503 mapping,
 * JSON+fence parse). One Haiku call scores every item in a category, ranks
 * suppliers, and proposes a new item if nothing fits; persists the result to
 * project_categories.match_result_json.
 */
const pool = require('../db/pool');
const { callHaikuJson } = require('./ai.service');
const ProjectMatchService = require('./project-match.service');

function httpErr(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/* ─────────────────────────────────────────────────────────────────────
   BRIEF-TAB ITEM MATCHING (v1.46 — Brief tab upgrade)
   ───────────────────────────────────────────────────────────────────── */

const MATCH_SYSTEM = `You are an event production item matcher. You have a project brief requirement and a catalogue of real items + suppliers.

Do THREE things:

1. SCORE each item 1-10 against the brief. Consider: does the item TYPE match? Is the SCALE right? Could this supplier deliver? Is the PRICE reasonable for this brief? Also set a sensible QUANTITY for THIS event: scale consumables and seating by the guest count (≈1 glass / place-setting / chair per guest), size tables and furniture to the layout (e.g. round tables of ~8–10), and use 1 for a whole-venue or single hire. Default to 1 if unsure.

PRIORITISE THE HEADLINE SERVICE. When the brief describes a per-head service — a meal (breakfast/lunch/dinner), a drinks or catering package, a per-guest ticket — the matching PER-HEAD item (unit 'per_guest'/'per_head', priced per guest) is the PRIMARY line and the main cost. ALWAYS score and include the best-fitting per-head item for that need (quantity ≈ guest count), even if supporting equipment or accessories (ovens, fridges, glassware, linens) also match — those supplement the headline, they don't replace it. Never return only accessories/equipment for a brief that asks for the meal/service itself.

2. If no item scores 7+, pick the BEST-FIT SUPPLIER based on their other items and speciality.

3. CREATE a proposed item for that supplier with an estimated price. Base the estimate on similar items in the catalogue (scale up/down), the budget hint if provided, and your knowledge of London event-production costs.

Also return the search terms you used to match — this helps us understand your reasoning.

Return ONLY valid JSON, no markdown:
{
  "search_terms": ["inflatable", "bespoke"],
  "matched_items": [ { "item_id": "uuid", "score": 8, "quantity": 200, "reason": "one sentence" } ],
  "closest_item": { "item_id": "uuid", "score": 6, "reason": "one sentence" },
  "suppliers_ranked": [ { "supplier_id": "uuid", "fit_reason": "short phrase" } ],
  "proposed_item": { "name": "...", "description": "...", "supplier_id": "uuid", "estimated_price": 15000, "confidence": 4, "reason": "one sentence" }
}

If good matches exist (7+), proposed_item can be null. If no items exist in this category at all, return empty matched_items and still propose one.`;

/**
 * Match a category brief against the catalogue. ONE Haiku call scores
 * every item in the category, ranks suppliers, and proposes a new item
 * if nothing fits. Returns a fully-hydrated result for the Brief tab.
 *
 * v1.49e — when projectId is supplied the result is persisted to
 * project_categories.match_result_json so the Brief tab can re-display
 * the previous search without re-running the AI.
 */
async function matchItems(brief, categoryId, budgetEstimate, projectId) {
  if (!categoryId) throw httpErr('categoryId is required', 400);
  const briefText = (brief || '').trim();
  if (!briefText) throw httpErr('brief is required', 400);

  const cat = await pool.query('SELECT id, name FROM categories WHERE id = $1', [categoryId]);
  if (!cat.rows.length) throw httpErr('category not found', 404);
  const categoryName = cat.rows[0].name;

  // REBUILD: the catalogue is a single-parent tree and items live in leaf
  // subcategories, so match the category AND all its descendants.
  const inCategory =
    `i.category_id IN (
       WITH RECURSIVE sub AS (
         SELECT $1::uuid AS id
         UNION ALL SELECT c.id FROM categories c JOIN sub ON c.parent_id = sub.id
       ) SELECT id FROM sub
     )`;
  // Published = active + approved (the rebuild replaced items.is_active). Hero
  // image comes from the images jsonb (items.image_url was dropped); there is no
  // items.subcategory_id in the rebuild, so subcategory_name is null.
  const published = `i.status = 'active' AND i.approval_status = 'approved' AND i.deleted_at IS NULL`;
  const heroImg =
    `(SELECT e->>'url' FROM jsonb_array_elements(i.images) e
       ORDER BY (e->>'is_hero')::boolean DESC NULLS LAST, (e->>'sort_order')::int ASC NULLS LAST
       LIMIT 1)`;

  const itemsRes = await pool.query(
    `SELECT i.id, i.name, i.description, i.base_price, i.org_id,
            ${heroImg} AS image_url, i.external_url, i.image_display,
            NULL::text AS subcategory_name, o.name AS supplier_name
       FROM items i
       LEFT JOIN orgs_public o ON o.id = i.org_id
      WHERE ${published} AND ${inCategory}
      ORDER BY i.name`,
    [categoryId]
  );
  const items = itemsRes.rows;
  const itemById = new Map(items.map(i => [i.id, i]));

  const supRes = await pool.query(
    `SELECT o.id, o.name, o.description, o.cover_image_url, o.logo_url, o.image_display,
            COUNT(i.id)::int AS item_count
       FROM items i JOIN orgs_public o ON o.id = i.org_id
      WHERE ${published} AND ${inCategory}
      GROUP BY o.id, o.name, o.description, o.cover_image_url, o.logo_url, o.image_display
      ORDER BY item_count DESC`,
    [categoryId]
  );
  const suppliers = supRes.rows;
  const supById = new Map(suppliers.map(s => [s.id, s]));

  // AI via the shared guided-Haiku plumbing (ai.service.callHaikuJson) — same
  // model + max_tokens as the former in-service client (BE-00112 Layer 2).
  const { parsed } = await callHaikuJson({
    system: MATCH_SYSTEM,
    // Large categories (e.g. Catering = equipment + caterers, ~200 items) need a
    // bigger budget or the scored JSON truncates → unparseable → 0 matches.
    maxTokens: 4000,
    user:
`Brief requirement: "${briefText}"
Category: ${categoryName}
Budget for this category: ${budgetEstimate ? '£' + budgetEstimate : 'not set'}

Catalogue items in this category:
${JSON.stringify(items.map(i => ({
  id: i.id, name: i.name,
  description: (i.description || '').slice(0, 240),
  base_price: i.base_price, subcategory: i.subcategory_name,
  supplier_name: i.supplier_name
})), null, 1)}

Suppliers in this category:
${JSON.stringify(suppliers.map(s => ({
  id: s.id, name: s.name,
  description: (s.description || '').slice(0, 200),
  item_count: s.item_count
})), null, 1)}

Score items and propose if needed.`
  });
  if (!parsed) throw httpErr('AI matcher returned an unparseable response', 502);

  // Hydrate matched / closest items with real catalogue data.
  const hydrate = (m) => {
    if (!m || !m.item_id) return null;
    const it = itemById.get(m.item_id);
    if (!it) return null;
    return {
      item_id:          it.id,
      name:             it.name,
      description:      (it.description || '').slice(0, 320),
      base_price:       it.base_price != null ? Number(it.base_price) : null,
      supplier_id:      it.org_id,
      supplier_name:    it.supplier_name,
      subcategory_name: it.subcategory_name || null,
      image_url:        it.image_url || null, // NOT external_url — that's the product-page URL (pV2-STORE-EXTRACT-01), never an image
      image_display:    it.image_display || null,
      score:            Math.max(1, Math.min(10, Number(m.score) || 0)),
      // Event-sized quantity suggested by the matcher (≥1); the add snaps it in.
      quantity:         Math.max(1, Math.round(Number(m.quantity) || 1)),
      reason:           m.reason || ''
    };
  };
  const matched = (Array.isArray(parsed.matched_items) ? parsed.matched_items : [])
    .map(hydrate).filter(Boolean)
    .filter(m => m.score >= 7)
    .sort((a, b) => b.score - a.score);
  const matchedIds = new Set(matched.map(m => m.item_id));
  let closest = hydrate(parsed.closest_item);
  if (closest && matchedIds.has(closest.item_id)) closest = null;

  const suppliersRanked = (Array.isArray(parsed.suppliers_ranked) ? parsed.suppliers_ranked : [])
    .filter(s => s && supById.has(s.supplier_id))
    .map(s => {
      const db = supById.get(s.supplier_id);
      // Prefer the cover photo (rendered cover) and fall back to the
      // logo (rendered contain) so the preview card always has artwork.
      const supImg = db.cover_image_url || db.logo_url || null;
      return {
        supplier_id:   s.supplier_id,
        supplier_name: db.name,
        description:   (db.description || '').slice(0, 320),
        fit_reason:    s.fit_reason || '',
        item_count:    db.item_count,
        image_url:     supImg,
        image_display: db.cover_image_url
          ? (db.image_display || null)
          : (supImg ? 'contain' : null)
      };
    });

  let proposed = null;
  if (parsed.proposed_item && parsed.proposed_item.name) {
    const p = parsed.proposed_item;
    const db = supById.get(p.supplier_id);
    const fallback = suppliers[0] || null;
    const supplierId = db ? p.supplier_id : (fallback ? fallback.id : null);
    proposed = {
      name:            p.name,
      description:     p.description || briefText,
      supplier_id:     supplierId,
      supplier_name:   db ? db.name : (fallback ? fallback.name : 'Supplier'),
      estimated_price: Math.max(0, Number(p.estimated_price) || 0),
      confidence:      Math.max(1, Math.min(10, Number(p.confidence) || 1)),
      reason:          p.reason || ''
    };
    // v1.52f — create the proposed item up front as a real (inactive,
    // approval-pending) catalogue row so it carries a stable item_id for
    // the Brief tab's ✎ / 👁 actions with no on-demand round trip. The
    // row is inert — is_active=false hides it from the catalogue /
    // marketplace / matcher until the named supplier approves it.
    // Best-effort: a failed insert just leaves item_id null and the
    // lazy /materialize-proposed fallback still covers it.
    if (supplierId) {
      try {
        const row = await ProjectMatchService.materializeProposedItem({
          supplier_id:     supplierId,
          category_id:     categoryId,
          name:            proposed.name,
          description:     proposed.description,
          estimated_price: proposed.estimated_price
        });
        proposed.item_id = row.id;
      } catch (e) {
        console.error('[matchItems] could not pre-create proposed item:', e.message);
      }
    }
  }

  const result = {
    category_id:       categoryId,
    category_name:     categoryName,
    search_terms:      Array.isArray(parsed.search_terms) ? parsed.search_terms : [],
    items_scanned:     items.length,
    suppliers_scanned: suppliers.length,
    matched_items:     matched,
    closest_item:      closest,
    suppliers_ranked:  suppliersRanked,
    proposed_item:     proposed,
    searched_brief:    briefText,
    searched_at:       new Date().toISOString()
  };

  // v1.49e — persist the result onto the project-category scope row so
  // the Brief tab re-displays it later. Best-effort: a failed write here
  // must never break the search response the user is waiting on.
  if (projectId) {
    try {
      await pool.query(
        `UPDATE project_categories
            SET match_result_json = $1, updated_at = NOW()
          WHERE project_id = $2 AND category_id = $3 AND deleted_at IS NULL`,
        [JSON.stringify(result), projectId, categoryId]
      );
    } catch (e) {
      console.error('[matchItems] could not persist match_result_json:', e.message);
    }
  }

  return result;
}

module.exports = { matchItems };
