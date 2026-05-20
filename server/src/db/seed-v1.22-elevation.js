// One-off seed: v1.22 elevation-system feedback prompt + test_case.
// Stacks on top of the existing v1.22 dashboard-polish entry — same
// version, different title, separate row.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Elevation system + dashboard visual polish';
const VERSION = 'v1.22';
const SHIPPED_DATE = '2026-05-18';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'preview';

const NOTES = `## Elevation system + dashboard polish

### Elevation tokens (global styles.css)
Four shadow levels (xs/sm/md/lg) + two hairline
border variants + four border-radius tokens
added alongside existing theme tokens.

  --shadow-xs / -sm / -md / -lg
  --border-hairline / -strong
  --radius-card (12px) / -button (8px) /
  -pill (999px) / -input (6px)

### Card treatment (dashboard)
Level 1 (rest): shadow-xs + hairline + 12px radius.
Level 2 (hover): shadow-sm + stronger border +
translateY(-1px). Applied to project cards,
supplier sidebar tiles, past event carousel cards.

### Level 3 elevation
Project card "..." dropdown + new user-pill
dropdown both use shadow-md + hairline +
8px radius. Floating UI reads at one level.

### Header band
.bp-hero now has a hairline border-bottom so it
reads as a distinct surface from the body.

### Avatar
Top-right avatar circle shows USER initials
(orgService.getUsers()[0].name) not org. Falls
back to orgName until users load.

### Header pills — interactive
Both pills have hover state (--theme-accent
border + --theme-bg fill).
  User pill: dropdown with Profile / Switch Org /
    Sign out (stubs — toast for now).
  Location pill: click → /settings. Map-pin icon
    already present from existing template.

### + New project (filled-primary)
Reverted from outlined to filled per the button
standard. Themed accent fill, white text, no
shadow at rest; shadow-sm on hover; scale(0.98)
on active.

### Balls pill (top-nav)
Soft-filled instead of outlined — was competing
visually with the active nav-tab underline (same
colour). Now --theme-bg background, no border.

### Eyebrow consistency
.bp-section-title + .bp-saved-hd unified to
weight 500 / letter-spacing 0.06em (was 700 /
0.1em). Less heavy.

### Border-radius audit (dashboard)
All hardcoded radii mapped to tokens. 50% kept
where it represents a circle (dots, avatar).

### DAR Hire logo overflow
Defensive overflow:hidden + img max-width on
.bp-item-card-img in catalogue-grid so wide-
aspect logos can't escape the card edge.`;

const TEST_NOTES = `Verify: (1) Project cards have subtle shadow at rest, lift on hover (shadow + 1px up). (2) Supplier cards same treatment. (3) Past event cards same. (4) Avatar shows user initials not org. (5) User pill hover changes border + background. Click opens dropdown with Profile / Switch Org / Sign out. Profile routes, others toast. Document-click outside closes. (6) Location pill click goes to /settings. (7) Header has hairline border below it separating from KPI strip. (8) All dashboard cards have 12px radius (--radius-card). (9) DAR Hire logo doesn't overflow. (10) Section eyebrows consistent — weight 500, letter-spacing 0.06em. (11) Balls pill in top-nav is soft-filled (--theme-bg background, no border). (12) "+ New project" is filled primary (amber fill, white text), shadow-sm on hover, scale(0.98) on press. (13) Quick Actions / View all closed / My Suppliers / Browse suppliers stay outlined secondary. (14) No hardcoded shadow / border-radius values in dashboard component. (15) ng build passes.`;

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
                tags=ARRAY['design-system','polish','dashboard','v1.22']::text[],
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
                 ARRAY['design-system','polish','dashboard','v1.22']::text[],
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
         VALUES ($1,$2,'Test: elevation system + dashboard polish v1.22',$3,$4,
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
