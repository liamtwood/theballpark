const router = require('express').Router();
const pool = require('../db/pool');

// GET / - list all estimates (filter by project_id)
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    let query = `SELECT e.*, s.name as status_name, s.color as status_color
FROM estimates e
LEFT JOIN statuses s ON e.status_id = s.id
WHERE e.is_active = true`;
    const params = [];
    if (project_id) {
      params.push(project_id);
      query += ` AND e.project_id = $${params.length}`;
    }
    query += ' ORDER BY e.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get single estimate
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM estimates WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create estimate
router.post('/', async (req, res) => {
  try {
    const { project_id, name, description, version, total_value, balls_cost, status_id } = req.body;
    const result = await pool.query(
      `INSERT INTO estimates (project_id, name, description, version, total_value, balls_cost, status_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [project_id, name, description, version || 1, total_value || 0, balls_cost || 1, status_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update estimate
router.put('/:id', async (req, res) => {
  try {
    const { name, description, version, total_value, balls_cost, status_id } = req.body;
    const result = await pool.query(
      `UPDATE estimates SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        version = COALESCE($3, version),
        total_value = COALESCE($4, total_value),
        balls_cost = COALESCE($5, balls_cost),
        status_id = COALESCE($6, status_id),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [name, description, version, total_value, balls_cost, status_id, req.params.id]
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
      'UPDATE estimates SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
