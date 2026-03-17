const router = require('express').Router();
const pool = require('../db/pool');

// GET / - list all users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get single user
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create user
router.post('/', async (req, res) => {
  try {
    const { org_id, name, description, email, role, avatar_url } = req.body;
    const result = await pool.query(
      `INSERT INTO users (org_id, name, description, email, role, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [org_id, name, description, email, role, avatar_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update user
router.put('/:id', async (req, res) => {
  try {
    const { org_id, name, description, email, role, avatar_url } = req.body;
    const result = await pool.query(
      `UPDATE users SET
        org_id = COALESCE($1, org_id),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        email = COALESCE($4, email),
        role = COALESCE($5, role),
        avatar_url = COALESCE($6, avatar_url),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [org_id, name, description, email, role, avatar_url, req.params.id]
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
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
