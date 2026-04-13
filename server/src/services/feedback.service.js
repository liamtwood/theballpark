const pool = require('../db/pool');

async function getAll() {
  const result = await pool.query(`
    SELECT f.*,
           c.name  AS category_name,
           sc.name AS subcategory_name
    FROM shared.feedback f
    LEFT JOIN categories c  ON c.id  = f.category_id
    LEFT JOIN categories sc ON sc.id = f.subcategory_id
    ORDER BY f.created_at DESC
  `);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query(`
    SELECT f.*,
           c.name  AS category_name,
           sc.name AS subcategory_name
    FROM shared.feedback f
    LEFT JOIN categories c  ON c.id  = f.category_id
    LEFT JOIN categories sc ON sc.id = f.subcategory_id
    WHERE f.id = $1
  `, [id]);
  return result.rows[0] || null;
}

async function getToday() {
  const today = new Date().toISOString().split('T')[0];
  const result = await pool.query(`
    SELECT f.*
    FROM shared.feedback f
    WHERE f.meeting_date = $1 AND f.parent_id IS NULL
    ORDER BY f.created_at DESC LIMIT 1
  `, [today]);
  if (result.rows.length) return result.rows[0];
  // Create today's note
  const ins = await pool.query(
    `INSERT INTO shared.feedback (title, meeting_date, agenda)
     VALUES ($1, $2, $3) RETURNING *`,
    [
      new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' Meeting',
      today,
      ['Finding items demo', 'AI brief parser', 'Open discussion']
    ]
  );
  return ins.rows[0];
}

async function getChildren(parentId) {
  const result = await pool.query(`
    SELECT f.*,
           c.name  AS category_name,
           sc.name AS subcategory_name
    FROM shared.feedback f
    LEFT JOIN categories c  ON c.id  = f.category_id
    LEFT JOIN categories sc ON sc.id = f.subcategory_id
    WHERE f.parent_id = $1
    ORDER BY f.created_at ASC
  `, [parentId]);
  return result.rows;
}

async function create(data) {
  const { category_id, subcategory_id, title, notes, page_url, submitted_by, environment, owner, due_date, meeting_date, parent_id, agenda, type, meeting_time, description } = data;
  const result = await pool.query(
    `INSERT INTO shared.feedback (category_id, subcategory_id, title, notes, page_url, submitted_by, environment, owner, due_date, meeting_date, parent_id, agenda, type, meeting_time, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
    [category_id || null, subcategory_id || null, title, notes || null, page_url || null, submitted_by || null, environment || 'preview', owner || null, due_date || null, meeting_date || null, parent_id || null, agenda || [], type || null, meeting_time || null, description || null]
  );
  return result.rows[0];
}

async function patch(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const [key, val] of Object.entries(data)) {
    if (['title', 'notes', 'owner', 'due_date', 'meeting_date', 'agenda', 'completed', 'type', 'meeting_time', 'description'].includes(key)) {
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
  await pool.query('DELETE FROM shared.feedback WHERE id = $1', [id]);
}

module.exports = { getAll, getById, getToday, getChildren, create, patch, remove };
