const router = require('express').Router();
const FeedbackService = require('../services/feedback.service');

router.get('/', async (req, res, next) => {
  try { res.json(await FeedbackService.getAll(req.query.object_type)); } catch (err) { next(err); }
});

router.get('/today', async (req, res, next) => {
  try { res.json(await FeedbackService.getToday()); } catch (err) { next(err); }
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
  try { res.json(await FeedbackService.getChildren(req.params.id)); } catch (err) { next(err); }
});

router.get('/:id/issues', async (req, res, next) => {
  try { res.json(await FeedbackService.getIssues(req.params.id)); } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await FeedbackService.create(req.body)); } catch (err) { next(err); }
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
