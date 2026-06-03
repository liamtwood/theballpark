const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env.preview') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  await client.query('SET search_path TO preview, public');

  const totals = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM projects)             AS projects,
      (SELECT COUNT(*) FROM project_items)        AS project_items,
      (SELECT COUNT(*) FROM project_categories)   AS project_categories,
      (SELECT COUNT(*) FROM items)                AS items_catalogue,
      (SELECT COUNT(*) FROM categories)           AS categories,
      (SELECT COUNT(*) FROM orgs)                 AS orgs,
      (SELECT COUNT(*) FROM users)                AS users
  `);
  console.log('--- preview schema counts ---');
  console.log(totals.rows[0]);

  const pcByProject = await client.query(`
    SELECT p.id, p.event_name, p.name,
           (SELECT COUNT(*) FROM project_categories pc WHERE pc.project_id = p.id AND pc.is_active = true) AS cat_count,
           (SELECT COUNT(*) FROM project_items pi WHERE pi.project_id = p.id) AS item_count
      FROM projects p
     ORDER BY p.created_at DESC
  `);
  console.log('\n--- per-project category + item counts ---');
  for (const r of pcByProject.rows) {
    console.log(`  ${r.event_name || r.name} | cats: ${r.cat_count} | items: ${r.item_count}`);
  }

  await client.end();
})();
