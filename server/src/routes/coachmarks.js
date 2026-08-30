// Coachmarks — help-bubble content. Mounted on the gated v2 router
// (`v2.use('/coachmarks', …)`), so every route already requires an active
// member. Read/resolve is member-level; list + edit are ballpark-admin only.
//
//   POST  /api/coachmarks/resolve   → register-if-missing + read (any member)
//   GET   /api/coachmarks           → list all (admins)
//   PATCH /api/coachmarks/:id       → edit description / active / tail (admins)
const router = require('express').Router();
const { z } = require('zod');
const { requireActiveMembership } = require('../middleware/require-active-membership');
const Coachmarks = require('../services/coachmark.service');
const { ResolveSchema, PatchSchema } = require('../schemas/coachmark.schema');

const admin = requireActiveMembership('admin.cross_org_view');

router.post('/resolve', async (req, res, next) => {
  try {
    const parsed = ResolveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const { page, name, description, tail } = parsed.data;
    res.json(await Coachmarks.resolve(page, name, description ?? null, tail ?? null));
  } catch (err) { next(err); }
});

router.get('/', admin, async (req, res, next) => {
  try { res.json(await Coachmarks.list()); } catch (err) { next(err); }
});

router.patch('/:id', admin, async (req, res, next) => {
  try {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const row = await Coachmarks.update(req.params.id, parsed.data);
    if (!row) return res.status(404).json({ error: 'Coachmark not found' });
    res.json(row);
  } catch (err) { next(err); }
});

module.exports = router;
