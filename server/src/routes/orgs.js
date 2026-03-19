const router = require('express').Router();
const OrgService = require('../services/org.service');

router.get('/', async (req, res, next) => {
  try { res.json(await OrgService.getAll()); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const org = await OrgService.getById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Not found' });
    res.json(org);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await OrgService.create(req.body)); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const org = await OrgService.update(req.params.id, req.body);
    if (!org) return res.status(404).json({ error: 'Not found' });
    res.json(org);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const org = await OrgService.softDelete(req.params.id);
    if (!org) return res.status(404).json({ error: 'Not found' });
    res.json(org);
  } catch (err) { next(err); }
});

module.exports = router;
