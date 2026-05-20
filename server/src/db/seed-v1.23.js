// One-off seed: v1.23 feedback prompt + test_case. Idempotent.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Home page admin settings — labels, component toggles, theme';
const VERSION = 'v1.23';
const SHIPPED_DATE = '2026-05-18';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'preview';

const NOTES = `## Home page admin settings

Admin-configurable settings strip on the
dashboard, matching the marketplace
ConfigStrip pattern.

### Configurable labels
- Page label: "Projects" default, controls
  hero eyebrow. NEW field homePageLabel added
  to PlatformConfig.
- Credits label: "Balls" default, cascades to
  all credit references on dashboard + nav pill
  via creditLabel.
- Events label: "Events" default, cascades to
  Active/Past Events section headers via
  projectLabel.

### Theme
Five colour dot swatches (Amber/Emerald/Pink/
Ocean/Slate). Updates ConfigService.themeName;
CSS variables apply immediately.

### Component toggles
- Organisation name (always on, disabled checkbox)
- User name & role pill (default: on)
- Location pill (default: on)
- Upcoming events pill (default: off — NEW)
- Stats bar / KPI strip (default: on)

### Upcoming-event pill (NEW)
Optional third hero pill showing the next
project + countdown ("London Tech Week · in
20 days"). ShellContext gained an upcomingPill
field; AppShell renders with a calendar icon
when ConfigService.showUpcoming is on.

### Storage
ConfigService (existing pattern — single
PlatformConfig in localStorage). All fields
were already there except homePageLabel,
which was added.

### Admin visibility
Settings strip only visible to admin users
(ConfigStripService.register + top-nav's
hasConfig && isAdmin gate — same as the
marketplace cog).`;

const TEST_NOTES = `Verify: (1) Admin sees gear icon (cog) in top-nav on Home page. Click expands settings strip. (2) Non-admin users don't see the cog or the strip. (3) Change page label from 'Projects' to 'Events' — hero eyebrow updates immediately ('EVENTS'). (4) Change credits label from 'Ball' to 'Credit' — KPI stat, sidebar 'Credits remaining this month', nav pill, and 'only spend a Credit when ready' description all update. (5) Change events label from 'Event' to 'Show' — 'Active Shows' / 'Past Shows' headers update. (6) Toggle off User pill — user name/role chip disappears from hero. Toggle back on. (7) Toggle off Location — location chip disappears. (8) Toggle on Upcoming — calendar pill appears with the next project's name + countdown ('London Tech Week · in 20 days'). (9) Toggle off Stats bar — KPI strip hides entirely. (10) Theme swatch click — dashboard theme accent updates (border on active swatch). (11) Settings persist on reload. (12) Organisation name checkbox is disabled + shows '(always on)'. (13) ng build passes.`;

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
                tags=ARRAY['feature','settings','dashboard','v1.23']::text[],
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
                 ARRAY['feature','settings','dashboard','v1.23']::text[],
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
         VALUES ($1,$2,'Test: Home settings v1.23',$3,$4,
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
