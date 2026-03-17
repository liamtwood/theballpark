const router = require('express').Router();
const pool = require('../db/pool');

// GET / - list balls_transactions (filter by org_id)
router.get('/', async (req, res) => {
  try {
    const { org_id } = req.query;
    let query = 'SELECT * FROM balls_transactions WHERE 1=1';
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

// POST / - create transaction and update org balls_balance
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { org_id, project_id, estimate_id, supplier_org_id, user_id, amount, direction, reason, description } = req.body;

    const txResult = await client.query(
      `INSERT INTO balls_transactions (org_id, project_id, estimate_id, supplier_org_id, user_id, amount, direction, reason, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [org_id, project_id, estimate_id, supplier_org_id, user_id, amount, direction, reason, description]
    );

    // Update org balance: credit adds, debit subtracts
    const delta = direction === 'credit' ? amount : -amount;
    await client.query(
      'UPDATE orgs SET balls_balance = balls_balance + $1, updated_at = NOW() WHERE id = $2',
      [delta, org_id]
    );

    await client.query('COMMIT');
    res.status(201).json(txResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
