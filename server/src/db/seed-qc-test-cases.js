// Seed 15 QC bug entries tagged ['qc', 'feedback-ui'] with one failing
// test case each. Captures the QC pass run on 2026-04-30 against preview
// — every issue listed below was reproduced, logged, and fixed in v1.11.
//
// Idempotent — keyed on title:
//   - bug entry inserted only if no row with the same title + qc tag exists
//   - test_case child inserted only if the parent bug has no test_case yet

const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const SHIPPED_DATE = '2026-04-30';
const VERSION      = 'v1.11';
const SUBMITTED_BY = 'Liam';
const OWNER        = 'LW';

const QC_BUGS = [
  {
    title: 'Grid/list/table toggle — wrong button format',
    bug_notes: 'View toggle on feedback page used text labels instead of icon-only buttons (catalogue page uses correct pattern).',
    tc_notes:  'Tested on preview 30 Apr — toggle shows text labels instead of icons. Catalogue page uses icon-only correctly.'
  },
  {
    title: 'Table view — full width instead of sidebar layout',
    bug_notes: 'Table view did not use the standard catalogue-grid layout with sidebar + detail panel.',
    tc_notes:  'Tested on preview 30 Apr — table renders full width with no sidebar or detail panel.'
  },
  {
    title: 'Table view — column order wrong',
    bug_notes: 'Title column appeared first instead of Type. Expected order: Type | Area | Pages | Title | Owner.',
    tc_notes:  'Tested on preview 30 Apr — Title is first column. Expected: Type | Area | Pages | Title | Owner.'
  },
  {
    title: 'Table view — type column shows initial not name',
    bug_notes: 'Type column rendered single letter (G, P, B) rather than the full type name.',
    tc_notes:  'Tested on preview 30 Apr — column shows single letter G instead of type name Prompt.'
  },
  {
    title: 'Table detail panel — too narrow',
    bug_notes: 'Right-hand detail panel in table view was too narrow to read note content comfortably.',
    tc_notes:  'Tested on preview 30 Apr — right panel is too narrow to read note content comfortably.'
  },
  {
    title: 'Table detail panel — notes shows raw markdown',
    bug_notes: 'Detail panel rendered raw markdown characters (** ##) instead of formatted HTML.',
    tc_notes:  'Tested on preview 30 Apr — raw markdown visible e.g. ** and ## characters showing in notes.'
  },
  {
    title: 'Feedback capture — save fails silently',
    bug_notes: 'POST /api/feedback returned 500 with no error message shown to the user.',
    tc_notes:  'Tested on preview 30 Apr — POST /api/feedback returns 500. No error shown. Network tab shows 500 response.'
  },
  {
    title: 'Feedback capture — dialog UI does not match drawer',
    bug_notes: 'Capture dialog used the older UI pattern, missing area/owner/priority fields.',
    tc_notes:  'Tested on preview 30 Apr — capture dialog missing area, owner, priority fields. Old UI pattern.'
  },
  {
    title: 'Feedback drawer — increase width to 520px',
    bug_notes: 'Drawer was too narrow at default width — content felt cramped, especially in two-column area+pages row.',
    tc_notes:  'Tested on preview 30 Apr — current drawer width is too narrow, content feels cramped.'
  },
  {
    title: 'Feedback drawer — header label should show type',
    bug_notes: 'Drawer eyebrow always read FEEDBACK rather than the entry type (BUG / PROMPT / etc).',
    tc_notes:  'Tested on preview 30 Apr — header always shows FEEDBACK regardless of entry type.'
  },
  {
    title: 'Feedback drawer — title should be editable inline',
    bug_notes: 'Title in the drawer header was static — clicking did not switch into an inline edit mode.',
    tc_notes:  'Tested on preview 30 Apr — title cannot be edited in the drawer. Clicking has no effect.'
  },
  {
    title: 'Feedback drawer — status/priority/version pills should cycle on click',
    bug_notes: 'Pills in the drawer were not interactive — could not change status or priority without leaving the drawer.',
    tc_notes:  'Tested on preview 30 Apr — pills are not clickable. Cannot change status or priority from drawer.'
  },
  {
    title: 'Feedback drawer — notes should show preview first',
    bug_notes: 'Drawer notes opened in edit mode showing raw markdown rather than rendered preview.',
    tc_notes:  'Tested on preview 30 Apr — notes opens in edit mode showing raw markdown instead of preview.'
  },
  {
    title: 'Feedback drawer — notes editor font should match app',
    bug_notes: 'Drawer notes textarea used monospace font, inconsistent with the rest of the app.',
    tc_notes:  'Tested on preview 30 Apr — textarea uses monospace font, inconsistent with rest of application.'
  },
  {
    title: 'Table view — add priority below notes in detail panel',
    bug_notes: 'Detail panel did not show priority pill, making it hard to triage from the table view.',
    tc_notes:  'Tested on preview 30 Apr — priority not visible in the table detail panel.'
  }
];

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    // Resolve Bug + Test Case category ids
    const bugCat = await pool.query(
      `SELECT id FROM shared.feedback_categories WHERE name='Bug' AND object_type='issue' LIMIT 1`
    );
    const tcCat = await pool.query(
      `SELECT id FROM shared.feedback_categories WHERE name='Test Case' AND object_type='issue' LIMIT 1`
    );
    const areaFeedback = await pool.query(
      `SELECT id FROM shared.feedback_categories WHERE namespace='area' AND name='Feedback' LIMIT 1`
    );
    if (!bugCat.rowCount || !tcCat.rowCount || !areaFeedback.rowCount) {
      throw new Error('Bug, Test Case, or Feedback area category not found — run migrate-schemas.js first');
    }
    const bugCategoryId = bugCat.rows[0].id;
    const tcCategoryId  = tcCat.rows[0].id;
    const feedbackAreaId = areaFeedback.rows[0].id;

    let bugsInserted = 0, bugsExisting = 0;
    let casesInserted = 0, casesExisting = 0;

    for (const item of QC_BUGS) {
      // 1. Find or create the bug entry
      let bugId;
      const existingBug = await pool.query(
        `SELECT id FROM shared.feedback
          WHERE title = $1
          AND tags @> ARRAY['qc']::text[]
          LIMIT 1`,
        [item.title]
      );
      if (existingBug.rowCount) {
        bugId = existingBug.rows[0].id;
        bugsExisting++;
      } else {
        const ins = await pool.query(
          `INSERT INTO shared.feedback
             (feedback_category_id, area_category_id, title, notes, submitted_by,
              environment, object_type, type, status, tags,
              version, shipped_date, area, owner, priority)
           VALUES ($1, $2, $3, $4, $5, 'preview', 'issue', 'bug', 'done',
                   ARRAY['qc','feedback-ui']::text[],
                   $6, $7, 'feedback', $8, 2)
           RETURNING id`,
          [bugCategoryId, feedbackAreaId, item.title, item.bug_notes, SUBMITTED_BY,
           VERSION, SHIPPED_DATE, OWNER]
        );
        bugId = ins.rows[0].id;
        bugsInserted++;
        console.log(`bug inserted:  ${item.title}`);
      }

      // 2. Find or create the failing test_case child
      const existingTc = await pool.query(
        `SELECT id FROM shared.feedback
          WHERE parent_id = $1 AND type = 'test_case'
          LIMIT 1`,
        [bugId]
      );
      if (existingTc.rowCount) {
        casesExisting++;
        continue;
      }
      await pool.query(
        `INSERT INTO shared.feedback
           (feedback_category_id, parent_id, title, notes, submitted_by,
            environment, object_type, type, status, owner,
            created_at)
         VALUES ($1, $2, 'Test Case', $3, $4, 'preview', 'issue', 'test_case',
                 'fail', $5, $6)`,
        [tcCategoryId, bugId, item.tc_notes, SUBMITTED_BY, OWNER, SHIPPED_DATE]
      );
      casesInserted++;
      console.log(`  test_case inserted for: ${item.title}`);
    }

    console.log(`\nbugs:  inserted=${bugsInserted}, already=${bugsExisting}`);
    console.log(`cases: inserted=${casesInserted}, already=${casesExisting}`);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
