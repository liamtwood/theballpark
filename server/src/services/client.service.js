const pool = require('../db/pool');

async function getAll(orgId) {
  let query = 'SELECT * FROM clients WHERE is_active = true';
  const params = [];
  if (orgId) {
    params.push(orgId);
    query += ` AND org_id = $${params.length}`;
  }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const { org_id, name, description, contact_name, email, phone, address } = data;
  const result = await pool.query(
    `INSERT INTO clients (org_id, name, description, contact_name, email, phone, address)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [org_id, name, description, contact_name, email, phone, address]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { org_id, name, description, contact_name, email, phone, address } = data;
  const result = await pool.query(
    `UPDATE clients SET
      org_id = COALESCE($1, org_id), name = COALESCE($2, name),
      description = COALESCE($3, description), contact_name = COALESCE($4, contact_name),
      email = COALESCE($5, email), phone = COALESCE($6, phone),
      address = COALESCE($7, address), updated_at = NOW()
     WHERE id = $8 RETURNING *`,
    [org_id, name, description, contact_name, email, phone, address, id]
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE clients SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, getById, create, update, softDelete };
