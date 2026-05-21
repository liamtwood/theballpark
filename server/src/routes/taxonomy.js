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
const TaxonomyService = require('../services/taxonomy.service');

// ── v1.43 — full-taxonomy AI classification ────────────────────────────
router.post('/classify', async (req, res, next) => {
  try {
    const { itemId } = req.body || {};
    res.json(await TaxonomyService.classifyItem(itemId));
  } catch (err) { next(err); }
});

router.post('/apply-classification', async (req, res, next) => {
  try {
    const { itemId, category_id, subcategory_id, tag_ids } = req.body || {};
    const out = await TaxonomyService.applyClassification(itemId, {
      category_id, subcategory_id, tag_ids
    });
    res.json(out);
  } catch (err) { next(err); }
});

router.post('/dismiss-classification', async (req, res, next) => {
  try {
    const { itemId } = req.body || {};
    res.json(await TaxonomyService.dismissClassification(itemId));
  } catch (err) { next(err); }
});

// Replace an item's structured tags (item drawer Index tab).
router.post('/item-tags', async (req, res, next) => {
  try {
    const { itemId, tag_ids } = req.body || {};
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

// ── v1.41 — subcategory-only helpers ───────────────────────────────────
router.post('/suggest-subcategory', async (req, res, next) => {
  try {
    const { itemId } = req.body || {};
    res.json(await TaxonomyService.suggestSubcategory(itemId));
  } catch (err) { next(err); }
});

router.post('/backfill', async (req, res, next) => {
  try {
    const { categoryId } = req.body || {};
    res.json(await TaxonomyService.backfillSubcategories(categoryId));
  } catch (err) { next(err); }
});

module.exports = router;
