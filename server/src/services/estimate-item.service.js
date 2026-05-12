const pool = require('../db/pool');
const EstimateService = require('./estimate.service');

// v1.13: unit_price renamed to offer_price. Deal pricing now includes
// budget_price, ballpark_snapshot, inspired_by_item_id, approved_at /
// approved_by, duration, unit, time_unit, attributes. total_price is
// quantity × duration × offer_price.

// Columns the caller is allowed to update through PATCH/update().
const UPDATABLE_COLS = [
  'project_category_id', 'item_id', 'name', 'description',
  'quantity', 'offer_price', 'budget_price', 'ballpark_snapshot',
  'inspired_by_item_id', 'approved_at', 'approved_by',
  'duration', 'unit', 'time_unit', 'attributes',
  'supplier_org_id', 'shortlisted', 'status_id'
];

function calcTotal({ quantity, duration, offer_price }) {
  const qty = parseFloat(quantity) || 1;
  const dur = parseFloat(duration) || 1;
  const price = parseFloat(offer_price) || 0;
  return qty * dur * price;
}

async function getAll(estimateId) {
  let query = 'SELECT * FROM estimate_items WHERE 1=1';
  const params = [];
  if (estimateId) { params.push(estimateId); query += ` AND estimate_id = $${params.length}`; }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM estimate_items WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const {
    estimate_id, project_category_id, item_id, name, description,
    quantity, offer_price, budget_price, ballpark_snapshot,
    inspired_by_item_id, approved_at, approved_by,
    duration, unit, time_unit, attributes,
    supplier_org_id, shortlisted, status_id
  } = data;

  const qty = parseFloat(quantity) || 1;
  const dur = parseFloat(duration) || 1;
  const price = parseFloat(offer_price) || 0;
  const total_price = qty * dur * price;

  const result = await pool.query(
    `INSERT INTO estimate_items
      (estimate_id, project_category_id, item_id, name, description,
       quantity, offer_price, budget_price, ballpark_snapshot,
       inspired_by_item_id, approved_at, approved_by,
       duration, unit, time_unit, attributes,
       total_price, supplier_org_id, shortlisted, status_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     RETURNING *`,
    [
      estimate_id, project_category_id, item_id, name, description,
      qty, price,
      budget_price ?? null,
      ballpark_snapshot ?? null,
      inspired_by_item_id ?? null,
      approved_at ?? null,
      approved_by ?? null,
      dur,
      unit ?? null,
      time_unit ?? null,
      attributes ?? {},
      total_price,
      supplier_org_id ?? null,
      shortlisted || false,
      status_id ?? null
    ]
  );

  await EstimateService.recalcTotal(estimate_id);
  return result.rows[0];
}

async function update(id, data) {
  const existing = await pool.query('SELECT * FROM estimate_items WHERE id = $1', [id]);
  if (!existing.rows.length) return null;
  const merged = { ...existing.rows[0], ...data };

  // Dynamic SET so partial PATCHes only touch the keys the caller sent.
  // Nullable FKs / nullable fields can be cleared by passing `null`.
  const sets = [];
  const params = [];
  for (const col of UPDATABLE_COLS) {
    if (Object.prototype.hasOwnProperty.call(data, col)) {
      params.push(data[col]);
      sets.push(`${col} = $${params.length}`);
    }
  }

  // Always recompute total_price from the merged row so it stays correct
  // regardless of which subset of {quantity, duration, offer_price} was
  // updated this call.
  const total_price = calcTotal(merged);
  params.push(total_price);
  sets.push(`total_price = $${params.length}`);
  sets.push('updated_at = NOW()');

  params.push(id);
  const result = await pool.query(
    `UPDATE estimate_items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );

  await EstimateService.recalcTotal(result.rows[0].estimate_id);
  return result.rows[0];
}

async function hardDelete(id) {
  const result = await pool.query('DELETE FROM estimate_items WHERE id = $1 RETURNING *', [id]);
  if (!result.rows.length) return null;
  await EstimateService.recalcTotal(result.rows[0].estimate_id);
  return result.rows[0];
}

module.exports = { getAll, getById, create, update, hardDelete };
