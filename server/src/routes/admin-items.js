// pV2-STORE-01 — ballpark-admin item moderation. Mounted at /api/admin (which
// is gated by authenticate + requireActiveMembership('admin.cross_org_view')),
// so every route here is already restricted to platform admins. Cross-org by
// design — an admin reviews ANY supplier's item.
//
//   GET /api/admin/items/:id            → any item (full row), for review
//   PUT /api/admin/items/:id/approval   → { decision: 'approve' | 'reject' }
//
// approve → approved + INACTIVE (NOT auto-published — the supplier activates it
// themselves to make it available for purchase); reject → rejected + inactive.
// The supplier resubmits from their own editor (draft → pending) to re-queue.

const router = require('express').Router();
const { z } = require('zod');
const ItemService = require('../services/item.service');
const BulkService = require('../services/item-bulk.service');
const CatalogueExtract = require('../services/catalogue-extract.service');
const { withModeration } = require('../lib/moderation');
const { AdminBulkSchema } = require('../schemas/bulk-items.schema');

const DecisionSchema = z.object({ decision: z.enum(['approve', 'reject']) }).strip();

// POST /api/admin/items/bulk — cross-org moderation bulk (pV2-ITEM-BULK-ACTIONS-01).
// approve/reject/delete run through the svc_moderate escape (0017-guarded to
// approval_status/deleted_at); refresh-images starts a background job (is_admin READ +
// the narrow svc_refresh images-only WRITE). make-active/reclassify are NOT here —
// FR-00215 reserves content-authoring to the owner org. MUST precede GET /items/:id.
router.post('/items/bulk', async (req, res, next) => {
  try {
    const parsed = AdminBulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request' });
    }
    const { ids, action } = parsed.data;
    if (action === 'refresh-images') {
      const job = await CatalogueExtract.startRefreshImages(req.user.org_id, ids, { isAdmin: true, userId: req.user.id });
      return res.status(202).json({ action, ...job });
    }
    res.json(await BulkService.adminBulk({ ids, action }));
  } catch (err) {
    if (err.code === 'refresh_in_progress') return res.status(409).json({ error: err.message, jobId: err.jobId });
    next(err);
  }
});

// GET /api/admin/items/bulk/refresh/:jobId — poll the admin refresh-images job. The
// job row is scoped to the admin's own org (the actor), so getJob keys on req.user.org_id.
router.get('/items/bulk/refresh/:jobId', async (req, res, next) => {
  try {
    const job = await CatalogueExtract.getJob(req.params.jobId, req.user.org_id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) { next(err); }
});

router.get('/items/:id', async (req, res, next) => {
  try {
    const item = await ItemService.getById(req.params.id);
    if (!item || item.deleted_at) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) { next(err); }
});

router.put('/items/:id/approval', async (req, res, next) => {
  try {
    const parsed = DecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid decision' });
    }
    const existing = await ItemService.getById(req.params.id);
    if (!existing || existing.deleted_at) return res.status(404).json({ error: 'Not found' });
    const approve = parsed.data.decision === 'approve';
    // Approval does NOT publish — it sets the status to approved and leaves the
    // item INACTIVE. The supplier then chooses to activate it (make it available
    // for purchase) via the store. Reject also stays inactive.
    // FR-00215 — cross-org moderation write: admin holds no seat in the item's org,
    // so the write runs under the scoped app.svc_moderate escape (only approval_status
    // is touched; RLS keeps everything else current-org-only). status stays 'new'
    // from create — the supplier activates (status→'active') to make it live.
    const item = await withModeration(() => ItemService.update(req.params.id, {
      approval_status: approve ? 'approved' : 'rejected',
    }));
    res.json(item);
  } catch (err) { next(err); }
});

module.exports = router;
