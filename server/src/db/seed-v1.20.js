// One-off seed: v1.20 feedback prompt + test_case. Idempotent.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Category context panel — visual redesign with subtotal, thumbnails, wishlist, footer';
const VERSION = 'v1.20';
const SHIPPED_DATE = '2026-05-13';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'preview';

const NOTES = `## Category context panel redesign

Visual upgrade of the category-context-panel
component. Same data, same behaviour, richer UI.

### New sections
- Subtotal block with wishlist impact and
  longest lead time
- Item thumbnails (46px) with supplier name
  and lead time
- Wishlist section with "Confirm" to move to
  selected, "awaiting client approval" hint
- Pinned footer with project total and
  "Open estimate →" link to Build tab

### Brief inline editing
Pencil icon opens inline textarea editor.
Saves on blur to project_categories via
ProjectService.upsertCategory().

### Terminology
Display: "Wishlist" = data: selection_type 'liked'
Display: "Selected" = data: selection_type 'selected'

### Scrolling
Header, subtotal, brief, footer pinned.
Item lists scroll within available height.

### Backend
project-item.service.js getByProject now also
returns i.lead_time_days and o.name AS
supplier_name (LEFT JOIN orgs) — drives the
per-row subtitle and the longest-lead summary.

### Theme
Uses existing theme tokens only. No new hex.`;

const TEST_NOTES = `Verify: (1) Select category in project marketplace — panel shows header with icon, name, count chip 'N selected · M wishlist'. (2) Subtotal shows sum of selected items as big serif amount. (3) '+£X if wishlist approved' shows sum of liked items. (4) Longest lead shows max lead_time_days. (5) Brief shows requirement_brief text. (6) Click pencil — inline textarea opens. Edit and blur — saves via upsertCategory. (7) Selected items show 46px thumbnail, name, '{supplier} · {N} days lead', '£X / unit'. (8) Click x removes item. (9) Wishlist section shows liked items on tinted band with Confirm button. (10) Click Confirm — moves to Selected, subtotal updates. (11) Footer shows project total across all categories. (12) 'Open estimate ->' routes to /estimate. (13) Empty state shows when no items in either bucket. (14) Many items scroll, header/footer pinned. (15) Verify theme tokens — no hardcoded hex. (16) ng build passes.`;

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
                tags=ARRAY['design','component','v1.20']::text[],
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
                 ARRAY['design','component','v1.20']::text[],
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
         VALUES ($1,$2,'Test: context panel redesign v1.20',$3,$4,
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
