// One-off: project_items.image_url was added inline in migrate.js
// (the master idempotent migration) but never broken out into a
// versioned migration file. Preview Railway never ran migrate.js
// after that line was added, so the column is missing and the
// list query 500s on COALESCE(pi.image_url, i.image_url).
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env.preview') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    await client.query(`
      SET search_path TO preview, public;
      ALTER TABLE project_items ADD COLUMN IF NOT EXISTS image_url TEXT;
    `);
    console.log('  ✓ project_items.image_url ensured');
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
