const router = require('express').Router();
const pool = require('../db/pool');

// GET / - list all categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories WHERE is_active = true ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get single category
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create category
router.post('/', async (req, res) => {
  try {
    const { name, description, icon, sort_order } = req.body;
    const result = await pool.query(
      'INSERT INTO categories (name, description, icon, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, icon, sort_order]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update category
router.put('/:id', async (req, res) => {
  try {
    const { name, description, icon, sort_order } = req.body;
    const result = await pool.query(
      `UPDATE categories SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        icon = COALESCE($3, icon),
        sort_order = COALESCE($4, sort_order),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, description, icon, sort_order, req.params.id]
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
      'UPDATE categories SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
