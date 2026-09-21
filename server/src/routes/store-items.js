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

const { z } = require('zod');
const router = require('express').Router();
const { requireActiveMembership } = require('../middleware/require-active-membership');
const ItemService = require('../services/item.service');
const { StoreItemCreateSchema, StoreItemUpdateSchema } = require('../schemas/store-item.schema');

router.use(requireActiveMembership('item.create'));

// GET /api/store/items/counts — status rollup for the caller's org, feeding the
// supplier home "Next steps" (drafts to submit, rejected to fix, approved-but-
// inactive ready to promote). MUST precede GET /:id. org from JWT.
router.get('/counts', async (req, res, next) => {
  try {
    res.json(await ItemService.statusCountsForOrg(req.user.org_id));
  } catch (err) { next(err); }
});

// pV2-BUILDUP-03 — an item's composition (options/components): child items via
// parent_item_id. Same shape the Customize UI already consumes.
const ItemComponentsSchema = z.object({
  components: z.array(z.object({
    id: z.string().uuid().optional(),
    categoryId: z.string().uuid().nullish(),
    name: z.string().trim().min(1),
    cost: z.number().nonnegative().nullish(),
    unit: z.string().nullish(),
    kind: z.string().max(20).nullish(),
    description: z.string().nullish(),
    image: z.string().max(2_800_000).nullish(),
  })),
  parentName: z.string().trim().min(1).max(200).optional(),
  parentDescription: z.string().max(4000).nullish(),
  parentServices: z.string().max(4000).nullish(),
}).strip();

router.get('/:id/components', async (req, res, next) => {
  try {
    const out = await ItemService.listComponents(req.user.org_id, req.params.id);
    if (out === null) return res.status(404).json({ error: 'Not found' });
    res.json(out);
  } catch (err) { next(err); }
});

router.post('/:id/components', async (req, res, next) => {
  try {
    const parsed = ItemComponentsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const rows = await ItemService.saveComponents(
      req.user.org_id, req.params.id, parsed.data.components,
      parsed.data.parentName, parsed.data.parentDescription, parsed.data.parentServices
    );
    if (rows === null) return res.status(404).json({ error: 'Not found' });
    res.status(201).json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await ItemService.getById(req.params.id);
    // 404 (not 403) on a cross-org id — no existence oracle (ENGINEERING Rule 10).
    if (!item || item.deleted_at || item.org_id !== req.user.org_id) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(item);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = StoreItemCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid item' });
    }
    // org_id is SESSION-ONLY here (never the body); the shared write-policy +
    // auto-classify live in item.service.createForOrg (one definition).
    const item = await ItemService.createForOrg({
      data: parsed.data,
      orgId: req.user.org_id,
      defaultStatus: 'draft',
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await ItemService.getById(req.params.id);
    // 404 (not 403) on a cross-org id — no existence oracle (ENGINEERING Rule 10).
    if (!existing || existing.deleted_at || existing.org_id !== req.user.org_id) {
      return res.status(404).json({ error: 'Not found' });
    }
    const parsed = StoreItemUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid item' });
    }
    // Shared edit policy (approved-lock vs re-enter draft/pending) in one place.
    const item = await ItemService.applyEdit(existing, parsed.data, { defaultStatus: 'draft' });
    res.json(item);
  } catch (err) { next(err); }
});

/** Resolve the caller's OWN, non-deleted item, else send 404 and return null.
 *  Cross-org ids 404 (not 403) — no existence oracle (ENGINEERING Rule 10). */
async function ownItemOr(res, id, orgId) {
  const item = await ItemService.getById(id);
  if (!item || item.deleted_at || item.org_id !== orgId) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return item;
}

// PATCH /api/store/items/:id/active — publish/hide toggle (is_active only;
// approval_status untouched, unlike the edit PUT which re-enters review).
router.patch('/:id/active', async (req, res, next) => {
  try {
    if (typeof req.body?.is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active (boolean) is required' });
    }
    const existing = await ownItemOr(res, req.params.id, req.user.org_id);
    if (!existing) return;
    // Only an APPROVED item may go live — a draft/pending/rejected item can't be
    // made available for purchase. (Deactivating is always allowed.)
    if (req.body.is_active === true && existing.approval_status !== 'approved') {
      return res.status(409).json({ error: 'Only approved items can be activated' });
    }
    const item = await ItemService.update(req.params.id, { is_active: req.body.is_active });
    res.json(item);
  } catch (err) { next(err); }
});

// POST /api/store/items/:id/duplicate — clone the item (lands draft + hidden).
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    if (!(await ownItemOr(res, req.params.id, req.user.org_id))) return;
    const copy = await ItemService.duplicate(req.params.id);
    if (!copy) return res.status(404).json({ error: 'Not found' });
    res.status(201).json(copy);
  } catch (err) { next(err); }
});

// DELETE /api/store/items/:id — soft delete (deleted_at; hard delete is
// trigger-forbidden). Recoverable in the DB.
router.delete('/:id', async (req, res, next) => {
  try {
    if (!(await ownItemOr(res, req.params.id, req.user.org_id))) return;
    await ItemService.softDelete(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
