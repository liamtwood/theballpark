const router = require('express').Router();
const pool = require('../db/pool');

// Helper: recalculate parent estimate total_value
async function recalcEstimateTotal(estimateId) {
  const totals = await pool.query(
    `SELECT COALESCE(SUM(total_price), 0) AS total_value
     FROM estimate_items
     WHERE estimate_id = $1`,
    [estimateId]
  );
  await pool.query(
    'UPDATE estimates SET total_value = $1, updated_at = NOW() WHERE id = $2',
    [totals.rows[0].total_value, estimateId]
  );
}

// GET / - list estimate_items (filter by estimate_id)
router.get('/', async (req, res) => {
  try {
    const { estimate_id } = req.query;
    let query = 'SELECT * FROM estimate_items WHERE 1=1';
    const params = [];
    if (estimate_id) {
      params.push(estimate_id);
      query += ` AND estimate_id = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get single estimate_item
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM estimate_items WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create estimate_item (calculate total_price)
router.post('/', async (req, res) => {
  try {
    const { estimate_id, project_category_id, item_id, name, description, quantity, unit_price, supplier_org_id, shortlisted, status_id } = req.body;
    const qty = parseFloat(quantity) || 1;
    const price = parseFloat(unit_price) || 0;
    const total_price = qty * price;

    const result = await pool.query(
      `INSERT INTO estimate_items (estimate_id, project_category_id, item_id, name, description, quantity, unit_price, total_price, supplier_org_id, shortlisted, status_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [estimate_id, project_category_id, item_id, name, description, qty, price, total_price, supplier_org_id, shortlisted || false, status_id]
    );

    // Recalculate parent estimate total
    await recalcEstimateTotal(estimate_id);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update estimate_item (recalculate total_price)
router.put('/:id', async (req, res) => {
  try {
    // Fetch existing to merge
    const existing = await pool.query(
      'SELECT * FROM estimate_items WHERE id = $1',
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });

    const merged = { ...existing.rows[0], ...req.body };
    const qty = parseFloat(merged.quantity) || 1;
    const price = parseFloat(merged.unit_price) || 0;
    const total_price = qty * price;

    const result = await pool.query(
      `UPDATE estimate_items SET
        project_category_id = COALESCE($1, project_category_id),
        item_id = COALESCE($2, item_id),
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        quantity = $5,
        unit_price = $6,
        total_price = $7,
        supplier_org_id = COALESCE($8, supplier_org_id),
        shortlisted = COALESCE($9, shortlisted),
        status_id = COALESCE($10, status_id),
        updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [
        req.body.project_category_id, req.body.item_id, req.body.name,
        req.body.description, qty, price, total_price,
        req.body.supplier_org_id, req.body.shortlisted, req.body.status_id,
        req.params.id
      ]
    );

    // Recalculate parent estimate total
    await recalcEstimateTotal(result.rows[0].estimate_id);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - soft delete (mark via status or just delete, since no is_active column)
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM estimate_items WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

    // Recalculate parent estimate total after delete
    await recalcEstimateTotal(result.rows[0].estimate_id);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
