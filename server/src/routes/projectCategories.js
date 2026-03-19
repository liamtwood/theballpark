const router = require('express').Router();
const ProjectCategoryService = require('../services/project-category.service');

router.get('/', async (req, res, next) => {
  try { res.json(await ProjectCategoryService.getAll(req.query.project_id)); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const pc = await ProjectCategoryService.getById(req.params.id);
    if (!pc) return res.status(404).json({ error: 'Not found' });
    res.json(pc);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await ProjectCategoryService.create(req.body)); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const pc = await ProjectCategoryService.update(req.params.id, req.body);
    if (!pc) return res.status(404).json({ error: 'Not found' });
    res.json(pc);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const pc = await ProjectCategoryService.softDelete(req.params.id);
    if (!pc) return res.status(404).json({ error: 'Not found' });
    res.json(pc);
  } catch (err) { next(err); }
});

module.exports = router;
