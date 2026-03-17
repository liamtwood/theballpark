const router = require('express').Router();
const pool = require('../db/pool');

// GET / - list all items (filter by org_id, category_id)
router.get('/', async (req, res) => {
  try {
    const { org_id, category_id } = req.query;
    let query = 'SELECT * FROM items WHERE is_active = true';
    const params = [];
    if (org_id) {
      params.push(org_id);
      query += ` AND org_id = $${params.length}`;
    }
    if (category_id) {
      params.push(category_id);
      query += ` AND category_id = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get single item
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM items WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create item
router.post('/', async (req, res) => {
  try {
    const { org_id, category_id, name, description, unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier } = req.body;
    const result = await pool.query(
      `INSERT INTO items (org_id, category_id, name, description, unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [org_id, category_id, name, description, unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update item
router.put('/:id', async (req, res) => {
  try {
    const { org_id, category_id, name, description, unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier } = req.body;
    const result = await pool.query(
      `UPDATE items SET
        org_id = COALESCE($1, org_id),
        category_id = COALESCE($2, category_id),
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        unit = COALESCE($5, unit),
        base_price = COALESCE($6, base_price),
        min_price = COALESCE($7, min_price),
        max_price = COALESCE($8, max_price),
        lead_time_days = COALESCE($9, lead_time_days),
        coverage_area = COALESCE($10, coverage_area),
        tier = COALESCE($11, tier),
        updated_at = NOW()
       WHERE id = $12 RETURNING *`,
      [org_id, category_id, name, description, unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - soft delete
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE items SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
