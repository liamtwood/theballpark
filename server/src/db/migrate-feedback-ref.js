// pV2-FEEDBACK-REF-01 — one-off backfill: assign human refs (F-00001…) to
// existing feedback ISSUE rows that lack one, in chronological (created_at)
// order, drawing from shared.feedback_ref_seq.
//
// Scope: object_type='issue' AND type <> 'test_case' (test cases are excluded
// from the ref stream per the RELEASE-SEQUENCE runbook). Folders never get a ref.
//
// Idempotent — only touches rows where ref IS NULL; re-run is a no-op. The
// sequence naturally continues past the highest assigned value, so new creates
// keep numbering cleanly. Also ensures the column/sequence/index exist so this
// script is self-sufficient for the preview schema catch-up.
//
// Usage: node server/src/db/migrate-feedback-ref.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    // Ensure the ref machinery (additive; matches migrate-schemas.js).
    await client.query(`ALTER TABLE shared.feedback ADD COLUMN IF NOT EXISTS ref VARCHAR(12)`);
    await client.query(`CREATE SEQUENCE IF NOT EXISTS shared.feedback_ref_seq`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_ref
         ON shared.feedback (ref) WHERE ref IS NOT NULL AND deleted_at IS NULL`
    );

    const { rows } = await client.query(
      `SELECT id, title FROM shared.feedback
        WHERE object_type = 'issue'
          AND type IS DISTINCT FROM 'test_case'
          AND ref IS NULL
          AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC`
    );
    console.log(`Issue rows needing a ref: ${rows.length}`);
    if (!rows.length) {
      console.log('Nothing to backfill — done.');
      return;
    }

    await client.query('BEGIN');
    const assigned = [];
    for (const r of rows) {
      const res = await client.query(
        `UPDATE shared.feedback
            SET ref = 'F-' || lpad(nextval('shared.feedback_ref_seq')::text, 5, '0')
          WHERE id = $1 AND ref IS NULL
          RETURNING ref, title`,
        [r.id]
      );
      if (res.rows[0]) assigned.push(res.rows[0]);
    }
    await client.query('COMMIT');

    console.log(`Assigned ${assigned.length} refs.`);
    console.log(`Range: ${assigned[0]?.ref} … ${assigned[assigned.length - 1]?.ref}`);
    // Report the v0.1.1 fix rows' refs for the release note.
    const v = await client.query(
      `SELECT ref, title FROM shared.feedback
        WHERE target_version = 'v0.1.1' AND deleted_at IS NULL AND ref IS NOT NULL
        ORDER BY ref`
    );
    console.log('\nv0.1.1 fix refs:');
    for (const row of v.rows) console.log(`  ${row.ref}  ${row.title}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Backfill failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
