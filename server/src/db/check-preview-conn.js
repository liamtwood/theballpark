// One-off connection probe for preview Railway. Confirms the
// connection string in .env.preview lands us on the right schema
// and lists which migration-related tables already exist.
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env.preview') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[probe] connected — DIRECT_URL is', (process.env.DIRECT_URL || '').split('@')[1]?.slice(0, 40));

  const cur = await client.query("SELECT current_schema(), current_database()");
  console.log('[probe] current_schema, current_database:', cur.rows[0]);

  const sp = await client.query('SHOW search_path');
  console.log('[probe] search_path:', sp.rows[0].search_path);

  // Check which preview-schema tables already exist
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'preview'
      AND table_name IN (
        'orgs', 'users', 'projects', 'project_items', 'project_categories',
        'project_item_suppliers', 'message_item_decisions',
        'messages', 'message_items',
        'project_brief_cards'
      )
    ORDER BY table_name
  `);
  console.log('[probe] preview-schema tables present:');
  for (const r of tables.rows) console.log('   -', r.table_name);

  // Confirm project_items column set (snapshot + quantity migrations)
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'preview' AND table_name = 'project_items'
    ORDER BY column_name
  `);
  console.log('[probe] project_items columns:');
  for (const r of cols.rows) console.log('   -', r.column_name);

  await client.end();
})().catch(e => { console.error('[probe] ERROR:', e.message); process.exit(1); });
