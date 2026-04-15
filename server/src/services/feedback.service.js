const pool = require('../db/pool');

const BASE_SELECT = `
  SELECT f.*,
         c.name  AS category_name,
         sc.name AS subcategory_name
  FROM shared.feedback f
  LEFT JOIN categories c  ON c.id  = f.category_id
  LEFT JOIN categories sc ON sc.id = f.subcategory_id
`;

async function getAll(objectType) {
  let query = BASE_SELECT;
  const params = [];
  if (objectType) {
    params.push(objectType);
    query += ` WHERE f.object_type = $1`;
  }
  query += ' ORDER BY f.created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query(BASE_SELECT + ' WHERE f.id = $1', [id]);
  return result.rows[0] || null;
}

async function getFolders() {
  const result = await pool.query(
    BASE_SELECT + ` WHERE f.object_type = 'folder' ORDER BY f.event_date DESC NULLS LAST, f.created_at DESC`
  );
  return result.rows;
}

async function getIssues(folderId) {
  let query = BASE_SELECT + ` WHERE f.object_type = 'issue'`;
  const params = [];
  if (folderId) {
    params.push(folderId);
    query += ` AND f.parent_id = $1`;
  }
  query += ' ORDER BY f.created_at ASC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getToday() {
  const today = new Date().toISOString().split('T')[0];
  const result = await pool.query(
    `SELECT f.* FROM shared.feedback f WHERE f.event_date = $1 AND f.parent_id IS NULL AND f.object_type = 'folder' ORDER BY f.created_at DESC LIMIT 1`,
    [today]
  );
  if (result.rows.length) return result.rows[0];
  const ins = await pool.query(
    `INSERT INTO shared.feedback (title, event_date, agenda, object_type, type)
     VALUES ($1, $2, $3, 'folder', 'minutes') RETURNING *`,
    [new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' Meeting', today, ['Finding items demo', 'AI brief parser', 'Open discussion']]
  );
  return ins.rows[0];
}

async function getChildren(parentId) {
  const result = await pool.query(
    BASE_SELECT + ' WHERE f.parent_id = $1 ORDER BY f.created_at ASC',
    [parentId]
  );
  return result.rows;
}

async function create(data) {
  const { category_id, subcategory_id, title, notes, page_url, submitted_by, environment, owner, due_date, event_date, parent_id, agenda, type, meeting_time, description, object_type } = data;
  const result = await pool.query(
    `INSERT INTO shared.feedback (category_id, subcategory_id, title, notes, page_url, submitted_by, environment, owner, due_date, event_date, parent_id, agenda, type, meeting_time, description, object_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
    [category_id || null, subcategory_id || null, title, notes || null, page_url || null, submitted_by || null, environment || 'preview', owner || null, due_date || null, event_date || null, parent_id || null, agenda || [], type || null, meeting_time || null, description || null, object_type || 'issue']
  );
  return result.rows[0];
}

async function patch(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const [key, val] of Object.entries(data)) {
    if (['title', 'notes', 'owner', 'due_date', 'event_date', 'agenda', 'completed', 'type', 'meeting_time', 'description', 'status', 'object_type'].includes(key)) {
      fields.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
  }
  if (!fields.length) return getById(id);
  values.push(id);
  const result = await pool.query(
    `UPDATE shared.feedback SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

async function remove(id) {
  await pool.query('DELETE FROM shared.feedback WHERE parent_id = $1', [id]);
  await pool.query('DELETE FROM shared.feedback WHERE id = $1', [id]);
}

module.exports = { getAll, getById, getFolders, getIssues, getToday, getChildren, create, patch, remove };
