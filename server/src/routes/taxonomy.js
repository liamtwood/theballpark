/**
 * Routes for TaxonomyService.
 *
 * Mounted at /api/taxonomy (see server/src/index.js).
 *
 * v1.43 — AI classification + pending-suggestion workflow:
 *   POST /classify              body: { itemId }
 *   POST /apply-classification  body: { itemId, category_id, subcategory_id, tag_ids[] }
 *   POST /dismiss-classification body: { itemId }
 *   GET  /dimensions?category_id=...
 *
 * v1.41 — subcategory helpers:
 *   POST /suggest-subcategory   body: { itemId }
 *   POST /backfill              body: { categoryId? } — admin path
 */
const router = require('express').Router();
const pool = require('../db/pool');
const { requireActiveMembership } = require('../middleware/require-active-membership');
const { assertOwnedByActiveOrg } = require('../lib/authz');
const TaxonomyService = require('../services/taxonomy.service');

// BE-00099 — this router is now inside the authenticated v2 group (see
// index.js). Item-mutating endpoints additionally require `item.create` AND
// scope the target item to the caller's org: classify / apply / dismiss /
// item-tags / suggest-subcategory rewrite an item by id, so without this an
// authed supplier could rewrite another org's item (cross-org IDOR).
async function assertItemInOrg(itemId, orgId) {
  if (!itemId) { const e = new Error('itemId is required'); e.status = 400; throw e; }
  const r = await pool.query('SELECT org_id FROM items WHERE id = $1', [itemId]);
  // 404 (not 403) on a foreign item — don't leak that the id exists.
  if (!r.rows.length || r.rows[0].org_id !== orgId) {
    const e = new Error('Item not found'); e.status = 404; throw e;
  }
}
const requireItemCreate = requireActiveMembership('item.create');

// ── v1.43 — full-taxonomy AI classification ────────────────────────────
router.post('/classify', requireItemCreate, async (req, res, next) => {
  try {
    const { itemId } = req.body || {};
    await assertItemInOrg(itemId, req.user.org_id);
    res.json(await TaxonomyService.classifyItem(itemId));
  } catch (err) { next(err); }
});

router.post('/apply-classification', requireItemCreate, async (req, res, next) => {
  try {
    const { itemId, category_id, subcategory_id, tag_ids } = req.body || {};
    await assertItemInOrg(itemId, req.user.org_id);
    const out = await TaxonomyService.applyClassification(itemId, {
      category_id, subcategory_id, tag_ids
    });
    res.json(out);
  } catch (err) { next(err); }
});

router.post('/dismiss-classification', requireItemCreate, async (req, res, next) => {
  try {
    const { itemId } = req.body || {};
    await assertItemInOrg(itemId, req.user.org_id);
    res.json(await TaxonomyService.dismissClassification(itemId));
  } catch (err) { next(err); }
});

// Replace an item's structured tags (item drawer Index tab).
router.post('/item-tags', requireItemCreate, async (req, res, next) => {
  try {
    const { itemId, tag_ids } = req.body || {};
    await assertItemInOrg(itemId, req.user.org_id);
    res.json(await TaxonomyService.setItemTags(itemId, tag_ids));
  } catch (err) { next(err); }
});

router.get('/dimensions', async (req, res, next) => {
  try {
    if (!req.query.category_id) {
      return res.status(400).json({ error: 'category_id required' });
    }
    res.json(await TaxonomyService.getDimensions(req.query.category_id));
  } catch (err) { next(err); }
});

// ── v1.49 — suppliers in a category (category card + sidebar filter).
//   category_id optional: omitted = every supplier with active items.
router.get('/category-suppliers', async (req, res, next) => {
  try {
    res.json(await TaxonomyService.categorySuppliers(req.query.category_id || null));
  } catch (err) { next(err); }
});

// Event-type values aggregated across categories (the "All" view filter).
router.get('/event-types', async (req, res, next) => {
  try {
    res.json(await TaxonomyService.eventTypes());
  } catch (err) { next(err); }
});

// ── v1.46 — Brief-tab item matching ────────────────────────────────────
// BE-00108 — these endpoints act on a project; assert the caller owns it (or is
// admin) up front so an authed user can't drive matching/RFQ against another
// org's project (IDOR). match-items persists to the project only when projectId
// is supplied (pure matching has none), so assert only when present.
router.post('/match-items', async (req, res, next) => {
  try {
    const { brief, categoryId, budgetEstimate, projectId } = req.body || {};
    if (projectId) await assertOwnedByActiveOrg('projects', projectId, req.user.org_id, { isAdmin: req.user.is_admin });
    res.json(await TaxonomyService.matchItems(brief, categoryId, budgetEstimate, projectId));
  } catch (err) { next(err); }
});

router.post('/add-match', async (req, res, next) => {
  try {
    await assertOwnedByActiveOrg('projects', (req.body || {}).project_id, req.user.org_id, { isAdmin: req.user.is_admin });
    res.json(await TaxonomyService.addMatchToProject(req.body || {}));
  } catch (err) { next(err); }
});

// v1.54 — un-add a Brief-tab match. body: { project_id, category_id, item_id }
router.post('/remove-match', async (req, res, next) => {
  try {
    await assertOwnedByActiveOrg('projects', (req.body || {}).project_id, req.user.org_id, { isAdmin: req.user.is_admin });
    res.json(await TaxonomyService.removeMatchFromProject(req.body || {}));
  } catch (err) { next(err); }
});

router.post('/search-hint', async (req, res, next) => {
  try {
    const { projectId, categoryId, searchTerms, userHint } = req.body || {};
    if (projectId) await assertOwnedByActiveOrg('projects', projectId, req.user.org_id, { isAdmin: req.user.is_admin });
    res.json(await TaxonomyService.saveSearchHint(projectId, categoryId, searchTerms, userHint));
  } catch (err) { next(err); }
});

// ── v1.50 — competitive quote outreach (RFQ, Phase 1) ──────────────────
//   POST /request-quotes  body: { project_id, category_id,
//     project_category_id?, requirements[], supplier_ids[], user_id? }
//   GET  /quote-requests?projectId=...
router.post('/request-quotes', async (req, res, next) => {
  try {
    // BE-00108 — RFQ is authorized BY the owned project (it creates supplier-owned
    // proposed items on the caller's behalf — see §1 decision A). Assert ownership.
    await assertOwnedByActiveOrg('projects', (req.body || {}).project_id, req.user.org_id, { isAdmin: req.user.is_admin });
    res.json(await TaxonomyService.requestQuotes(req.body || {}));
  } catch (err) { next(err); }
});

router.get('/quote-requests', async (req, res, next) => {
  try {
    res.json(await TaxonomyService.listProjectQuoteRequests(req.query.projectId));
  } catch (err) { next(err); }
});

// v1.52e — promote an AI-proposed brief item to a real (inactive,
// approval-pending) catalogue row so it can be edited / viewed.
//   POST /materialize-proposed  body: { supplier_id, category_id,
//     name, description?, estimated_price? }
router.post('/materialize-proposed', async (req, res, next) => {
  try {
    // BE-00108 GAP (flagged): the body is { supplier_id, category_id, name, … } —
    // there is NO projectId to assert against, and it creates a SUPPLIER-owned
    // item (org_id = supplier_id) on an agency's behalf (cross-org write). The
    // project-ownership guard cannot apply here; this is the §1 decision-A RFQ
    // path — real enforcement is the RLS elevated-context write. Left authed but
    // unscoped for now; do NOT bolt on a mismatched assertion.
    res.json(await TaxonomyService.materializeProposedItem(req.body || {}));
  } catch (err) { next(err); }
});

// ── v1.41 — subcategory-only helpers ───────────────────────────────────
router.post('/suggest-subcategory', requireItemCreate, async (req, res, next) => {
  try {
    const { itemId } = req.body || {};
    await assertItemInOrg(itemId, req.user.org_id);
    res.json(await TaxonomyService.suggestSubcategory(itemId));
  } catch (err) { next(err); }
});

// Bulk admin reclassify — ballpark-admin only (was ungated).
router.post('/backfill', requireActiveMembership('admin.cross_org_view'), async (req, res, next) => {
  try {
    const { categoryId } = req.body || {};
    res.json(await TaxonomyService.backfillSubcategories(categoryId));
  } catch (err) { next(err); }
});

module.exports = router;
