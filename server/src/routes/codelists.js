const router = require('express').Router();
const CodelistService = require('../services/codelist.service');

// Admin: list all distinct list_names
router.get('/admin', async (req, res, next) => {
  try { res.json(await CodelistService.getAll()); } catch (err) { next(err); }
});

// Admin: create a new code in a list
router.post('/admin/:listName', async (req, res, next) => {
  try {
    const created = await CodelistService.create(req.params.listName, req.body);
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// Admin: update a code by id
router.patch('/admin/:id', async (req, res, next) => {
  try {
    const updated = await CodelistService.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

// Admin: delete a code by id (blocked for is_system rows)
router.delete('/admin/:id', async (req, res, next) => {
  try {
    const removed = await CodelistService.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json(removed);
  } catch (err) { next(err); }
});

// Public: read a list by name (used in dropdowns, no auth)
router.get('/:listName', async (req, res, next) => {
  try { res.json(await CodelistService.getByName(req.params.listName)); } catch (err) { next(err); }
});

module.exports = router;
