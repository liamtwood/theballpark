const router = require('express').Router();
const ProjectService = require('../services/project.service');

router.get('/', async (req, res, next) => {
  try {
    const projects = await ProjectService.getAll(req.query.org_id);
    res.json(projects);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await ProjectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const project = await ProjectService.create(req.body);
    res.status(201).json(project);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const project = await ProjectService.update(req.params.id, req.body);
    if (!project) return res.status(404).json({ error: 'Not found' });
    const updated = await ProjectService.recalcTotals(req.params.id);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const project = await ProjectService.softDelete(req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (err) { next(err); }
});

module.exports = router;
