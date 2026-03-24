const express = require('express');
const router = express.Router();
const FavouriteService = require('../services/favourite.service');

// GET /api/favourites?org_id=xxx&type=supplier|item
router.get('/', async (req, res, next) => {
  try {
    const { org_id, type } = req.query;
    if (!org_id) return res.status(400).json({ error: 'org_id required' });
    let favs = await FavouriteService.getAll(org_id);
    if (type) favs = favs.filter(f => f.type === type);
    res.json(favs);
  } catch (err) { next(err); }
});

// GET /api/favourites/ids?org_id=xxx&type=supplier|item
router.get('/ids', async (req, res, next) => {
  try {
    const { org_id, type } = req.query;
    if (!org_id || !type) return res.status(400).json({ error: 'org_id and type required' });
    const ids = await FavouriteService.getFavouritedIds(org_id, type);
    res.json(ids);
  } catch (err) { next(err); }
});

// POST /api/favourites/toggle
router.post('/toggle', async (req, res, next) => {
  try {
    const { org_id, type, ref_id } = req.body;
    if (!org_id || !type || !ref_id) return res.status(400).json({ error: 'org_id, type, ref_id required' });
    const result = await FavouriteService.toggle(org_id, type, ref_id);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
