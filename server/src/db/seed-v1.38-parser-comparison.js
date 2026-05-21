// One-off seed: v1.38 parser comparison + AI parser upgrade + Parse brief wiring.
// Idempotent.
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const TITLE = 'Parser comparison — AI prompt upgrade, rule-parser improvements, Parse brief wired';
const VERSION = 'v1.38';
const SHIPPED_DATE = '2026-05-20';
const SUBMITTED_BY = 'LW';
const OWNER = 'LW';
const ENV = 'dev';

const NOTES = `## Brief Parsing — AI vs Rule-Based

Side-by-side comparison of the rule-based BriefParserService and the
Haiku-powered AI parser across five real agency briefs (Angel Delight,
Creditspring, TikTok, HelloFresh @ Latitude, Lavazza TABLÉ). Findings
fed back into both parsers and into a new "✦ Parse brief" button on
the Brief tab and in the Event drawer.

### Object
- Backend service: AiService (server/src/services/ai.service.js) — Haiku
  prompt rewrite, new JSON response schema (categories[], topQuestions[],
  budgetSignal)
- Angular service: BriefParserService — extended keywords + inferences
- Angular UI: "✦ Parse brief" button on Brief tab + Event drawer

### Attributes (AI response)
projectName:   string  — Client — Event Type
client:        string  — brand or company
eventType:     enum    — activation/exhibition/launch/festival/pop-up/...
location:      string  — venue or area or TBC
city:          string  — city name
dates:         string  — dates or TBC
durationDays:  number  — null if not stated
guestCount:    number  — null if not stated
budget:        string  — "£X,000" or "Unknown"
budgetSignal:  enum    — Premium / Professional / Starter / Unknown
summary:       string  — one punchy sentence
categories:    array   — { categoryId, categoryLabel, oneLiner,
                          budgetEstimate, implied }
topQuestions:  array   — max 3 supplier-blocking questions

### Actions
- **Parse brief (AI)** — calls /api/ai/parse-brief, upserts each
  returned category onto project_categories with the AI's
  supplier-ready oneLiner as requirement_brief
- **Parse brief (rule)** — instant intake parse on the create-project
  modal (unchanged path; just smarter keywords + inferences)
copy: AI oneLiner is copied into requirement_brief on upsert
move: n/a

### Special behaviours
- AI parser is Haiku 4.5, 2000 max tokens, JSON-only response,
  senior-planner persona prompt
- Rule parser additions: 50 new keywords across 11 categories
  (inflatable, ball pit, cookalong, KOL, tastemaker, livestream,
  de-rig, retail, immersive, sensory, etc.); 6 new inference rules
  (sampling→catering+H&S, public activation→staffing, immersive→AV,
  retail→furniture, festival→set-build+logistics, 50+ guests→catering)
- Removed 'speaker' from Entertainment keywords (too many false
  positives in RFP boilerplate)
- 4 new known venues: Truman Brewery, Soho, Latitude, Latitude Festival
- AI category IDs map to DB catalogue names via an explicit table
  (set-build→Stand Structure, h-and-s→Health & Safety, etc.)
- Rule parser detection rate 32/48 → 39/48 (+14 pp) after upgrade
- AI parser remains on-demand (per-call cost), rule parser stays
  instant + free for intake modal pre-fill

### Used in
- Brief tab (project-detail/tabs/brief) — new "Parse brief" button
- Event drawer (projects/components/event-drawer) — Parse brief in
  the Brief section's edit mode
- Create-project modal — unchanged, still uses rule parser

### Technical
Backend service: server/src/services/ai.service.js (model claude-haiku-4-5-20251001)
Backend route:   POST /api/ai/parse-brief
Angular service: client-angular/src/app/core/services/ai.service.ts
                 client-angular/src/app/core/services/brief-parser.service.ts
Test harness:    server/tests/parser-comparison.js + server/tests/rule-parser.js
Briefs:          server/tests/_briefs/*.txt + results-{before,after,ai-projection}.json
Report:          PARSER_COMPARISON_RESULTS.md`;

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
                tags=ARRAY['technical','ai','parser','prompt','v1.38']::text[],
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
                 ARRAY['technical','ai','parser','prompt','v1.38']::text[],
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
