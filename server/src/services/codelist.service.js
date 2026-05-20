const pool = require('../db/pool');

function autoCode(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function getByName(listName) {
  const result = await pool.query(
    `SELECT * FROM shared.codelists
      WHERE list_name = $1 AND is_active = true
      ORDER BY sort_order ASC`,
    [listName]
  );
  return result.rows;
}

async function getAll() {
  const result = await pool.query(
    `SELECT DISTINCT list_name FROM shared.codelists ORDER BY list_name ASC`
  );
  return result.rows.map(r => r.list_name);
}

async function create(listName, data) {
  const label = data.label;
  if (!label) {
    const err = new Error('label is required');
    err.status = 400;
    throw err;
  }
  const code = data.code || autoCode(label);
  if (!code) {
    const err = new Error('code could not be derived from label');
    err.status = 400;
    throw err;
  }

  let sortOrder = data.sort_order;
  if (sortOrder == null) {
    const r = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM shared.codelists WHERE list_name = $1`,
      [listName]
    );
    sortOrder = r.rows[0].next;
  }

  try {
    const result = await pool.query(
      `INSERT INTO shared.codelists
         (list_name, code, label, symbol, meta, sort_order, is_system)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING *`,
      [listName, code, label, data.symbol || null, data.meta || {}, sortOrder]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const conflict = new Error(`Code "${code}" already exists in list "${listName}"`);
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}

async function update(id, data) {
  const result = await pool.query(
    `UPDATE shared.codelists SET
       label      = COALESCE($1, label),
       symbol     = COALESCE($2, symbol),
       meta       = COALESCE($3, meta),
       sort_order = COALESCE($4, sort_order),
       is_active  = COALESCE($5, is_active)
     WHERE id = $6
     RETURNING *`,
    [
      data.label ?? null,
      data.symbol ?? null,
      data.meta ?? null,
      data.sort_order ?? null,
      data.is_active ?? null,
      id
    ]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  const existing = await pool.query(
    `SELECT is_system FROM shared.codelists WHERE id = $1`,
    [id]
  );
  if (!existing.rows[0]) return null;
  if (existing.rows[0].is_system) {
    const err = new Error('System codelist entries cannot be deleted');
    err.status = 409;
    throw err;
  }
  const result = await pool.query(
    `DELETE FROM shared.codelists WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { getByName, getAll, create, update, remove };
