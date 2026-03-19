const router = require('express').Router();
const UserService = require('../services/user.service');

router.get('/', async (req, res, next) => {
  try { res.json(await UserService.getAll()); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await UserService.getById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await UserService.create(req.body)); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const user = await UserService.update(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const user = await UserService.softDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;
