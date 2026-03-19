const pool = require('../db/pool');

async function getBalance(orgId) {
  const result = await pool.query('SELECT balls_balance FROM orgs WHERE id = $1', [orgId]);
  return result.rows[0]?.balls_balance || 0;
}

async function getTransactions(orgId) {
  let query = 'SELECT * FROM balls_transactions WHERE 1=1';
  const params = [];
  if (orgId) {
    params.push(orgId);
    query += ` AND org_id = $${params.length}`;
  }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function createTransaction(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { org_id, project_id, estimate_id, supplier_org_id, user_id, amount, direction, reason, description } = data;

    const txResult = await client.query(
      `INSERT INTO balls_transactions (org_id, project_id, estimate_id, supplier_org_id, user_id, amount, direction, reason, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [org_id, project_id, estimate_id, supplier_org_id, user_id, amount, direction, reason, description]
    );

    const delta = direction === 'credit' ? amount : -amount;
    await client.query(
      'UPDATE orgs SET balls_balance = balls_balance + $1, updated_at = NOW() WHERE id = $2',
      [delta, org_id]
    );

    await client.query('COMMIT');
    return txResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getBalance, getTransactions, createTransaction };
