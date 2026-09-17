// pV2-FEEDBACK-REF-01 — guarded, idempotent ref backfill for the requirements
// tracker. Assigns a human ref to any row that lacks one, prefix-scoped by LEVEL:
//
//   Release folder (category 'Release') → RV-   shared.feedback_rv_seq
//   Epic          (category 'Epic')     → EP-   shared.feedback_epic_seq
//   Requirement   (category 'Requirement') → FR- shared.feedback_fr_seq
//   Test case     (type='test_case')    → TC-   shared.feedback_tc_seq
//   else issue (bug/enhancement/question) → BE- shared.feedback_be_seq
//   non-Release folder                  → no ref (skipped)
//
// BE- is type-INDEPENDENT (bug/enh/question share it), so reclassifying type
// never changes the ref. Idempotent — only touches rows where ref IS NULL, and
// each sequence continues past its highest assigned value, so re-running (or
// running after chat's initial migration) is a no-op. `shared` is one
// cross-environment schema.
//
// Usage: node server/src/db/migrate-feedback-ref.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const SEQ = {
  'RV-': 'shared.feedback_rv_seq',
  'EP-': 'shared.feedback_epic_seq',
  'FR-': 'shared.feedback_fr_seq',
  'BE-': 'shared.feedback_be_seq',
  'TC-': 'shared.feedback_tc_seq',
};

/** The ref prefix for a row, or null if it should get none. */
function prefixFor(row) {
  if ((row.type || '') === 'test_case') return 'TC-';
  if (row.category_name === 'Release') return 'RV-';
  if (row.category_name === 'Epic') return 'EP-';
  if (row.category_name === 'Requirement') return 'FR-';
  if ((row.object_type || 'issue') === 'folder') return null; // non-Release folder
  return 'BE-';
}

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    // Ensure the ref machinery exists (matches migrate-schemas.js).
    await client.query(`ALTER TABLE shared.feedback ADD COLUMN IF NOT EXISTS ref VARCHAR(16)`);
    await client.query(`ALTER TABLE shared.feedback ALTER COLUMN ref TYPE VARCHAR(16)`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_ref
         ON shared.feedback (ref) WHERE ref IS NOT NULL AND deleted_at IS NULL`
    );
    for (const [name, start] of [
      ['shared.feedback_rv_seq', 3], ['shared.feedback_epic_seq', 20],
      ['shared.feedback_fr_seq', 207], ['shared.feedback_be_seq', 93],
      ['shared.feedback_tc_seq', 51],
    ]) {
      await client.query(`CREATE SEQUENCE IF NOT EXISTS ${name} START WITH ${start}`);
    }

    const { rows } = await client.query(
      `SELECT f.id, f.type, f.object_type, fc.name AS category_name
         FROM shared.feedback f
         LEFT JOIN shared.feedback_categories fc ON fc.id = f.feedback_category_id
        WHERE f.ref IS NULL AND f.deleted_at IS NULL
        ORDER BY f.created_at ASC, f.id ASC`
    );
    const targets = rows.map((r) => ({ ...r, prefix: prefixFor(r) })).filter((r) => r.prefix);
    console.log(`Rows needing a ref: ${targets.length} (of ${rows.length} unref'd)`);
    if (!targets.length) {
      console.log('Nothing to backfill — done.');
      return;
    }

    await client.query('BEGIN');
    const assigned = [];
    for (const r of targets) {
      const res = await client.query(
        `UPDATE shared.feedback
            SET ref = $2 || lpad(nextval('${SEQ[r.prefix]}')::text, 5, '0')
          WHERE id = $1 AND ref IS NULL
          RETURNING ref, title`,
        [r.id, r.prefix]
      );
      if (res.rows[0]) assigned.push(res.rows[0]);
    }
    await client.query('COMMIT');

    console.log(`Assigned ${assigned.length} refs.`);
    const byPrefix = assigned.reduce((m, a) => {
      const p = a.ref.slice(0, 3);
      (m[p] ||= []).push(a.ref);
      return m;
    }, {});
    for (const [p, refs] of Object.entries(byPrefix)) {
      console.log(`  ${p} ${refs.length}: ${refs[0]} … ${refs[refs.length - 1]}`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Backfill failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
