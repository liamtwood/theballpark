// One-off update: reflect the relaxed edit-pencil gate in the v1.17
// test case notes. Item #9 in the original list said "(9) No pencil on
// items from other orgs." — that gate is deferred to v2.0 (auth + roles).
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const NEW_NOTES = `Test: (1) Supplier detail Store — click item, verify 4 action icons on detail panel. (2) Click view (eye) — drawer opens in read-only mode with three tabs. All fields display-only. Close button works. (3) Click edit (pencil) on own item — drawer opens in edit mode. Change name, save. Verify persists. (4) Open drawer, switch to Images tab. Click empty slot — verify ImageUploadPanel opens. Upload image, verify thumbnail appears. Upload second image. Save. Verify both images persist on reload. (5) Verify first image (hero) shows on item card in grid. (6) Click + on item with projectId context — verify added to project, icon fills amber. Verify row appears in project_items with selection_type='selected'. Click again — verify removed. (7) Click heart — verify liked. Verify row appears in project_items with selection_type='liked'. Click + on liked item — verify upsert to selected (same row, type flipped, no duplicate). (8) No + or heart visible when logged in as supplier. (9) Edit pencil currently visible for ALL users — gating to own-org + platform-admin deferred to v2.0 (auth + roles). (10) ng build passes.`;

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const { rowCount } = await pool.query(
      `UPDATE shared.feedback
          SET notes = $1
        WHERE type = 'test_case'
          AND title = 'Test: drawer + detail panel v1.17'`,
      [NEW_NOTES]
    );
    console.log(`updated ${rowCount} test_case row(s)`);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
