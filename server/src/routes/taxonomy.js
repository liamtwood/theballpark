/**
 * Routes for TaxonomyService — v1.41.
 *
 * Mounted at /api/taxonomy (see server/src/index.js).
 *   POST /suggest-subcategory  body: { itemId }
 *   POST /backfill             body: { categoryId? } — admin path
 */
const router = require('express').Router();
const TaxonomyService = require('../services/taxonomy.service');

router.post('/suggest-subcategory', async (req, res, next) => {
  try {
    const { itemId } = req.body || {};
    const out = await TaxonomyService.suggestSubcategory(itemId);
    res.json(out);
  } catch (err) { next(err); }
});

router.post('/backfill', async (req, res, next) => {
  try {
    const { categoryId } = req.body || {};
    const out = await TaxonomyService.backfillSubcategories(categoryId);
    res.json(out);
  } catch (err) { next(err); }
});

module.exports = router;
