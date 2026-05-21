/**
 * PostgreSQL connection pool
 * 
 * Schema is driven by the APP_SCHEMA environment variable:
 *   public   → dev  (default, local development)
 *   preview  → QA / stakeholder demos
 *   master   → production
 * 
 * Set in Railway environment variables per deployment.
 */

const { Pool } = require('pg');
require('dotenv').config({
  path: require('path').join(__dirname, '../../../.env'),
  override: true
});

const schema = process.env.APP_SCHEMA || 'public';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Set search_path so all queries target the correct schema
  // without needing to prefix every table name
  options: `-c search_path=${schema},public`,
});

pool.on('connect', (client) => {
  client.query(`SET search_path TO ${schema}, public`);
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

console.log(`[DB] Connected — schema: ${schema}`);

module.exports = pool;
