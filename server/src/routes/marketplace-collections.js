// pV2-ADDONS-02 — buyer-facing collection read for the quick-view strip. Mounted on the
// gated v2 router at /marketplace (inherits authenticate + active membership). Read-only.
//   GET /api/marketplace/items/:id/collections → the item's collections + other members.
const router = require('express').Router();
const CollectionService = require('../services/collection.service');

router.get('/items/:id/collections', async (req, res, next) => {
  try {
    // Owner sees their own drafts (My Shop), admin sees everything, else public scope.
    const isAdmin = req.user?.role === 'ballpark_admin';
    res.json(await CollectionService.collectionsForItem(String(req.params.id), req.user?.org_id, isAdmin));
  } catch (err) { next(err); }
});

// GET /api/marketplace/items/:id/related → the related collections (members of collections this
// item POINTS AT via item_related_tags) for the quick-view Related-items strip.
router.get('/items/:id/related', async (req, res, next) => {
  try {
    const isAdmin = req.user?.role === 'ballpark_admin';
    res.json(await CollectionService.relatedForItem(String(req.params.id), req.user?.org_id, isAdmin));
  } catch (err) { next(err); }
});

module.exports = router;
