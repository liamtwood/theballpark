// pV2-STORE-01 — the supplier-facing item editor. Mounted on the gated v2
// router (/api/store/items), so it inherits authenticate + active-membership;
// here we additionally require the `item.create` permission and scope every
// row to the caller's own org. org_id NEVER comes from the body.
//
//   GET  /api/store/items/:id   → the caller's own item (full row), for editing
//   POST /api/store/items       → create a draft/pending item for the org
//   PUT  /api/store/items/:id   → update the caller's own item
//
// Supplier-set status is restricted to draft|pending (schema); is_active is
// forced false — an item only goes live when a ballpark admin approves it
// (that transition lands on a separate admin-gated route).

const router = require('express').Router();
const { requireActiveMembership } = require('../middleware/require-active-membership');
const ItemService = require('../services/item.service');
const { StoreItemCreateSchema, StoreItemUpdateSchema } = require('../schemas/store-item.schema');

router.use(requireActiveMembership('item.create'));

router.get('/:id', async (req, res, next) => {
  try {
    const item = await ItemService.getById(req.params.id);
    if (!item || item.deleted_at) return res.status(404).json({ error: 'Not found' });
    if (item.org_id !== req.user.org_id) return res.status(403).json({ error: 'Not your item' });
    res.json(item);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = StoreItemCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid item' });
    }
    const item = await ItemService.create({
      ...parsed.data,
      org_id: req.user.org_id,      // sacred — session only, never the body
      // pV2-STORE-01 (Liam): active by default for now — products go live on
      // save. The draft→submit→approve moderation flow returns in a later slice.
      approval_status: 'approved',
      is_active: true,
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await ItemService.getById(req.params.id);
    if (!existing || existing.deleted_at) return res.status(404).json({ error: 'Not found' });
    if (existing.org_id !== req.user.org_id) return res.status(403).json({ error: 'Not your item' });
    const parsed = StoreItemUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid item' });
    }
    // Active by default for now — edits stay live (re-review returns later).
    const item = await ItemService.update(req.params.id, {
      ...parsed.data,
      approval_status: 'approved',
      is_active: true,
    });
    res.json(item);
  } catch (err) { next(err); }
});

module.exports = router;
