const router = require('express').Router();
const pool = require('../db/pool');

// GET / - list all clients (filter by org_id)
router.get('/', async (req, res) => {
  try {
    const { org_id } = req.query;
    let query = 'SELECT * FROM clients WHERE is_active = true';
    const params = [];
    if (org_id) {
      params.push(org_id);
      query += ` AND org_id = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get single client
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clients WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create client
router.post('/', async (req, res) => {
  try {
    const { org_id, name, description, contact_name, email, phone, address } = req.body;
    const result = await pool.query(
      `INSERT INTO clients (org_id, name, description, contact_name, email, phone, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [org_id, name, description, contact_name, email, phone, address]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update client
router.put('/:id', async (req, res) => {
  try {
    const { org_id, name, description, contact_name, email, phone, address } = req.body;
    const result = await pool.query(
      `UPDATE clients SET
        org_id = COALESCE($1, org_id),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        contact_name = COALESCE($4, contact_name),
        email = COALESCE($5, email),
        phone = COALESCE($6, phone),
        address = COALESCE($7, address),
        updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [org_id, name, description, contact_name, email, phone, address, req.params.id]
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
      'UPDATE clients SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
