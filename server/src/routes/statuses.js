const router = require('express').Router();
const pool = require('../db/pool');

// GET / - list all statuses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM statuses WHERE is_active = true ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get single status
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM statuses WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create status
router.post('/', async (req, res) => {
  try {
    const { entity_type, name, description, label, color, sort_order } = req.body;
    const result = await pool.query(
      `INSERT INTO statuses (entity_type, name, description, label, color, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [entity_type, name, description, label, color, sort_order]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update status
router.put('/:id', async (req, res) => {
  try {
    const { entity_type, name, description, label, color, sort_order } = req.body;
    const result = await pool.query(
      `UPDATE statuses SET
        entity_type = COALESCE($1, entity_type),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        label = COALESCE($4, label),
        color = COALESCE($5, color),
        sort_order = COALESCE($6, sort_order),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [entity_type, name, description, label, color, sort_order, req.params.id]
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
      'UPDATE statuses SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
