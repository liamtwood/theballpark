const pool = require('../db/pool');

async function getAll(orgId) {
  let query = `SELECT p.*, s.name as status_name, s.color as status_color, c.name as client_name
    FROM projects p
    LEFT JOIN statuses s ON p.status_id = s.id
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.is_active = true`;
  const params = [];
  if (orgId) {
    params.push(orgId);
    query += ` AND p.org_id = $${params.length}`;
  }
  query += ' ORDER BY p.created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const projectResult = await pool.query(
    `SELECT p.*, s.name as status_name, s.color as status_color, c.name as client_name
     FROM projects p
     LEFT JOIN statuses s ON p.status_id = s.id
     LEFT JOIN clients c ON p.client_id = c.id
     WHERE p.id = $1`,
    [id]
  );
  if (!projectResult.rows.length) return null;

  const categoriesResult = await pool.query(
    `SELECT pc.*, s.name as status_name, s.color as status_color
     FROM project_categories pc
     LEFT JOIN statuses s ON pc.status_id = s.id
     WHERE pc.project_id = $1 AND pc.is_active = true
     ORDER BY pc.sort_order ASC, pc.created_at DESC`,
    [id]
  );

  const project = projectResult.rows[0];
  project.project_categories = categoriesResult.rows;
  return project;
}

async function create(data) {
  const {
    org_id, client_id, name, description, event_name, event_date,
    venue_name, venue_city, venue_address, guest_count, stand_size,
    stand_width_m, stand_depth_m, stand_type, project_notes, raw_brief_text,
    parsed_brief_json, ai_hints, missing_fields, project_budget,
    share_budget_with_suppliers, default_margin_pct, default_contingency_pct,
    default_vat_pct, tier, status_id
  } = data;
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
  return result.rows[0];
}

async function update(id, data) {
  const {
    org_id, client_id, name, description, event_name, event_date,
    venue_name, venue_city, venue_address, guest_count, stand_size,
    stand_width_m, stand_depth_m, stand_type, project_notes, raw_brief_text,
    parsed_brief_json, ai_hints, missing_fields, project_budget,
    share_budget_with_suppliers, default_margin_pct, default_contingency_pct,
    default_vat_pct, tier, status_id, cover_image_url, client_logo_url, card_color,
    event_type, duration_days, po_ref, currency
  } = data;
  const result = await pool.query(
    `UPDATE projects SET
      org_id = COALESCE($1, org_id), client_id = COALESCE($2, client_id),
      name = COALESCE($3, name), description = COALESCE($4, description),
      event_name = COALESCE($5, event_name), event_date = COALESCE($6, event_date),
      venue_name = COALESCE($7, venue_name), venue_city = COALESCE($8, venue_city),
      venue_address = COALESCE($9, venue_address), guest_count = COALESCE($10, guest_count),
      stand_size = COALESCE($11, stand_size), stand_width_m = COALESCE($12, stand_width_m),
      stand_depth_m = COALESCE($13, stand_depth_m), stand_type = COALESCE($14, stand_type),
      project_notes = COALESCE($15, project_notes), raw_brief_text = COALESCE($16, raw_brief_text),
      parsed_brief_json = COALESCE($17, parsed_brief_json), ai_hints = COALESCE($18, ai_hints),
      missing_fields = COALESCE($19, missing_fields), project_budget = COALESCE($20, project_budget),
      share_budget_with_suppliers = COALESCE($21, share_budget_with_suppliers),
      default_margin_pct = COALESCE($22, default_margin_pct),
      default_contingency_pct = COALESCE($23, default_contingency_pct),
      default_vat_pct = COALESCE($24, default_vat_pct),
      tier = COALESCE($25, tier), status_id = COALESCE($26, status_id),
      cover_image_url = COALESCE($27, cover_image_url),
      client_logo_url = COALESCE($28, client_logo_url),
      card_color = COALESCE($29, card_color),
      event_type = COALESCE($30, event_type),
      duration_days = COALESCE($31, duration_days),
      po_ref = COALESCE($32, po_ref),
      currency = COALESCE($33, currency),
      updated_at = NOW()
     WHERE id = $34`,
    [
      org_id, client_id, name, description, event_name, event_date,
      venue_name, venue_city, venue_address, guest_count, stand_size,
      stand_width_m, stand_depth_m, stand_type, project_notes, raw_brief_text,
      parsed_brief_json, ai_hints, missing_fields, project_budget,
      share_budget_with_suppliers, default_margin_pct, default_contingency_pct,
      default_vat_pct, tier, status_id, cover_image_url, client_logo_url, card_color,
      event_type, duration_days, po_ref, currency, id
    ]
  );
  // v1.29c: re-read via the joined SELECT used by getById so the row
  // we return includes client_name / status_name / status_color. The
  // Overview event strip + drawer header depend on those joined fields
  // and would otherwise blank out after a save.
  return await getById(id);
}

/**
 * v1.22: clone a project with its top-level facts (client, event date,
 * dimensions, financial defaults). Intentionally does NOT copy:
 *   - project_categories       (no Brief scope)
 *   - project_items            (no cart)
 *   - estimates / estimate_items
 *   - messages
 *
 * The new project starts as a clean Draft so the user can scope from
 * scratch. status_id is left null — the dashboard's display logic falls
 * back to "Draft" for projects without a status_name. Cover image /
 * logo / card colour ARE copied so the duplicate looks like a sibling
 * at a glance.
 */
async function duplicate(id) {
  const original = await pool.query(
    'SELECT * FROM projects WHERE id = $1 AND is_active = true',
    [id]
  );
  if (!original.rows.length) return null;
  const src = original.rows[0];

  const inserted = await pool.query(
    `INSERT INTO projects (
       org_id, client_id, name, description,
       event_name, event_date, venue_name, venue_city, venue_address,
       guest_count, stand_size, stand_width_m, stand_depth_m, stand_type,
       project_budget, default_margin_pct, default_contingency_pct,
       default_vat_pct, tier, event_type, duration_days,
       cover_image_url, client_logo_url, card_color
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     RETURNING *`,
    [
      src.org_id, src.client_id, `Copy of ${src.name}`, src.description,
      src.event_name, src.event_date, src.venue_name, src.venue_city, src.venue_address,
      src.guest_count, src.stand_size, src.stand_width_m, src.stand_depth_m, src.stand_type,
      src.project_budget, src.default_margin_pct, src.default_contingency_pct,
      src.default_vat_pct, src.tier, src.event_type, src.duration_days,
      src.cover_image_url, src.client_logo_url, src.card_color
    ]
  );
  return inserted.rows[0];
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE projects SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0] || null;
}

async function getByClient(clientId) {
  const result = await pool.query(
    'SELECT * FROM projects WHERE client_id = $1 AND is_active = true ORDER BY created_at DESC',
    [clientId]
  );
  return result.rows;
}

// Single canonical source for recalculating project totals
async function recalcTotals(projectId) {
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
       total_ballpark_cost = $1, total_base_cost = $2, total_client_cost = $3,
       updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [total_ballpark_cost, total_base_cost, total_client_cost, projectId]
  );
  return result.rows[0];
}

module.exports = { getAll, getById, create, update, duplicate, softDelete, getByClient, recalcTotals };
