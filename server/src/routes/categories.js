const router = require('express').Router();
const CategoryService = require('../services/category.service');

router.get('/', async (req, res, next) => {
  try { res.json(await CategoryService.getAll()); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const cat = await CategoryService.getById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    res.json(cat);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await CategoryService.create(req.body)); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const cat = await CategoryService.update(req.params.id, req.body);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    res.json(cat);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const cat = await CategoryService.softDelete(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    res.json(cat);
  } catch (err) { next(err); }
});

module.exports = router;
