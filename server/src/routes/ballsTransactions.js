const router = require('express').Router();
const BallsService = require('../services/balls.service');

router.get('/', async (req, res, next) => {
  try { res.json(await BallsService.getTransactions(req.query.org_id)); } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await BallsService.createTransaction(req.body)); } catch (err) { next(err); }
});

module.exports = router;
