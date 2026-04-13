const router = require('express').Router();
const FeedbackService = require('../services/feedback.service');

router.get('/', async (req, res, next) => {
  try { res.json(await FeedbackService.getAll()); } catch (err) { next(err); }
});

router.get('/:id/children', async (req, res, next) => {
  try { res.json(await FeedbackService.getChildren(req.params.id)); } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await FeedbackService.create(req.body)); } catch (err) { next(err); }
});

module.exports = router;
