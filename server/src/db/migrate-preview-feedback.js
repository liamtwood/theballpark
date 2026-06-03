// One-off: bring preview.categories feedback namespace into the new flat model.
// - Promotes existing children (Bug/Enhancement/Note) to level-0
// - Sets object_type on Bug/Enhancement/Question/Prompt = 'issue'
// - Inserts Minutes/Sprint/Test Run/Workshop = 'folder'
// - Soft-deletes Works Well + stale children (Product/Pricing/Process/Technical)
// - Backfills shared.feedback.category_id by matching type -> category name
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TARGETS = [
  { name: 'Minutes',     object_type: 'folder', tagline: 'Meeting notes and decisions',    description: 'Record meetings, decisions and follow-up actions.',       icon_name: 'calendar',      icon_color: 'var(--theme-bg)',        sort: 0 },
  { name: 'Sprint',      object_type: 'folder', tagline: 'Development sprint tracker',     description: 'Plan and track work across a development sprint.',        icon_name: 'zap',           icon_color: 'var(--theme-bg)',        sort: 1 },
  { name: 'Test Run',    object_type: 'folder', tagline: 'QA and testing sessions',        description: 'Record bugs and observations from a testing session.',    icon_name: 'flask-conical', icon_color: 'var(--theme-bg)',        sort: 2 },
  { name: 'Workshop',    object_type: 'folder', tagline: 'Working sessions and discovery', description: 'Capture outputs from workshops and working sessions.',    icon_name: 'users',         icon_color: 'var(--theme-bg)',        sort: 3 },
  { name: 'Note',        object_type: 'folder', tagline: 'General notes and documents',    description: 'A free-form note or reference document.',                 icon_name: 'file-text',     icon_color: 'var(--theme-bg)',        sort: 4 },
  { name: 'Bug',         object_type: 'issue',  tagline: 'Something is broken',            description: 'Log anything broken, inconsistent or behaving unexpectedly.', icon_name: 'bug',           icon_color: 'var(--color-danger-bg)', sort: 5 },
  { name: 'Enhancement', object_type: 'issue',  tagline: 'Make it better',                 description: 'Feature requests, improvements and nice-to-haves.',        icon_name: 'lightbulb',     icon_color: 'var(--theme-bg)',        sort: 6 },
  { name: 'Question',    object_type: 'issue',  tagline: 'Something to discuss',           description: 'Open questions about the product, process or pricing.',   icon_name: 'circle-help',   icon_color: 'var(--theme-bg)',        sort: 7 },
  { name: 'Prompt',      object_type: 'issue',  tagline: 'A requirement or instruction',   description: 'Capture specific requirements and build instructions.',   icon_name: 'clipboard-pen', icon_color: 'var(--theme-bg)',        sort: 8 }
];

const RETIRE_NAMES = ['Works Well', 'Product', 'Pricing', 'Process', 'Technical'];

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await pool.query('BEGIN');

    for (const t of TARGETS) {
      // Find any existing row by name in feedback namespace (level 0 or 1)
      const { rows } = await pool.query(
        `SELECT id FROM preview.categories WHERE namespace='feedback' AND name=$1 LIMIT 1`,
        [t.name]
      );
      if (rows.length) {
        await pool.query(
          `UPDATE preview.categories
             SET parent_id = NULL,
                 object_type = $1,
                 tagline = $2,
                 description = $3,
                 icon_name = $4,
                 icon_color = $5,
                 sort_order = $6,
                 is_active = true,
                 enabled = true,
                 updated_at = NOW()
           WHERE id = $7`,
          [t.object_type, t.tagline, t.description, t.icon_name, t.icon_color, t.sort, rows[0].id]
        );
        console.log(`updated: ${t.name} (${t.object_type})`);
      } else {
        await pool.query(
          `INSERT INTO preview.categories
             (name, tagline, description, icon_name, icon_color, sort_order, namespace, object_type)
           VALUES ($1,$2,$3,$4,$5,$6,'feedback',$7)`,
          [t.name, t.tagline, t.description, t.icon_name, t.icon_color, t.sort, t.object_type]
        );
        console.log(`inserted: ${t.name} (${t.object_type})`);
      }
    }

    // Soft-delete the old hierarchy leaves that are no longer in the model
    for (const n of RETIRE_NAMES) {
      const r = await pool.query(
        `UPDATE preview.categories
            SET is_active = false, enabled = false, updated_at = NOW()
          WHERE namespace='feedback' AND name=$1
          RETURNING id`,
        [n]
      );
      if (r.rowCount) console.log(`retired: ${n} (${r.rowCount})`);
    }

    // Backfill shared.feedback.category_id by matching type -> category name
    const bf = await pool.query(`
      UPDATE shared.feedback f SET category_id = c.id
        FROM preview.categories c
       WHERE c.namespace='feedback'
         AND c.parent_id IS NULL
         AND c.is_active = true
         AND LOWER(c.name) = LOWER(f.type)
         AND (f.category_id IS NULL OR f.category_id <> c.id)
      RETURNING f.id
    `);
    console.log(`backfilled category_id on ${bf.rowCount} shared.feedback rows`);

    await pool.query('COMMIT');
    console.log('done.');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('ERR — rolled back:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
