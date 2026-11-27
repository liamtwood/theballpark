// pV2-ADDONS-02 Stage 1 — supplier-facing Collections. Mounted on the gated v2 router
// at /api/store/collections (inherits authenticate + active membership). Every op is
// scoped to the caller's own org (org_id from the SESSION, never the body).
//
//   GET  /api/store/collections            → the org's collections (picklist)
//   POST /api/store/collections { name }   → create/revive a collection
//   GET  /api/store/collections/item/:id   → an item's current collections
//   PUT  /api/store/collections/item/:id   → set an item's collection memberships
const router = require('express').Router();
const { z } = require('zod');
const { requireActiveMembership } = require('../middleware/require-active-membership');
const CollectionService = require('../services/collection.service');
const ItemService = require('../services/item.service');

router.use(requireActiveMembership('item.create'));

router.get('/', async (req, res, next) => {
  try { res.json(await CollectionService.listForOrg(req.user.org_id)); } catch (err) { next(err); }
});

const CreateSchema = z.object({ name: z.string().trim().min(1).max(80) });
router.post('/', async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'A collection name is required' });
    const c = await CollectionService.create(req.user.org_id, parsed.data.name);
    res.status(201).json(c);
  } catch (err) { next(err); }
});

// Resolve the caller's OWN, non-deleted item (cross-org id → 404, no existence oracle).
async function ownItemOr(res, id, orgId) {
  const item = await ItemService.getById(id);
  if (!item || item.deleted_at || item.org_id !== orgId) { res.status(404).json({ error: 'Not found' }); return null; }
  return item;
}

router.get('/item/:id', async (req, res, next) => {
  try {
    const item = await ownItemOr(res, req.params.id, req.user.org_id);
    if (!item) return;
    res.json(await CollectionService.getItemCollections(item.id)); // resolved UUID, not a BPIN
  } catch (err) { next(err); }
});

// POST /api/store/collections/assign { collectionIds, itemIds } — bulk-add own items
// to own collections (the Reclassify dialog's collection action).
const AssignSchema = z.object({
  collectionIds: z.array(z.string().max(64)).min(1).max(50),
  itemIds: z.array(z.string().max(64)).min(1).max(500),
});
router.post('/assign', async (req, res, next) => {
  try {
    const parsed = AssignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid assignment' });
    res.json(await CollectionService.addItemsToCollections(req.user.org_id, parsed.data.collectionIds, parsed.data.itemIds));
  } catch (err) { next(err); }
});

// POST /api/store/collections/related/assign { collectionIds, itemIds } — bulk-point own items
// at own collections as Related items (the Reclassify dialog's related action).
router.post('/related/assign', async (req, res, next) => {
  try {
    const parsed = AssignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid assignment' });
    res.json(await CollectionService.addItemsToRelated(req.user.org_id, parsed.data.collectionIds, parsed.data.itemIds));
  } catch (err) { next(err); }
});

const SetSchema = z.object({ collectionIds: z.array(z.string().max(64)).max(50) });
router.put('/item/:id', async (req, res, next) => {
  try {
    const item = await ownItemOr(res, req.params.id, req.user.org_id);
    if (!item) return;
    const parsed = SetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid collections' });
    const collectionIds = await CollectionService.setItemCollections(item.id, req.user.org_id, parsed.data.collectionIds);
    res.json({ collectionIds });
  } catch (err) { next(err); }
});

// Related items (pV2-ADDONS-02) — the item POINTS AT a collection it is NOT a member of.
// Same create/picklist (/ and /item above); only the junction differs.
//   GET /api/store/collections/related/item/:id → the item's Related-items links
//   PUT /api/store/collections/related/item/:id → set them
router.get('/related/item/:id', async (req, res, next) => {
  try {
    const item = await ownItemOr(res, req.params.id, req.user.org_id);
    if (!item) return;
    res.json(await CollectionService.getItemRelated(item.id));
  } catch (err) { next(err); }
});
router.put('/related/item/:id', async (req, res, next) => {
  try {
    const item = await ownItemOr(res, req.params.id, req.user.org_id);
    if (!item) return;
    const parsed = SetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid collections' });
    const collectionIds = await CollectionService.setItemRelated(item.id, req.user.org_id, parsed.data.collectionIds);
    res.json({ collectionIds });
  } catch (err) { next(err); }
});

module.exports = router;
