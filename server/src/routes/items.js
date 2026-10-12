const router = require('express').Router();
const ItemService = require('../services/item.service');

// GET /api/items/counts — item counts per category
router.get('/counts', async (req, res, next) => {
  try { res.json(await ItemService.countsByCategory()); } catch (err) { next(err); }
});

// GET /api/items/tags?category_id= — must be before /:id
router.get('/tags', async (req, res, next) => {
  try {
    if (!req.query.category_id) return res.status(400).json({ error: 'category_id required' });
    res.json(await ItemService.getTagsByCategory(req.query.category_id));
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await ItemService.getAll(
      req.query.org_id,
      req.query.category_id,
      req.query.tag
    ));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await ItemService.getById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) { next(err); }
});

// WRITE routes RETIRED (audit H1, 2026-10-12). This v1 legacy surface called
// ItemService.create/update/duplicate/softDelete DIRECTLY — no Zod, no item.create
// permission, no createForOrg/applyEdit policy — and create() defaulted
// approval_status='approved', so an authenticated supplier could POST /api/items to
// self-approve an item in their own org, bypassing the ballpark-admin moderation gate
// (FR-00215). The v2 write surface is /api/store/items (owner) + /api/admin/items
// (moderation). Reads above stay for any v1 consumer until the full v1 retirement.

module.exports = router;
