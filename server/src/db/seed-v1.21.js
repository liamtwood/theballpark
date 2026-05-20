// One-off seed: v1.21 feedback prompt + test_case. Idempotent.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Unified category card design — shared item rows across marketplace cart + Build tab';
const VERSION = 'v1.21';
const SHIPPED_DATE = '2026-05-13';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'preview';

const NOTES = `## Unified category card design

One design language across marketplace cart panel
and Build tab expanded cards. Shared components
for item rows, category headers, and three-tab
structure (Items/Wishlist/Brief).

### Shared components
- project-item-row: thumbnail (48px), name,
  supplier + price math, total, x remove.
  Compact mode for narrow panels. Wishlist mode
  adds Confirm button. Hover-only "move to
  wishlist" heart demote on selected rows.
- category-card-header: icon, name, counts
  (selected/wishlist), cost, status badge.
  Falls back to a "Draft" pill when no status.

### Surface 1: Category context panel
Three tabs (Items/Wishlist/Brief). Brief is now
a tab — previously an always-on block. Subtotal
block (£ total, wishlist impact, longest lead)
above the tabs; pinned footer with project total
+ "Open estimate ->" below.

### Surface 2: Build tab expanded card
Same three tabs, same row design at full size.
Items tab footer: "+ Add more {name}" + "Longest
lead N days". Wishlist tab mirrors the panel.

### Polish
- Percentages drop .00 (15% not 15.00%)
- Compressed cards show "+ Add {name}" instead
  of "No items yet"
- "Add more {name}" not "Browse marketplace"
- Hover-to-demote on selected rows
- Tier as tiny pill below item name
- Theme tokens verified, no new hex values

### Backend
project-item.service.js getByProject now also
returns c.icon_name AS category_icon_name.
`;

const TEST_NOTES = `Verify: (1) Marketplace right panel — select category — shows shared header, subtotal block, three tabs (Items/Wishlist/Brief). (2) Items tab shows rows with thumbnail, supplier name, '1 × £X / unit' meta, serif total, x. (3) Tier renders as a small pill next to the item name when set. (4) Hover a selected row — heart icon appears for 'move to wishlist'. (5) Wishlist tab shows liked items with Confirm + x. (6) Click Confirm — moves to Items tab, subtotal updates. (7) Brief tab — input persists on blur via upsertCategory. (8) '+ Add more florals' link works (or category-specific name). (9) 'Longest lead N days' footnote shows correct max. (10) Footer shows project total. (11) 'Open estimate ->' goes to /estimate. (12) Build tab expanded card — same three tabs, same row design (full size, not compact). (13) Compressed cards with no items show '+ Add {name}' link (clickable, doesn't trigger expand). (14) Item rows in both surfaces look identical except size. (15) Percentages show without .00 (estimate panel). (16) No hardcoded hex in any new component. (17) ng build passes.`;

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
      throw new Error('Prompt, Test Case, or Technical area category not found');
    }
    const promptId  = promptCat.rows[0].id;
    const tcId      = tcCat.rows[0].id;
    const techAreaId = areaTech.rows[0].id;

    const existing = await pool.query(
      `SELECT id FROM shared.feedback WHERE title=$1 AND version=$2 LIMIT 1`,
      [TITLE, VERSION]
    );
    let promptRowId;
    if (existing.rowCount) {
      promptRowId = existing.rows[0].id;
      await pool.query(
        `UPDATE shared.feedback
            SET notes=$1, status='done', shipped_date=$2,
                feedback_category_id=$3, area_category_id=$4,
                type='prompt', object_type='issue',
                environment=$5, version=$6, submitted_by=$7,
                tags=ARRAY['design','refactor','component','v1.21']::text[],
                priority=3
          WHERE id=$8`,
        [NOTES, SHIPPED_DATE, promptId, techAreaId, ENV, VERSION, SUBMITTED_BY, promptRowId]
      );
      console.log(`prompt updated: ${promptRowId}`);
    } else {
      const ins = await pool.query(
        `INSERT INTO shared.feedback
           (feedback_category_id, area_category_id, title, notes, submitted_by,
            environment, object_type, type, status, tags,
            version, shipped_date, area, owner, priority)
         VALUES ($1,$2,$3,$4,$5,$6,'issue','prompt','done',
                 ARRAY['design','refactor','component','v1.21']::text[],
                 $7,$8,'Technical',$9,3)
         RETURNING id`,
        [promptId, techAreaId, TITLE, NOTES, SUBMITTED_BY,
         ENV, VERSION, SHIPPED_DATE, OWNER]
      );
      promptRowId = ins.rows[0].id;
      console.log(`prompt inserted: ${promptRowId}`);
    }

    const existingTc = await pool.query(
      `SELECT id FROM shared.feedback WHERE parent_id=$1 AND type='test_case' LIMIT 1`,
      [promptRowId]
    );
    if (existingTc.rowCount) {
      console.log(`test_case already present: ${existingTc.rows[0].id}`);
    } else {
      const tcIns = await pool.query(
        `INSERT INTO shared.feedback
           (feedback_category_id, parent_id, title, notes, submitted_by,
            environment, object_type, type, status, owner)
         VALUES ($1,$2,'Test: unified category card design v1.21',$3,$4,
                 $5,'issue','test_case','todo',$6)
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
