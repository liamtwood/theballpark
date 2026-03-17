const router = require('express').Router();
const pool = require('../db/pool');

// Helper: recalculate project rollup totals
async function recalcProjectTotals(projectId) {
  const totals = await pool.query(
    `SELECT
       COALESCE(SUM(subtotal), 0) AS total_ballpark_cost,
       COALESCE(SUM(base_cost), 0) AS total_base_cost,
       COALESCE(SUM(client_cost), 0) AS total_client_cost
     FROM project_categories
     WHERE project_id = $1 AND is_active = true`,
    [projectId]
  );
  const { total_ballpark_cost, total_base_cost, total_client_cost } = totals.rows[0];
  await pool.query(
    `UPDATE projects SET
       total_ballpark_cost = $1,
       total_base_cost = $2,
       total_client_cost = $3,
       updated_at = NOW()
     WHERE id = $4`,
    [total_ballpark_cost, total_base_cost, total_client_cost, projectId]
  );
}

// Helper: calculate derived fields for a project_category
function calcDerivedFields(data) {
  const base_cost = parseFloat(data.base_cost) || 0;
  const contingency_pct = parseFloat(data.contingency_pct) || 0;
  const margin_pct = parseFloat(data.margin_pct) || 0;
  const vat_pct = parseFloat(data.vat_pct) || 0;

  const contingency_amount = base_cost * contingency_pct / 100;
  const subtotal = base_cost + contingency_amount;
  const margin_amount = subtotal * margin_pct / 100;
  const net_cost = subtotal + margin_amount;
  const vat_amount = net_cost * vat_pct / 100;
  const client_cost = net_cost + vat_amount;

  return { contingency_amount, subtotal, margin_amount, net_cost, vat_amount, client_cost };
}

// GET / - list project_categories (filter by project_id)
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    let query = 'SELECT * FROM project_categories WHERE is_active = true';
    const params = [];
    if (project_id) {
      params.push(project_id);
      query += ` AND project_id = $${params.length}`;
    }
    query += ' ORDER BY sort_order ASC, created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get single project_category
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM project_categories WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create project_category with derived field calculations
router.post('/', async (req, res) => {
  try {
    const {
      project_id, category_id, name, description, requirement_brief,
      requirement_detail, ballpark_cost, base_cost, contingency_pct,
      margin_pct, vat_pct, sort_order, status_id
    } = req.body;
    const derived = calcDerivedFields(req.body);

    const result = await pool.query(
      `INSERT INTO project_categories (
        project_id, category_id, name, description, requirement_brief,
        requirement_detail, ballpark_cost, base_cost, contingency_pct, contingency_amount,
        subtotal, margin_pct, margin_amount, net_cost, vat_pct, vat_amount,
        client_cost, sort_order, status_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [
        project_id, category_id, name, description, requirement_brief,
        requirement_detail, ballpark_cost || 0, base_cost || 0, contingency_pct || 0,
        derived.contingency_amount, derived.subtotal, margin_pct || 0,
        derived.margin_amount, derived.net_cost, vat_pct || 20,
        derived.vat_amount, derived.client_cost, sort_order, status_id
      ]
    );

    // Recalculate parent project totals
    await recalcProjectTotals(project_id);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update project_category with derived field calculations
router.put('/:id', async (req, res) => {
  try {
    // Fetch existing record to merge with updates
    const existing = await pool.query(
      'SELECT * FROM project_categories WHERE id = $1',
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });

    const merged = { ...existing.rows[0], ...req.body };
    const derived = calcDerivedFields(merged);

    const result = await pool.query(
      `UPDATE project_categories SET
        category_id = COALESCE($1, category_id),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        requirement_brief = COALESCE($4, requirement_brief),
        requirement_detail = COALESCE($5, requirement_detail),
        ballpark_cost = COALESCE($6, ballpark_cost),
        base_cost = $7,
        contingency_pct = $8,
        contingency_amount = $9,
        subtotal = $10,
        margin_pct = $11,
        margin_amount = $12,
        net_cost = $13,
        vat_pct = $14,
        vat_amount = $15,
        client_cost = $16,
        sort_order = COALESCE($17, sort_order),
        status_id = COALESCE($18, status_id),
        updated_at = NOW()
       WHERE id = $19 RETURNING *`,
      [
        req.body.category_id, req.body.name, req.body.description,
        req.body.requirement_brief, req.body.requirement_detail, req.body.ballpark_cost,
        merged.base_cost || 0, merged.contingency_pct || 0,
        derived.contingency_amount, derived.subtotal, merged.margin_pct || 0,
        derived.margin_amount, derived.net_cost, merged.vat_pct || 20,
        derived.vat_amount, derived.client_cost, req.body.sort_order,
        req.body.status_id, req.params.id
      ]
    );

    // Recalculate parent project totals
    await recalcProjectTotals(result.rows[0].project_id);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - soft delete
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE project_categories SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

    // Recalculate parent project totals after soft delete
    await recalcProjectTotals(result.rows[0].project_id);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
