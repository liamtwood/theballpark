const router = require('express').Router();
const EstimateService = require('../services/estimate.service');

router.get('/', async (req, res, next) => {
  try { res.json(await EstimateService.getAll(req.query.project_id)); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const estimate = await EstimateService.getById(req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Not found' });
    res.json(estimate);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await EstimateService.create(req.body)); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const estimate = await EstimateService.update(req.params.id, req.body);
    if (!estimate) return res.status(404).json({ error: 'Not found' });
    res.json(estimate);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const estimate = await EstimateService.softDelete(req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Not found' });
    res.json(estimate);
  } catch (err) { next(err); }
});

module.exports = router;
