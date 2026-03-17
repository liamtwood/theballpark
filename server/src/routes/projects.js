const router = require('express').Router();
const pool = require('../db/pool');

// Helper: recalculate project rollup totals from project_categories
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
  const result = await pool.query(
    `UPDATE projects SET
       total_ballpark_cost = $1,
       total_base_cost = $2,
       total_client_cost = $3,
       updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [total_ballpark_cost, total_base_cost, total_client_cost, projectId]
  );
  return result.rows[0];
}

// GET / - list all projects (filter by org_id)
router.get('/', async (req, res) => {
  try {
    const { org_id } = req.query;
    let query = `SELECT p.*, s.name as status_name, s.color as status_color, c.name as client_name
FROM projects p
LEFT JOIN statuses s ON p.status_id = s.id
LEFT JOIN clients c ON p.client_id = c.id
WHERE p.is_active = true`;
    const params = [];
    if (org_id) {
      params.push(org_id);
      query += ` AND p.org_id = $${params.length}`;
    }
    query += ' ORDER BY p.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get single project with project_categories
router.get('/:id', async (req, res) => {
  try {
    const projectResult = await pool.query(
      `SELECT p.*, s.name as status_name, s.color as status_color, c.name as client_name
       FROM projects p
       LEFT JOIN statuses s ON p.status_id = s.id
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!projectResult.rows.length) return res.status(404).json({ error: 'Not found' });

    const categoriesResult = await pool.query(
      `SELECT pc.*, s.name as status_name, s.color as status_color
       FROM project_categories pc
       LEFT JOIN statuses s ON pc.status_id = s.id
       WHERE pc.project_id = $1 AND pc.is_active = true
       ORDER BY pc.sort_order ASC, pc.created_at DESC`,
      [req.params.id]
    );

    const project = projectResult.rows[0];
    project.project_categories = categoriesResult.rows;
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create project
router.post('/', async (req, res) => {
  try {
    const {
      org_id, client_id, name, description, event_name, event_date,
      venue_name, venue_city, venue_address, guest_count, stand_size,
      stand_width_m, stand_depth_m, stand_type, project_notes, raw_brief_text,
      parsed_brief_json, ai_hints, missing_fields, project_budget,
      share_budget_with_suppliers, default_margin_pct, default_contingency_pct,
      default_vat_pct, tier, status_id
    } = req.body;
    const result = await pool.query(
      `INSERT INTO projects (
        org_id, client_id, name, description, event_name, event_date,
        venue_name, venue_city, venue_address, guest_count, stand_size,
        stand_width_m, stand_depth_m, stand_type, project_notes, raw_brief_text,
        parsed_brief_json, ai_hints, missing_fields, project_budget,
        share_budget_with_suppliers, default_margin_pct, default_contingency_pct,
        default_vat_pct, tier, status_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) RETURNING *`,
      [
        org_id, client_id, name, description, event_name, event_date,
        venue_name, venue_city, venue_address, guest_count, stand_size,
        stand_width_m, stand_depth_m, stand_type, project_notes, raw_brief_text,
        parsed_brief_json, ai_hints, missing_fields, project_budget,
        share_budget_with_suppliers, default_margin_pct, default_contingency_pct,
        default_vat_pct, tier, status_id
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update project and recalculate rollup totals
router.put('/:id', async (req, res) => {
  try {
    const {
      org_id, client_id, name, description, event_name, event_date,
      venue_name, venue_city, venue_address, guest_count, stand_size,
      stand_width_m, stand_depth_m, stand_type, project_notes, raw_brief_text,
      parsed_brief_json, ai_hints, missing_fields, project_budget,
      share_budget_with_suppliers, default_margin_pct, default_contingency_pct,
      default_vat_pct, tier, status_id
    } = req.body;
    const result = await pool.query(
      `UPDATE projects SET
        org_id = COALESCE($1, org_id),
        client_id = COALESCE($2, client_id),
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        event_name = COALESCE($5, event_name),
        event_date = COALESCE($6, event_date),
        venue_name = COALESCE($7, venue_name),
        venue_city = COALESCE($8, venue_city),
        venue_address = COALESCE($9, venue_address),
        guest_count = COALESCE($10, guest_count),
        stand_size = COALESCE($11, stand_size),
        stand_width_m = COALESCE($12, stand_width_m),
        stand_depth_m = COALESCE($13, stand_depth_m),
        stand_type = COALESCE($14, stand_type),
        project_notes = COALESCE($15, project_notes),
        raw_brief_text = COALESCE($16, raw_brief_text),
        parsed_brief_json = COALESCE($17, parsed_brief_json),
        ai_hints = COALESCE($18, ai_hints),
        missing_fields = COALESCE($19, missing_fields),
        project_budget = COALESCE($20, project_budget),
        share_budget_with_suppliers = COALESCE($21, share_budget_with_suppliers),
        default_margin_pct = COALESCE($22, default_margin_pct),
        default_contingency_pct = COALESCE($23, default_contingency_pct),
        default_vat_pct = COALESCE($24, default_vat_pct),
        tier = COALESCE($25, tier),
        status_id = COALESCE($26, status_id),
        updated_at = NOW()
       WHERE id = $27 RETURNING *`,
      [
        org_id, client_id, name, description, event_name, event_date,
        venue_name, venue_city, venue_address, guest_count, stand_size,
        stand_width_m, stand_depth_m, stand_type, project_notes, raw_brief_text,
        parsed_brief_json, ai_hints, missing_fields, project_budget,
        share_budget_with_suppliers, default_margin_pct, default_contingency_pct,
        default_vat_pct, tier, status_id, req.params.id
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

    // Recalculate rollup totals from project_categories
    const updated = await recalcProjectTotals(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - soft delete
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE projects SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export recalcProjectTotals for use by projectCategories route
router.recalcProjectTotals = recalcProjectTotals;

module.exports = router;
