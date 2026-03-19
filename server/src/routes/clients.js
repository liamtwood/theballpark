const router = require('express').Router();
const ClientService = require('../services/client.service');

router.get('/', async (req, res, next) => {
  try { res.json(await ClientService.getAll(req.query.org_id)); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const client = await ClientService.getById(req.params.id);
    if (!client) return res.status(404).json({ error: 'Not found' });
    res.json(client);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await ClientService.create(req.body)); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const client = await ClientService.update(req.params.id, req.body);
    if (!client) return res.status(404).json({ error: 'Not found' });
    res.json(client);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const client = await ClientService.softDelete(req.params.id);
    if (!client) return res.status(404).json({ error: 'Not found' });
    res.json(client);
  } catch (err) { next(err); }
});

module.exports = router;
