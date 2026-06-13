# pV2-PROJECTS-03 (scoped) — Add Project: brief → AI → project, no items

**Scope (Liam, 2026-06-13):** "just what we did in v1 — upload text, autocreate project using AI, no items, then we can test the main flow." So this ships the create *spine*: the `/projects/new` brief page + AI parse + project create. The "Your ballpark is ready" item-recommendation accordion (add-project-2.png) and the AI-recommendations Y/N entry branch are DEFERRED.

**Shipped:** 2026-06-13, chips `[Dev v2] v2.23a` (server) + `v2.23b` (client)
**Commits:** `072c8eb` (server: create endpoint), `2da7e3d` (client: page + AI service)

## What landed

- **`POST /api/projects-v2`** (gated, org from JWT) — `ProjectsService.create` wraps the org ref-counter bump + the insert in `withTransaction` (Rule 1 — v1's create did both writes untransacted) and **dual-writes** `status='draft'` + the resolved `status_id`. `ProjectCreateSchema` (Zod) maps the brief fields; `tier` is an enum (`starter|professional|premium`) matching the `projects_tier_check` constraint.
- **`AiService`** (client) reuses the proven v1 endpoints as-is: `POST /api/ai/parse-brief` (Haiku parser → `ParsedBrief`) and `POST /api/ai/extract-text` (file → text). No new AI infra.
- **`parsedBriefToCreate`** mapper — `ParsedBrief` → create payload; the parser's capitalised `budgetSignal` lowercases to the tier enum, `Unknown`/off-enum drops to undefined (the constraint has no 'unknown').
- **`/projects/new` page** per add-project-1.png: Upload Brief dropzone + Write Brief textarea (`.bp-card` + `.bp-icon-block`), gradient "Build my {eventLabel}" CTA, staged busy labels (reading file → understanding brief → building), success toast → navigate to `/projects`. Route swapped from the coming-soon stub.

## Files touched
| File | SHA | Notes |
|---|---|---|
| server/.../schemas/project-create.schema.js | 072c8eb | NEW — Zod create body, tier enum |
| server/.../services/projects.service.js | 072c8eb | + create() (withTransaction, dual-write) |
| server/.../routes/projects-v2.js | 072c8eb | + POST / (Zod, org from JWT) |
| client-v2/.../core/ai/ai.service.ts | 2da7e3d | NEW — parseBrief + extractText |
| client-v2/.../core/projects/project.types.ts | 2da7e3d | + ProjectCreatePayload + parsedBriefToCreate |
| client-v2/.../core/projects/project.service.ts | 2da7e3d | + create() |
| client-v2/.../pages/projects/projects-new.component.ts | 2da7e3d | NEW — brief page |
| client-v2/.../app.routes.ts, app.config.ts | 2da7e3d | route + Upload/Sparkles icons |

## Acceptance
- create() dual-writes status + status_id, atomic, ref generated — ✓ service smoke (card returned, status_id→draft, BP-001, cleaned up)
- tier maps to the constraint enum — ✓ (smoke passed with 'professional'; 'Professional'/'Unknown' handled client-side)
- brief page builds + reuses v1 AI endpoints — ✓ compiles; **live AI run not exercised** (see concerns)
- Greens — ✓ client build/lint/guard + 67; server 48/48

## API audit checklist
#### `POST /api/projects-v2` (new)
- ✓ Method (create→201) / ✓ Auth: v2 gate / ✓ **org_id from JWT only** / ✓ Input: Zod, tier enum, lengths capped / ✓ Status codes (201/400) / ✓ Atomicity: withTransaction (Rule 1) / ✓ Information disclosure: returns own-org card / ✓ Observability: next()→central handler / ✓ Dual-write keeps v1 status_id consistent

## Concerns not in spec

### Live flow not exercised end-to-end
**What:** The create path is service-smoke-verified, but the full **brief → /api/ai/parse-brief → create** chain hasn't run live: (1) the :3001 server predates the new route + needs a restart; (2) `/api/ai/parse-brief` requires `ANTHROPIC_API_KEY` in the server env (v1-proven, presumed set). Liam to run one brief through after a server bounce.
**Severity:** MEDIUM (blocks confirmation, not correctness)

### Reuses the ungated v1 /api/ai endpoints
**What:** Per "what we did in v1," the brief parse/extract reuse `/api/ai/*`, which are mounted ungated. They're stateless transforms (no org data), so acceptable; a gated v2 AI surface is a later hardening if wanted.
**Severity:** LOW

### budget string not stored as a number
**What:** `ParsedBrief.budget` ("£80k–£120k") isn't parsed into `project_budget` (numeric) — left null; the full brief lives in `raw_brief_text` + `parsed_brief_json`. Totals stay null (no items). Fine for the scoped flow.
**Severity:** LOW

### This populates PROJECTS-01's empty list
**What:** Creating projects here is also the organic fix for the PROJECTS-01 QC data gap (Liam's org had 0 projects). After a live create, `/projects` shows real cards.
**Severity:** N/A (note)

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in — leave the section header so chat finds it)
