const router = require('express').Router();
const { z } = require('zod');
const FeedbackService = require('../services/feedback.service');
const { authenticate } = require('../middleware/authenticate');
const { FeedbackCreateSchema } = require('../schemas/feedback-create.schema');

// GET /api/feedback/mine — the signed-in user's own issues (My issues table).
// JWT-derived scope: submitted_by = req.user.id, NEVER a client-supplied id
// (same rule as org_id). Must precede GET /:id.
router.get('/mine', authenticate, async (req, res, next) => {
  try { res.json(await FeedbackService.listByUser(req.user.id)); } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await FeedbackService.getAll({
      object_type: req.query.object_type,
      priority: req.query.priority,
      target_version: req.query.target_version
    }));
  } catch (err) { next(err); }
});

router.get('/categories', async (req, res, next) => {
  try { res.json(await FeedbackService.getCategories(req.query.namespace)); } catch (err) { next(err); }
});

router.post('/categories', async (req, res, next) => {
  try { res.status(201).json(await FeedbackService.createCategory(req.body)); } catch (err) { next(err); }
});

router.patch('/categories/:id', async (req, res, next) => {
  try {
    const cat = await FeedbackService.patchCategory(req.params.id, req.body);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    res.json(cat);
  } catch (err) { next(err); }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    await FeedbackService.removeCategory(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/today', async (req, res, next) => {
  try { res.json(await FeedbackService.getToday()); } catch (err) { next(err); }
});

router.get('/versions', async (req, res, next) => {
  try { res.json(await FeedbackService.getVersions()); } catch (err) { next(err); }
});

router.get('/folders', async (req, res, next) => {
  try { res.json(await FeedbackService.getFolders()); } catch (err) { next(err); }
});

router.get('/issues', async (req, res, next) => {
  try { res.json(await FeedbackService.getIssues(req.query.folder_id)); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const entry = await FeedbackService.getById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
  } catch (err) { next(err); }
});

router.get('/:id/children', async (req, res, next) => {
  try { res.json(await FeedbackService.getChildren(req.params.id, req.query.type)); } catch (err) { next(err); }
});

router.get('/:id/issues', async (req, res, next) => {
  try { res.json(await FeedbackService.getIssues(req.params.id)); } catch (err) { next(err); }
});

// Create a feedback issue (Report an issue dialog). SECURED: submitted_by +
// environment are set server-side from the JWT/config, never the body; the body
// is Zod-validated to the safe fields only (privileged fields stripped).
router.post('/', authenticate, async (req, res, next) => {
  try {
    const parsed = FeedbackCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid feedback', details: z.flattenError(parsed.error).fieldErrors });
    }
    const created = await FeedbackService.create({
      ...parsed.data,
      object_type: 'issue',
      submitted_by: req.user.id, // JWT identity — never the body
      environment: process.env.APP_SCHEMA || 'public',
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const entry = await FeedbackService.patch(req.params.id, req.body);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await FeedbackService.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
