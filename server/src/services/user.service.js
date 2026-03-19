const pool = require('../db/pool');

async function getAll() {
  const result = await pool.query('SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC');
  return result.rows;
}

async function getByOrg(orgId) {
  const result = await pool.query(
    'SELECT * FROM users WHERE org_id = $1 AND is_active = true ORDER BY created_at DESC', [orgId]
  );
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const { org_id, name, description, email, role, avatar_url } = data;
  const result = await pool.query(
    `INSERT INTO users (org_id, name, description, email, role, avatar_url)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [org_id, name, description, email, role, avatar_url]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { org_id, name, description, email, role, avatar_url } = data;
  const result = await pool.query(
    `UPDATE users SET
      org_id = COALESCE($1, org_id), name = COALESCE($2, name),
      description = COALESCE($3, description), email = COALESCE($4, email),
      role = COALESCE($5, role), avatar_url = COALESCE($6, avatar_url),
      updated_at = NOW()
     WHERE id = $7 RETURNING *`,
    [org_id, name, description, email, role, avatar_url, id]
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, getByOrg, getById, create, update, softDelete };
