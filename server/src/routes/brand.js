const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/brand — returns all brand config as a flat key/value map.
// Public (no auth) so the login page can apply brand tokens before sign-in.
// Read by client-v2's BrandConfigService at bootstrap (pV2-01e).
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT key, value FROM bp_brand_config ORDER BY key'
    );
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json(map);
  } catch (err) { next(err); }
});

module.exports = router;
