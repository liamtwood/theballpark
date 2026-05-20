// One-off seed: insert v1.19 feedback entry (prompt) + test_case child.
// Idempotent — updates by title/version if already present.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Category context panel — brief + items in catalogue-grid right panel';
const VERSION = 'v1.19';
const SHIPPED_DATE = '2026-05-13';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'preview';

const NOTES = `## Category context panel

New shared component that shows category brief
and selected/liked items in the catalogue-grid
right panel when a category is active but no
item is selected.

### Three panel states in catalogue-grid
1. Item selected → item detail (existing)
2. Category active, no item → category context
3. Nothing → "Select an item to preview"

### Context modes
- project: shows requirement_brief from
  project_categories + project_items
- marketplace: shows category description +
  favourites
- supplier: shows category description +
  favourites from this supplier

### Component
shared/components/category-context-panel/

### Features
- Brief/description display
- Budget display (project context)
- Selected items list with move/remove actions
- Liked items list with move up/remove
- Category total (sum of selected)
- "Browse marketplace" link (project context only;
  clears the category filter)
- Live updates when items added/removed (reads
  projectItems passed through from parents)
- Click item → switches to item detail`;

const TEST_NOTES = `Verify: (1) Project Marketplace — select a category in circles/sidebar. Right panel shows category name, brief text, and any selected/liked items for that category. (2) Add an item (tick) — deselect item — category panel now shows the item in Selected list. (3) Heart an item — shows in Liked list. (4) Click 'Move up' on liked item — moves to Selected. (5) Click x on item — removed. (6) Click item name in list — switches to item detail panel. (7) Category total updates. (8) Standalone marketplace — select category — shows description (no brief). (9) Supplier Store — select category — shows description, panelContext=supplier. (10) Browse marketplace link clears category filter. (11) ng build passes.`;

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const promptCat = await pool.query(
      `SELECT id FROM shared.feedback_categories WHERE name='Prompt' AND object_type='issue' LIMIT 1`
    );
    const tcCat = await pool.query(
      `SELECT id FROM shared.feedback_categories WHERE name='Test Case' AND object_type='issue' LIMIT 1`
    );
    const areaTech = await pool.query(
      `SELECT id FROM shared.feedback_categories WHERE namespace='area' AND name='Technical' LIMIT 1`
    );
    if (!promptCat.rowCount || !tcCat.rowCount || !areaTech.rowCount) {
      throw new Error('Prompt, Test Case, or Technical area category not found — run migrate-schemas.js');
    }
    const promptId  = promptCat.rows[0].id;
    const tcId      = tcCat.rows[0].id;
    const techAreaId = areaTech.rows[0].id;

    const existing = await pool.query(
      `SELECT id FROM shared.feedback
        WHERE title = $1 AND version = $2 LIMIT 1`,
      [TITLE, VERSION]
    );
    let promptRowId;
    if (existing.rowCount) {
      promptRowId = existing.rows[0].id;
      await pool.query(
        `UPDATE shared.feedback
            SET notes = $1, status = 'done', shipped_date = $2,
                feedback_category_id = $3, area_category_id = $4,
                type = 'prompt', object_type = 'issue',
                environment = $5, version = $6, submitted_by = $7,
                tags = ARRAY['feature','component','v1.19']::text[],
                priority = 3
          WHERE id = $8`,
        [NOTES, SHIPPED_DATE, promptId, techAreaId, ENV, VERSION, SUBMITTED_BY, promptRowId]
      );
      console.log(`prompt updated: ${promptRowId}`);
    } else {
      const ins = await pool.query(
        `INSERT INTO shared.feedback
           (feedback_category_id, area_category_id, title, notes, submitted_by,
            environment, object_type, type, status, tags,
            version, shipped_date, area, owner, priority)
         VALUES ($1, $2, $3, $4, $5, $6, 'issue', 'prompt', 'done',
                 ARRAY['feature','component','v1.19']::text[],
                 $7, $8, 'Technical', $9, 3)
         RETURNING id`,
        [promptId, techAreaId, TITLE, NOTES, SUBMITTED_BY,
         ENV, VERSION, SHIPPED_DATE, OWNER]
      );
      promptRowId = ins.rows[0].id;
      console.log(`prompt inserted: ${promptRowId}`);
    }

    const existingTc = await pool.query(
      `SELECT id FROM shared.feedback
        WHERE parent_id = $1 AND type = 'test_case' LIMIT 1`,
      [promptRowId]
    );
    if (existingTc.rowCount) {
      console.log(`test_case already present: ${existingTc.rows[0].id}`);
    } else {
      const tcIns = await pool.query(
        `INSERT INTO shared.feedback
           (feedback_category_id, parent_id, title, notes, submitted_by,
            environment, object_type, type, status, owner)
         VALUES ($1, $2, 'Test: category context panel v1.19', $3, $4,
                 $5, 'issue', 'test_case', 'todo', $6)
         RETURNING id`,
        [tcId, promptRowId, TEST_NOTES, SUBMITTED_BY, ENV, OWNER]
      );
      console.log(`test_case inserted: ${tcIns.rows[0].id}`);
    }

  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
