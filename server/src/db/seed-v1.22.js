// One-off seed: v1.22 feedback prompt + test_case. Idempotent.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Dashboard polish — project cards, past events, date format, card menu';
const VERSION = 'v1.22';
const SHIPPED_DATE = '2026-05-18';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'preview';

const NOTES = `## Dashboard polish

Modest improvements to the agency dashboard.
No layout changes — existing sections stay as-is.

### Project cards
- Status pill on cover (Draft amber, Active green,
  Closed grey) — sentence case, solid fill, white
  text. Falls back to Draft when no status_name.
- Client chip on cover (bottom-left, white-translucent)
- Date in NATO format (DD-MMM-YYYY · in X days)
  via the new EventDatePipe; free text passes
  through unchanged.
- Estimate via the new CompactCurrencyPipe
  (£950 / £2.8k / £28k / £120k / £1.2m), '—' on null.
- "..." menu: Edit image, Copy, Delete. Click-outside
  closes via HostListener on document:click.

### Copy project
- POST /api/projects/:id/duplicate
- Clones top-level facts (client, event details,
  financial defaults, cover/logo/colour)
- Does NOT clone categories, items, estimates, messages
- New project starts as Draft, name = "Copy of {original}"
- Navigates to the new project's Brief tab

### Past Events carousel
- Replaces the previous full-grid "Completed Events"
- Horizontal scroll of compact 130px cards
- 72px cover, year overlay bottom-left (serif white +
  text-shadow), "Closed" grey pill top-right
- Body: name + "{client} · Est. £Xk"
- Hidden when no closed projects
- Capped at 10 cards; 10th fades when more exist
- "View all N closed →" link in header covers the rest

### "+ New project" button
- Themed pill in the Active Events section header
- Quick Actions link in sidebar stays — this position
  is just more discoverable

### Shared pipes
- shared/pipes/event-date.pipe.ts
- shared/pipes/compact-currency.pipe.ts`;

const TEST_NOTES = `Verify: (1) Project cards show status pill (Draft amber / Active green / Closed grey, sentence case). (2) Client chip bottom-left of cover (hidden when no client). (3) NATO date format with relative tail (e.g. '02-Jun-2026 · in 20 days'). (4) Estimate shows '£28k' or 'Est. —' via compactCurrency. (5) '...' menu opens with Edit image / Copy / Delete; click-outside closes it. (6) Edit image opens ImageUploadPanel. (7) Copy creates 'Copy of {name}', navigates to /projects/:id/brief. (8) Delete shows PrimeNG confirm; on confirm, soft delete + row disappears + toast. (9) '+ New project' button next to ACTIVE EVENTS header navigates to /projects/new. (10) Past Events carousel scrolls horizontally; cards show year overlay, Closed pill, client + estimate sub. (11) Carousel hidden entirely when no closed projects. (12) 'View all N closed ->' link in past events header. (13) EventDatePipe handles 'Late September' / 'TBC' as-is (no format applied). (14) CompactCurrencyPipe: < 1000 -> raw, 1k-9.9k -> 'X.Xk', 10k-999k -> 'Xk'. (15) ng build passes.`;

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
                tags=ARRAY['polish','dashboard','v1.22']::text[],
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
                 ARRAY['polish','dashboard','v1.22']::text[],
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
         VALUES ($1,$2,'Test: dashboard polish v1.22',$3,$4,
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
