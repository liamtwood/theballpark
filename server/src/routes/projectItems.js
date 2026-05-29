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

// v1.65f2 → v1.65fA — PATCH /api/project-items/:projectId/:itemId
// Body may include any subset of:
//   { name, base_price, unit, description, quantity }
// Patches the project_items snapshot row. Provided fields overwrite,
// undefined fields stay as they were. Money-relevant changes
// (base_price / unit / quantity) trigger a ballpark recompute server-
// side so the Estimate panel + Overview cards stay current.
router.patch('/:projectId/:itemId', async (req, res, next) => {
  try {
    const allowed = ['name', 'base_price', 'unit', 'description', 'quantity'];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        error: 'At least one of name/base_price/unit/description/quantity is required'
      });
    }
    const updated = await ProjectItemService.update(
      req.params.projectId, req.params.itemId, patch
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

// v1.65fH — per-cart-item supplier roster.
// POST   /api/project-items/:projectId/:itemId/suppliers     body { supplier_org_id }
// DELETE /api/project-items/:projectId/:itemId/suppliers/:supplierId
router.post('/:projectId/:itemId/suppliers', async (req, res, next) => {
  try {
    const list = await ProjectItemService.addItemSupplier(
      req.params.projectId, req.params.itemId, req.body.supplier_org_id
    );
    res.status(201).json({ supplier_org_ids: list });
  } catch (err) { next(err); }
});
router.delete('/:projectId/:itemId/suppliers/:supplierId', async (req, res, next) => {
  try {
    const list = await ProjectItemService.removeItemSupplier(
      req.params.projectId, req.params.itemId, req.params.supplierId
    );
    res.json({ supplier_org_ids: list });
  } catch (err) { next(err); }
});

module.exports = router;
