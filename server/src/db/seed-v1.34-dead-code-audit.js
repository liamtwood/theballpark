// One-off seed: v1.34 dead code audit — Knip install + first report. Idempotent.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Dead code audit — Knip installation and first report';
const VERSION = 'v1.34';
const SHIPPED_DATE = '2026-05-20';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'dev';

const NOTES = `## Dead code audit

Installed Knip for static dead code analysis.
Ran first audit and produced DEAD_CODE_AUDIT.md
report with findings: unused files, dependencies,
exports, and types.

npm script added: npm run audit:dead-code

No code was deleted — audit only. Purge planning
follows in a separate prompt.`;

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const promptCat = await pool.query(
      `SELECT id FROM shared.feedback_categories WHERE name='Prompt' AND object_type='issue' LIMIT 1`
    );
    const areaTech = await pool.query(
      `SELECT id FROM shared.feedback_categories WHERE namespace='area' AND name='Technical' LIMIT 1`
    );
    if (!promptCat.rowCount || !areaTech.rowCount) {
      throw new Error('Prompt or Technical area category not found');
    }
    const promptId = promptCat.rows[0].id;
    const techAreaId = areaTech.rows[0].id;

    const existing = await pool.query(
      `SELECT id FROM shared.feedback WHERE title=$1 AND version=$2 LIMIT 1`,
      [TITLE, VERSION]
    );
    if (existing.rowCount) {
      await pool.query(
        `UPDATE shared.feedback
            SET notes=$1, status='done', shipped_date=$2,
                feedback_category_id=$3, area_category_id=$4,
                type='prompt', object_type='issue',
                environment=$5, version=$6, submitted_by=$7,
                tags=ARRAY['technical','audit','dead-code','v1.34']::text[],
                priority=3
          WHERE id=$8`,
        [NOTES, SHIPPED_DATE, promptId, techAreaId, ENV, VERSION, SUBMITTED_BY, existing.rows[0].id]
      );
      console.log(`prompt updated: ${existing.rows[0].id}`);
    } else {
      const ins = await pool.query(
        `INSERT INTO shared.feedback
           (feedback_category_id, area_category_id, title, notes, submitted_by,
            environment, object_type, type, status, tags,
            version, shipped_date, area, owner, priority)
         VALUES ($1,$2,$3,$4,$5,$6,'issue','prompt','done',
                 ARRAY['technical','audit','dead-code','v1.34']::text[],
                 $7,$8,'Technical',$9,3)
         RETURNING id`,
        [promptId, techAreaId, TITLE, NOTES, SUBMITTED_BY,
         ENV, VERSION, SHIPPED_DATE, OWNER]
      );
      console.log(`prompt inserted: ${ins.rows[0].id}`);
    }
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
