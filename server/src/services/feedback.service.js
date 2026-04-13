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
  const { category_id, subcategory_id, title, notes, page_url, submitted_by, environment, owner, due_date, meeting_date, parent_id } = data;
  const result = await pool.query(
    `INSERT INTO shared.feedback (category_id, subcategory_id, title, notes, page_url, submitted_by, environment, owner, due_date, meeting_date, parent_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [category_id || null, subcategory_id || null, title, notes || null, page_url || null, submitted_by || null, environment || 'preview', owner || null, due_date || null, meeting_date || null, parent_id || null]
  );
  return result.rows[0];
}

module.exports = { getAll, getChildren, create };
