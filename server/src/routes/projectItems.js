const router = require('express').Router();
const ProjectItemService = require('../services/project-item.service');

// GET /api/project-items?project_id=:id
router.get('/', async (req, res, next) => {
  try {
    if (!req.query.project_id) return res.status(400).json({ error: 'project_id required' });
    res.json(await ProjectItemService.getByProject(req.query.project_id));
  } catch (err) { next(err); }
});

// POST /api/project-items
// body: { project_id, item_id, project_category_id?, selection_type? }
router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await ProjectItemService.add(req.body));
  } catch (err) { next(err); }
});

// v1.65f2 — PATCH /api/project-items/:projectId/:itemId  body: { quantity }
// Updates the buy-quantity on a single cart row. Body keys other than
// `quantity` are ignored for now — selection_type / project_category_id
// are still upserted through POST. Recomputes category ballpark cost
// so the Estimate panel + Overview cards reflect the new total.
router.patch('/:projectId/:itemId', async (req, res, next) => {
  try {
    if (req.body.quantity === undefined) {
      return res.status(400).json({ error: 'quantity is required' });
    }
    const updated = await ProjectItemService.setQuantity(
      req.params.projectId, req.params.itemId, req.body.quantity
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/project-items/:projectId/:itemId
router.delete('/:projectId/:itemId', async (req, res, next) => {
  try {
    const removed = await ProjectItemService.remove(req.params.projectId, req.params.itemId);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json(removed);
  } catch (err) { next(err); }
});

module.exports = router;
