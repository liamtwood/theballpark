// One-off seed: v1.39 create-project modal rewrite — AI-first, auto-ref,
// results inline in modal, rule-based fallback. Idempotent.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Create project — AI-first, auto-ref, results inline in modal';
const VERSION = 'v1.39';
const SHIPPED_DATE = '2026-05-20';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'dev';

const NOTES = `## Create project — AI-first revision

Replaced rule-based parsing with AI-first flow.
Modal simplified: no input fields, just upload
or paste. AI extracts everything.

### Flow
1. Auto-ref generated from org prefix + counter
2. Upload brief or paste text
3. "Parse with AI" calls AiService.parseBrief
4. Results shown inline: project details, 8
   categories with supplier-ready briefs,
   questions
5. User reviews, removes unwanted categories
6. "Create project" saves everything
7. Lands on Brief tab

### Schema
orgs.ref_prefix + orgs.ref_counter for auto-ref
projects.ref for the generated reference

### Fallback
If AI fails, rule-based parser runs as backup.
Creates a blank project if both fail.

### Settings
Org Reference prefix added to Organisation tab.`;

const TEST_NOTES = `Verify: (1) Click + New project — modal shows with auto-ref (e.g. WA-001). (2) Paste Angel Delight brief. (3) Click Parse with AI — loading animation shows. (4) Results appear inline with project name, client, date, budget chips. (5) 6+ categories shown with supplier-ready briefs. (6) Remove a category with ✕. (7) Click Create project — project created with remaining categories. (8) Lands on Brief tab with categories populated. (9) Ref shows on the project. (10) Settings > Org has reference prefix field. (11) If no API key, shows fallback error with manual create option. (12) ng build passes.`;

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
                tags=ARRAY['feature','project','ai','v1.39']::text[],
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
                 ARRAY['feature','project','ai','v1.39']::text[],
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
         VALUES ($1,$2,'Test: Create project AI-first v1.39',$3,$4,
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
