// One-off seed: v1.24 Project Overview tab. Idempotent.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Project Overview tab — action-oriented dashboard with inbox cards';
const VERSION = 'v1.24';
const SHIPPED_DATE = '2026-05-18';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'preview';

const NOTES = `## Project Overview tab

New default landing tab for projects. Shows
project health at a glance with action prompts.

### Event strip
Date (NATO format + relative), venue, guests,
client lead. Full-width horizontal card.
"Run sheet pending" badge when event is within
30 days with incomplete categories.

### Four inbox cards (2×2)
Brief: categories/written/to-write counts,
missing category pills, "N briefs to write"

Marketplace: selected/wishlist/suppliers counts,
empty category pills, "N categories empty"

Estimate: estimated/pending/margin counts,
cost + client total, budget bar with under/over

Messages: contacted/replied/quotes counts,
reply list with supplier name + preview + time,
notification badge

### Navigation
Overview is first tab, default active.
Each card clickable → navigates to its tab.
Messages tab gets notification badge.

### Data
Aggregated from project_categories,
project_items, messages (where available).
Empty states for new projects.`;

const TEST_NOTES = `Verify: (1) Overview is default tab when opening a project. (2) Event strip shows date, venue, guests, client lead. Missing fields show dash. (3) Brief card shows correct counts. Missing brief categories appear as pills. (4) Marketplace card shows selected/wishlist/supplier counts. Empty categories as pills. (5) Estimate card shows costs, budget bar, under/over indicator. (6) Messages card shows contacted/replied/quotes. Reply list with supplier names if data exists. (7) Click Brief card → Brief tab. (8) Click Marketplace card → Marketplace tab. (9) Click Estimate card → Build tab. (10) Click Messages card → Messages tab. (11) Messages tab has notification badge when count > 0. (12) New project shows empty states. (13) Hover elevation on all cards. (14) No hardcoded colours. (15) ng build passes.`;

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
                tags=ARRAY['feature','project','dashboard','v1.24']::text[],
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
                 ARRAY['feature','project','dashboard','v1.24']::text[],
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
         VALUES ($1,$2,'Test: Project Overview tab v1.24',$3,$4,
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
