const router = require('express').Router();
const MessageService = require('../services/message.service');

router.get('/', async (req, res, next) => {
  try { res.json(await MessageService.getAll(req.query.project_id)); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const msg = await MessageService.getById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    res.json(msg);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await MessageService.create(req.body)); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const msg = await MessageService.update(req.params.id, req.body);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    res.json(msg);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const msg = await MessageService.hardDelete(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    res.json(msg);
  } catch (err) { next(err); }
});

module.exports = router;
