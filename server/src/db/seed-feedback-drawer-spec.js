// One-off — insert two feedback specs that document the Feedback Edit
// Drawer + Tabular View work just shipped. Idempotent on title.
//
// Usage: node server/src/db/seed-feedback-drawer-spec.js

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const ENTRIES = [
  {
    title: 'Feedback Edit Drawer',
    priority: 1,
    target_version: 'v2.0',
    notes:
`## Feedback Edit Drawer

A structured edit drawer for viewing and updating feedback entries
— bugs, enhancements, prompts, questions and meeting notes. Provides
inline editing of all key attributes without leaving the current page,
with a markdown-powered notes field for rich content.

### Object
shared.feedback — single entry edit view

### Attributes
- **title**: string — the feedback item title (read-only in header)
- **type**: enum — bug / enhancement / prompt / question / minutes / sprint
- **status**: enum — open / in_progress / done / wont_fix
- **priority**: integer (1–5) — 1 is highest
- **owner**: string — initials of assigned team member (LW/BP/MG/JC)
- **target_version**: string — planned version e.g. v2.0
- **version**: string — actual shipped version (when done)
- **shipped_date**: date — actual ship date (when done)
- **area_category_id**: uuid — product area (Auth, Settings, Projects...)
- **pages**: TEXT[] — list of page URLs where issue was observed
- **tags**: TEXT[] — freeform labels e.g. feature-spec, v2.0
- **notes**: text — markdown content (via app-markdown-editor)
- **due_date**: date — optional deadline
- **submitted_by**: string — who logged it
- **created_at**: timestamptz — when logged

### Actions
- **Edit type** — clickable pill in header, dropdown to change
- **Edit status** — clickable pill in header, dropdown to change
- **Edit priority** — P1–P5 pill in header, dropdown to change
- **Edit owner** — initials pill in header, cycles through team
- **Edit target version** — pill in header, dropdown or free text
- **Edit area** — dropdown in body, first field
- **Edit pages** — editable list in body, inline add/remove
- **Edit notes** — app-markdown-editor, fills remaining height
- **Add attribute** — ··· button reveals due date, tags, linked folders
- **Save** — PATCH /api/feedback/:id with all changed fields
- **Delete** — soft delete with p-confirmDialog
- **Copy** n/a
- **Move** yes — reassign to different area via area dropdown

### Special behaviours
- Header shows type + status + owner + priority as interactive pills
- ··· button next to status row adds optional fields (due date, tags, links)
- Version pill shows "Target: vX.X" when open, "Fixed: vX.X" when done
- ··· button next to version pill changes or clears target version
- Area and Pages are the first two fields — side by side in one row
- Notes field fills all remaining drawer height via flex layout
- p-toast "Saved ✓" on successful save
- Delete requires p-confirmDialog confirmation

### Used in
- **Feedback page** — right panel detail view, opens on row/card click
- **Meeting notes page** — opens on action item click (future)

### Technical
- **Component**: feedback-drawer.component.ts (or inline in feedback.component.ts)
- **Path**: client-angular/src/app/features/feedback/
- **Depends on**: app-markdown-editor, app-status-badge, p-sidebar, p-confirmDialog
- **API**: PATCH /api/feedback/:id, GET /api/feedback/categories?namespace=area`
  },
  {
    title: 'Feedback Table View',
    priority: 2,
    target_version: 'v2.0',
    notes:
`## Feedback Table View

A compact tabular view of feedback entries providing at-a-glance
visibility of priority, status and version across all issues.
Complements the existing grid and list views, and is the most
efficient format for sprint planning and backlog review.

### Object
shared.feedback — list view, tabular format

### Attributes (columns displayed)
- **Title** — entry title, truncated at 40 chars, clickable
- **Area** — area icon + name (from area_category_id join)
- **Priority** — P1–P5 amber pill (shown when open/in_progress, — when done)
- **Status** — app-status-badge
- **Version** — target_version when open, shipped_date + version when done

### Actions
- **Sort** — by title, priority, status (column header click)
- **Filter** — by area circle, status, type (existing filter bar)
- **Open** — row click opens feedback drawer for that entry
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Toggle between Grid / List / Table via p-selectButton
- Default sort: priority ASC (P1 first), then status ASC
- Priority column hidden for done entries — shows — instead
- Version column shows two states:
    open/in_progress → target_version as amber pill e.g. "v2.0"
    done → shipped_date (dd MMM yy) + version badge e.g. "v1.7"
- Row click opens same drawer as grid/list view
- p-table styleClass="bp-table"
- All columns sortable via p-sortIcon

### Used in
- **Feedback page** — third view option alongside Grid and List
- **Sprint planning** — most useful view for prioritising work

### Technical
- **Component**: feedback.component.ts (table view added inline)
- **Path**: client-angular/src/app/features/feedback/
- **Depends on**: p-table, app-status-badge
- **API**: GET /api/feedback (existing, includes priority + target_version)`
  }
];

const TAGS = ['feature-spec', 'v2.0'];

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const cat = await pool.query(
      `SELECT id FROM shared.feedback_categories
        WHERE name = 'Prompt' AND object_type = 'issue' LIMIT 1`
    );
    if (!cat.rowCount) throw new Error('Prompt category not found');
    const promptId = cat.rows[0].id;

    const area = await pool.query(
      `SELECT id FROM shared.feedback_categories
        WHERE name = 'Feedback' AND namespace = 'area' LIMIT 1`
    );
    if (!area.rowCount) throw new Error('Feedback area not found');
    const areaId = area.rows[0].id;

    let inserted = 0, updated = 0;
    for (const e of ENTRIES) {
      const existing = await pool.query(
        `SELECT id FROM shared.feedback WHERE title = $1 LIMIT 1`,
        [e.title]
      );
      if (existing.rowCount) {
        await pool.query(
          `UPDATE shared.feedback
              SET feedback_category_id = $1,
                  area_category_id     = $2,
                  notes                = $3,
                  status               = 'open',
                  tags                 = $4,
                  priority             = $5,
                  target_version       = $6,
                  object_type          = 'issue',
                  type                 = 'prompt'
            WHERE id = $7`,
          [promptId, areaId, e.notes, TAGS, e.priority, e.target_version, existing.rows[0].id]
        );
        console.log(`updated:  ${e.title}`);
        updated++;
      } else {
        await pool.query(
          `INSERT INTO shared.feedback
             (feedback_category_id, area_category_id, title, notes, submitted_by,
              environment, object_type, type, status, tags,
              priority, target_version)
           VALUES ($1, $2, $3, $4, 'Liam', 'dev', 'issue', 'prompt', 'open', $5,
                   $6, $7)`,
          [promptId, areaId, e.title, e.notes, TAGS, e.priority, e.target_version]
        );
        console.log(`inserted: ${e.title}`);
        inserted++;
      }
    }
    console.log(`\nDone. inserted=${inserted}, updated=${updated}`);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
