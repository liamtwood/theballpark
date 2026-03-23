const pool = require('../db/pool');

async function getAll(projectId) {
  let query = `SELECT m.*, u.name as sender_name FROM messages m LEFT JOIN users u ON m.user_id = u.id WHERE 1=1`;
  const params = [];
  if (projectId) { params.push(projectId); query += ` AND m.project_id = $${params.length}`; }
  query += ' ORDER BY m.created_at ASC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(data) {
  const { project_id, user_id, supplier_org_id, estimate_item_id, subject, body, direction, status_id } = data;
  const result = await pool.query(
    `INSERT INTO messages (project_id, user_id, supplier_org_id, estimate_item_id, subject, body, direction, status_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [project_id, user_id, supplier_org_id, estimate_item_id, subject, body, direction, status_id]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { subject, body, direction, status_id, msg_status, category_id } = data;
  const result = await pool.query(
    `UPDATE messages SET
      subject = COALESCE($1, subject), body = COALESCE($2, body),
      direction = COALESCE($3, direction), status_id = COALESCE($4, status_id),
      msg_status = COALESCE($5, msg_status), category_id = COALESCE($6, category_id),
      updated_at = NOW()
     WHERE id = $7 RETURNING *`,
    [subject, body, direction, status_id, msg_status, category_id, id]
  );
  return result.rows[0] || null;
}

async function hardDelete(id) {
  const result = await pool.query('DELETE FROM messages WHERE id = $1 RETURNING *', [id]);
  return result.rows[0] || null;
}

async function getAllByOrg(orgId) {
  const result = await pool.query(
    `SELECT m.*, u.name as sender_name, p.name as project_name
     FROM messages m
     LEFT JOIN users u ON m.user_id = u.id
     LEFT JOIN projects p ON m.project_id = p.id
     WHERE p.org_id = $1
     ORDER BY m.created_at ASC`,
    [orgId]
  );
  return result.rows;
}

module.exports = { getAll, getById, getAllByOrg, create, update, hardDelete };
