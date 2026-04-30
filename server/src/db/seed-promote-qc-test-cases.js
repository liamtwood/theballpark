// Reframe the 30 Apr QC observations as standalone test_case results.
//
// What this does:
//   1. For each of the 15 bug entries tagged ['qc','feedback-ui'] inserted
//      by seed-qc-test-cases.js: copy the bug title onto its child
//      test_case row, attach qc/feedback-ui tags + Feedback area, then
//      promote the test_case to top-level by clearing parent_id.
//   2. Delete the now-orphan bug entries.
//
// Idempotent: only acts on bug rows tagged qc + feedback-ui that have a
// child test_case. Already-promoted test cases are left alone.

const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const feedbackArea = await pool.query(
      `SELECT id FROM shared.feedback_categories
        WHERE namespace='area' AND name='Feedback' LIMIT 1`
    );
    const tcCat = await pool.query(
      `SELECT id FROM shared.feedback_categories
        WHERE name='Test Case' AND object_type='issue' LIMIT 1`
    );
    if (!feedbackArea.rowCount || !tcCat.rowCount) {
      throw new Error('Feedback area or Test Case category missing — run migrate-schemas.js first');
    }
    const feedbackAreaId = feedbackArea.rows[0].id;
    const tcCategoryId   = tcCat.rows[0].id;

    const bugs = await pool.query(
      `SELECT id, title FROM shared.feedback
        WHERE type = 'bug'
          AND tags @> ARRAY['qc','feedback-ui']::text[]`
    );
    console.log(`Found ${bugs.rowCount} QC bug entries`);

    let promoted = 0, deletedBugs = 0;
    for (const bug of bugs.rows) {
      // Promote each child test_case to top-level
      const upd = await pool.query(
        `UPDATE shared.feedback
            SET parent_id = NULL,
                title = $2,
                tags = ARRAY['qc','feedback-ui']::text[],
                area_category_id = $3,
                feedback_category_id = $4
          WHERE parent_id = $1
            AND type = 'test_case'`,
        [bug.id, bug.title, feedbackAreaId, tcCategoryId]
      );
      promoted += upd.rowCount;

      // Delete the bug. parent_id FK has ON DELETE no-action by default —
      // but we already detached children, so a plain DELETE is safe.
      await pool.query(
        `DELETE FROM shared.feedback WHERE id = $1`,
        [bug.id]
      );
      deletedBugs++;
      console.log(`  promoted+deleted: ${bug.title}`);
    }

    console.log(`\nPromoted ${promoted} test_case rows to top-level`);
    console.log(`Deleted ${deletedBugs} QC bug entries`);

    // Audit
    const tcCount = await pool.query(
      `SELECT COUNT(*) FROM shared.feedback
        WHERE type='test_case' AND parent_id IS NULL`
    );
    const remainingBugs = await pool.query(
      `SELECT COUNT(*) FROM shared.feedback
        WHERE type='bug' AND tags @> ARRAY['qc','feedback-ui']::text[]`
    );
    console.log(`\nTop-level test_case rows: ${tcCount.rows[0].count}`);
    console.log(`Remaining QC bugs:        ${remainingBugs.rows[0].count}`);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
