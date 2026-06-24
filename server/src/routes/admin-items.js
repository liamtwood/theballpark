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

const DecisionSchema = z.object({ decision: z.enum(['approve', 'reject']) }).strip();

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
    const item = await ItemService.update(req.params.id, {
      approval_status: approve ? 'approved' : 'rejected',
      is_active: false,
    });
    res.json(item);
  } catch (err) { next(err); }
});

module.exports = router;
