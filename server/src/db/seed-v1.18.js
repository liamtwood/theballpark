// One-off seed: insert v1.18 feedback entry (prompt) + test_case child.
// Idempotent — updates by title/version if already present.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Build/Estimate merge — compressed category cards, Items/Brief tabs, estimate summary';
const VERSION = 'v1.18';
const SHIPPED_DATE = '2026-05-13';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'preview';

const NOTES = `## Build / Estimate merge

Merged the Build and Estimate tabs into one
unified Build tab. Removed the separate Estimate
tab from the project tab bar.

### Layout
Two columns: category cards (left) + estimate
summary (right, sticky).

### Compressed category cards
Each project_category renders as a compact card
showing: icon, name, item counts (X selected,
Y liked), brief indicator dot, category cost,
status badge, chevron.

Click to expand — one card open at a time.

### Expanded card — two tabs
Items tab: selected items as compact rows (tier,
name, qty × price, total, view/heart/remove
actions). Liked items with dashed style and
"Move up" action. "Browse marketplace" link.

Brief tab: requirement_brief, requirement_detail,
ballpark_budget (editable), ballpark_cost
(display), "Send brief to suppliers" placeholder.
Same data as Brief tab — project_categories row.

### Estimate summary panel
Category cost breakdown, subtotal, delivery &
setup (12%), contingency, your cost, margin,
client total, budget indicator bar, AI insight
placeholder, Messages CTA.

### Removed
- Separate Estimate tab
- Vendor terminology / vendor browsing from Build
- "+ Add Category" button (categories come from
  Brief tab)
- catalogue-grid drill-in flow on Build

### Data
- project_categories for briefs + costs
- project_items for selected/liked items
- Items joined for display (name, price, unit, tier)
- Backend extended: project_items query now also
  returns item_category_id so older rows without
  project_category_id can still be bucketed by
  category.

### Route changes
- /marketplace (new) → catalogue-grid in project
  context. Was previously misrouted via /build with
  the Marketplace label.
- /build → new unified Build tab.
- /estimate route preserved but no longer in tab bar.
- /supplier (legacy vendor selection) preserved
  but no longer in tab bar.`;

const TEST_NOTES = `Verify: (1) Build tab shows compressed category cards for each project_category. (2) Card shows item counts, brief dot, cost, status. (3) Click card — expands with Items/Brief tabs. (4) Items tab shows selected items with tier, name, qty, price. (5) Liked items shown with dashed style and 'Move up' action. (6) 'Browse marketplace' link navigates to Marketplace tab. (7) Brief tab shows requirement_brief, detail, budget, cost. (8) Brief edits save on blur. (9) Estimate summary panel shows all cost rows. (10) Budget indicator works (under/over). (11) Estimate tab removed from tab bar (Event · Brief · Marketplace · Build · Messages). (12) Empty state shows when no categories. (13) No vendor references remain. (14) ng build passes.`;

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

    // Upsert prompt entry by title+version.
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
                tags = ARRAY['feature','refactor','project','v1.18']::text[],
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
                 ARRAY['feature','refactor','project','v1.18']::text[],
                 $7, $8, 'Technical', $9, 3)
         RETURNING id`,
        [promptId, techAreaId, TITLE, NOTES, SUBMITTED_BY,
         ENV, VERSION, SHIPPED_DATE, OWNER]
      );
      promptRowId = ins.rows[0].id;
      console.log(`prompt inserted: ${promptRowId}`);
    }

    // Test case child (idempotent).
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
         VALUES ($1, $2, 'Test: Build/Estimate merge v1.18', $3, $4,
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
