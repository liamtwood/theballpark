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

async function create(data) {
  const { category_id, subcategory_id, title, notes, page_url, submitted_by, environment } = data;
  const result = await pool.query(
    `INSERT INTO shared.feedback (category_id, subcategory_id, title, notes, page_url, submitted_by, environment)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [category_id || null, subcategory_id || null, title, notes || null, page_url || null, submitted_by || null, environment || 'preview']
  );
  return result.rows[0];
}

module.exports = { getAll, create };
