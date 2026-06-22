/**
 * Admin marketing routes — guarded by requireAdmin middleware.
 *
 *   GET   /api/admin/signups
 *   GET   /api/admin/welcome/content
 *   PATCH /api/admin/welcome/content
 *   GET   /api/admin/welcome/settings
 *   PATCH /api/admin/welcome/settings
 *   POST  /api/admin/welcome/settings/test-email
 */

const router = require('express').Router();
const { requireAdmin } = require('../middleware/admin');
const MarketingService = require('../services/marketing.service');

router.use(requireAdmin);

router.get('/signups', async (req, res, next) => {
  try {
    // pV2-EA-02 — filter by source_environment (dev/preview/master/unknown).
    const envs = req.query.envs
      ? String(req.query.envs).split(',').map(s => s.trim()).filter(Boolean)
      : null;
    const result = await MarketingService.listSignups({
      q:      req.query.q || null,
      envs,
      sort:   req.query.sort || 'newest',
      limit:  Number(req.query.limit)  || 100,
      offset: Number(req.query.offset) || 0
    });
    res.json(result);
  } catch (err) { next(err); }
});

// v1.65gZ32 — soft-delete a signup. UUID id in the URL. Returns 404 if
// the row doesn't exist or was already deleted (idempotent on the
// caller's side — second click does nothing). Row stays in the table
// with deleted_at set; the partial unique-email index lets the same
// email sign up again afterwards.
router.delete('/signups/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const result = await MarketingService.softDeleteSignup(id);
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error });
    res.json(result.body);
  } catch (err) { next(err); }
});

router.get('/welcome/content', async (req, res, next) => {
  try { res.json(await MarketingService.getContentForAdmin()); }
  catch (err) { next(err); }
});

router.patch('/welcome/content', async (req, res, next) => {
  try {
    const updates = req.body?.updates;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Body must be { updates: [{ key, value }, ...] }' });
    }
    const count = await MarketingService.patchContent(updates, req.adminUserId);
    res.json({ updated: count });
  } catch (err) { next(err); }
});

router.get('/welcome/settings', async (req, res, next) => {
  try { res.json(await MarketingService.getSettings()); }
  catch (err) { next(err); }
});

router.patch('/welcome/settings', async (req, res, next) => {
  try {
    const updated = await MarketingService.updateSettings(req.body || {}, req.adminUserId);
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/welcome/settings/test-email', async (req, res, next) => {
  try {
    const { recipients, subject, body_template } = req.body || {};
    const result = await MarketingService.sendTestEmail({ recipients, subject, body_template });
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
