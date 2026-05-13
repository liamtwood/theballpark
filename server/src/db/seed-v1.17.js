// One-off seed: insert v1.17 feedback entry (prompt) + test_case child.
// Idempotent — checks by title/version before inserting.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Item drawer — tabs, view mode, multiple images. Detail panel — add/like/edit/view.';
const VERSION = 'v1.17';
const SHIPPED_DATE = '2026-05-13';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'preview';

const NOTES = `## Item drawer refactor + detail panel actions

### Drawer — three tabs
1. Details: name, markdown description, category,
   subcategory, lead time, unit, time unit,
   ballpark/min/max price, summary card
2. Index: tier pills, derived from, parent item,
   tags, external URL
3. Images: 8-slot grid, each opens
   ImageUploadPanelComponent. First slot is hero.
   Stored as JSONB array on items.images column.
   Backward compat: images[0] also writes to
   image_url.

### Drawer — three modes
- add: empty form, save creates
- edit: pre-populated, save updates
- view: read-only display, all fields disabled,
  markdown rendered, Close button only

### Detail panel — four actions
On catalogue-grid inline detail panel:
- + (add to project) — agency only, toggles
  selection_type='selected' on project_items
- ♡ (like for project) — agency only, toggles
  selection_type='liked'
- ✎ (edit) — own org items only, opens drawer
  in edit mode
- 👁 (view) — always visible, opens drawer in
  view mode

Active state: filled amber for + and ♡ when
item is in project. Toggle off removes.

### Schema
items.images JSONB DEFAULT '[]' added to all
three env schemas.

### Wired in
supplier-detail, build, supplier-list —
all pass projectId, projectItems, currentOrg
to catalogue-grid and handle events.`;

const TEST_NOTES = `Test: (1) Supplier detail Store — click item, verify 4 action icons on detail panel. (2) Click view (eye) — drawer opens in read-only mode with three tabs. All fields display-only. Close button works. (3) Click edit (pencil) on own item — drawer opens in edit mode. Change name, save. Verify persists. (4) Open drawer, switch to Images tab. Click empty slot — verify ImageUploadPanel opens. Upload image, verify thumbnail appears. Upload second image. Save. Verify both images persist on reload. (5) Verify first image (hero) shows on item card in grid. (6) Click + on item with projectId context — verify added to project, icon fills amber. Click again — verify removed. (7) Click heart — verify liked. Click + on liked item — verify upsert to selected. (8) No + or heart visible when logged in as supplier. (9) No pencil on items from other orgs. (10) ng build passes.`;

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    // Resolve Prompt + Test Case + Technical area category ids.
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

    // 1. Upsert the prompt entry.
    const existing = await pool.query(
      `SELECT id FROM shared.feedback
        WHERE title = $1 AND version = $2 LIMIT 1`,
      [TITLE, VERSION]
    );
    let promptRowId;
    if (existing.rowCount) {
      promptRowId = existing.rows[0].id;
      // Refresh notes / status / shipped_date in case the entry was
      // pre-seeded as a todo.
      await pool.query(
        `UPDATE shared.feedback
            SET notes = $1, status = 'done', shipped_date = $2,
                feedback_category_id = $3, area_category_id = $4,
                type = 'prompt', object_type = 'issue',
                environment = $5, version = $6, submitted_by = $7,
                tags = ARRAY['feature','refactor','drawer','v1.17']::text[],
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
                 ARRAY['feature','refactor','drawer','v1.17']::text[],
                 $7, $8, 'Technical', $9, 3)
         RETURNING id`,
        [promptId, techAreaId, TITLE, NOTES, SUBMITTED_BY,
         ENV, VERSION, SHIPPED_DATE, OWNER]
      );
      promptRowId = ins.rows[0].id;
      console.log(`prompt inserted: ${promptRowId}`);
    }

    // 2. Insert the test case child (idempotent).
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
         VALUES ($1, $2, 'Test: drawer + detail panel v1.17', $3, $4,
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
