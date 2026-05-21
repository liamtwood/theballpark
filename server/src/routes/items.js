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
      req.query.tag,
      req.query.subcategory_id
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

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await ItemService.create(req.body)); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const item = await ItemService.update(req.params.id, req.body);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const item = await ItemService.softDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) { next(err); }
});

module.exports = router;
