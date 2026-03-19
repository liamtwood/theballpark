const router = require('express').Router();
const StatusService = require('../services/status.service');

router.get('/', async (req, res, next) => {
  try { res.json(await StatusService.getAll()); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const status = await StatusService.getById(req.params.id);
    if (!status) return res.status(404).json({ error: 'Not found' });
    res.json(status);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await StatusService.create(req.body)); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const status = await StatusService.update(req.params.id, req.body);
    if (!status) return res.status(404).json({ error: 'Not found' });
    res.json(status);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const status = await StatusService.softDelete(req.params.id);
    if (!status) return res.status(404).json({ error: 'Not found' });
    res.json(status);
  } catch (err) { next(err); }
});

module.exports = router;
