const router = require('express').Router();
const pool = require('../db/pool');

// GET / - list messages (filter by project_id)
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    let query = `SELECT m.*, u.name as sender_name
FROM messages m
LEFT JOIN users u ON m.user_id = u.id
WHERE 1=1`;
    const params = [];
    if (project_id) {
      params.push(project_id);
      query += ` AND m.project_id = $${params.length}`;
    }
    query += ' ORDER BY m.created_at ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get single message
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM messages WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create message
router.post('/', async (req, res) => {
  try {
    const { project_id, user_id, supplier_org_id, estimate_item_id, subject, body, direction, status_id } = req.body;
    const result = await pool.query(
      `INSERT INTO messages (project_id, user_id, supplier_org_id, estimate_item_id, subject, body, direction, status_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [project_id, user_id, supplier_org_id, estimate_item_id, subject, body, direction, status_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update message
router.put('/:id', async (req, res) => {
  try {
    const { subject, body, direction, status_id } = req.body;
    const result = await pool.query(
      `UPDATE messages SET
        subject = COALESCE($1, subject),
        body = COALESCE($2, body),
        direction = COALESCE($3, direction),
        status_id = COALESCE($4, status_id),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [subject, body, direction, status_id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - hard delete (no is_active column on messages)
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM messages WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
