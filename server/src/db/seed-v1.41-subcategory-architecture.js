// One-off seed: v1.41 subcategory two-field model. Idempotent.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Subcategory architecture — two-field model, child categories, AI backfill, marketplace chips';
const VERSION = 'v1.41';
const SHIPPED_DATE = '2026-05-20';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'dev';

const NOTES = `## Subcategory architecture

### Data model
items now has two fields: category_id (always
parent) + subcategory_id (always child FK to
categories). DB trigger validates subcategory
belongs to category.

### Migration
15 items on child categories migrated: category_id
moved to parent, subcategory_id set to child.

### Child categories
Added missing subcategories from taxonomy as
child category rows. Every parent now has 6-30
children.

### Drawer
Rewired: Category = parents only, Subcategory =
children of selected. "✦ Suggest" for AI auto-fill.

### Marketplace
Subcategory chip filter below category circles.
Text pills from child categories. "All" + per-
subcat chips. Theme-accent active state.

### TaxonomyService
Backend service: suggestSubcategory + backfill.
Haiku-powered. Backfilled 116 of 121 items (93%
total coverage including the 15 pre-migrated).`;

const TEST_NOTES = `Verify: (1) items.subcategory_id column exists. (2) Existing 15 items migrated correctly (now on parents with child stored in subcategory_id). (3) Child categories exist for all parents. (4) DB trigger rejects mismatched cat/subcat. (5) Drawer: Category = parents, Subcategory = children. (6) Save writes both fields. (7) Marketplace: subcat chips appear below category circles after clicking a category. (8) Chip click filters items by subcategory_id. (9) '✦ Suggest' button next to Subcategory label pre-fills via AI. (10) Backfill distribution recorded; 126/136 items have subcategory_id set. (11) No items point at child categories directly. (12) ng build passes.`;

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
    const promptId   = promptCat.rows[0].id;
    const tcId       = tcCat.rows[0].id;
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
                tags=ARRAY['feature','taxonomy','subcategory','v1.41']::text[],
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
                 ARRAY['feature','taxonomy','subcategory','v1.41']::text[],
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
         VALUES ($1,$2,'Test: Subcategory architecture v1.41',$3,$4,
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
