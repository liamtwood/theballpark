# pV2-PROJECTS-S1 — Projects slice Stage 1 (Create) PORT onto the rebuilt schema

**Shipped:** 2026-10-14, chip `[Dev v2] v2.748` (server v2.747 · client v2.748)
**Branch:** `rebuild/org-slice` (v2dev — Supabase `jwerngwvensmmhwrcgul`)
**Commits:**
- `34159c2b` feat(projects): S1 port — projects service/route onto the rebuilt schema
- `ed01caed` feat(projects): S1 port — create flow + detail hero (FR-00240)

Builds on `30d3dc7b` (the S1 tables: projects / project_settings / project_categories).

## What landed
- **Service ported to the rebuilt schema** (`projects.service.js`). Dropped the v1 status
  dual-model (status is a TEXT `project_status` code; the `statuses` table + `status_id` are
  gone). `resolveStatus` kept as a **no-DB shim** so the dormant S3 `inbox.service` require-
  surface stays intact.
- **`create()`** inserts the new `projects` columns (no `venue_city` / `status_id` /
  `default_*_pct`), seeds a **all-NULL `project_settings` row** (null = inherit org default), and
  **scaffolds `project_categories`** from the parsed brief (AI `oneLiner` → `requirement_brief`,
  `AI_TO_DB`-resolved `category_id` else a custom/null bucket, raw payload → `match_result_json`).
  All in one `withTransaction` (Rule 1). Currency seeds from `orgs.default_currency`.
- **`toCard` / `toDetail`** read the `cover` / `client` jsonb bags + `project_settings`;
  `ballparkCost`/`supplierCount`/`quote_*`/`sow_*`/`images`/`totalBallparkCost` return
  null/0/[]/defaults (their tables are S2/S4). `getDetail` drops the `clients` join.
- **`updateDetail`** splits the PUT across `projects` columns / `cover`+`client` jsonb merges /
  `project_settings` upsert, transactionally. Keys with no backing column (venueCity, cardColor,
  images, sow_*, quote_*) are silently ignored.
- **Route trimmed to the S1 surface** (`projects-v2.js`): list / client-names / next-ref / create
  / get / put. The S2/S3/S4 endpoints (items, estimate, components, recommend, parse-intent,
  quote-description) are removed → the client's dormant calls get clean 404s, not DB 500s. The
  `intent.service` / `inbox.service` imports (dormant) are dropped from the route.
- **Create flow** (`projects-new.component.ts`): dropped the slide-3 "building your project"
  4-step deck for a simple loading state; removed the S2 `recommend()` call; lands on the project
  detail (default tab).
- **Detail hero (FR-00240)** (`project-detail.component.ts`): the draft `app-page-hero` is now
  **client eyebrow / project title / event-summary subtitle**, **Back** = "Back" + history-aware,
  top-left. Dropped the S2 right-hand Ballpark meta (returns with the line cluster) + the unused
  `CurrencyPipe`.

## Files touched
| File | SHA | Notes |
|---|---|---|
| server/src/services/projects.service.js | 34159c2b | status model, create+scaffold, toCard/toDetail, updateDetail, jsonb bags |
| server/src/routes/projects-v2.js | 34159c2b | trimmed to S1 routes; dropped dormant imports/endpoints |
| client-v2/.../projects-new.component.ts | ed01caed | drop slide-3 deck + recommend; simple loading |
| client-v2/.../project-detail.component.ts | ed01caed | FR-00240 draft hero; drop CurrencyPipe |

## Acceptance — verified
- **Create round-trip against the live v2dev schema** (real insert + rollback-by-delete via
  Supabase MCP): projects INSERT ✓, all-NULL project_settings ✓, 2× project_categories with
  `ON CONFLICT (project_id, category_id) WHERE deleted_at IS NULL DO NOTHING` (mapped Catering +
  null bucket) ✓, getDetail join returns `cover={}`/`client={}`/null settings ✓.
- **Update path**: projects cols (status/client_name) + cover jsonb + client jsonb + settings
  upsert (budget/margin) all round-trip ✓; test rows cleaned up (cascade verified 0/0/0).
- **All 13 `AI_TO_DB` targets exist** as top-level categories in v2dev → the scaffold resolves
  real `category_id`s.
- **Backend boots clean** on :3002 (v2dev, `public`) — service module loads with all exports.
- **Client compiles clean** on :4202 (bundle complete, no warnings after the CurrencyPipe drop).

## QC gate (Liam, on :4202)
Create a project from a brief → it saves (project + project_settings + project_categories) and the
detail page renders with the **client eyebrow / project title / event-summary subtitle** hero +
"Back". NB the draft tab **bodies** (Ballpark Cost / Marketplace) depend on the line cluster (S2) —
they're empty/404 until S2; the S1 gate is the hero + that create saves.

## API audit checklist (Rule 10) — routes modified
#### `POST /api/projects-v2/` (create)
✓ Method semantics (create → 201) · ✓ Input validation (`ProjectCreateSchema` zod, org_id never
accepted) · ✓ Authorization (gated router: authenticate + requireActiveMembership; org_id from JWT)
· ✓ Status codes (201 / 400) · ✓ Response shape (list card) · ✓ Info disclosure (no raw DB errors;
UUID param guard) · ✓ Observability (central error handler) · N/A Idempotency (ref counter is
atomic; create is intentionally non-idempotent) · ✓ Performance (one transaction; scaffold is N
short writes bounded by brief categories).
#### `GET /api/projects-v2/:id` (detail) & `GET /` (list) & `GET /client-names` & `GET /next-ref`
✓ Method (read) · ✓ AuthZ (org from JWT; `WHERE org_id = $`) · ✓ 404 on not-own/missing/deleted ·
✓ Info disclosure (UUID param → 400 before DB) · ✓ Performance (indexed `projects_org_idx`; detail
is a single LEFT JOIN).
#### `PUT /api/projects-v2/:id` (update)
✓ Method (partial update) · ✓ Input validation (`ProjectUpdateSchema`; unmapped keys ignored, not
written) · ✓ AuthZ (`FOR UPDATE` ownership gate inside the txn; org from JWT) · ✓ Status (200 /
400 / 404) · ✓ Multi-write under `withTransaction` (Rule 1) · ✓ Response (fresh detail re-fetched
post-commit).

## Concerns not in spec
### Dormant S2/S3 functions reference not-yet-built tables/columns
**Where:** `projects.service.js` — getEstimate/listItems/addItem/recommend/components (~L560+).
**What:** these read `project_items` (+ `p.default_*_pct` on getEstimate) which don't exist on
v2dev. They're unwired (routes removed) so they never run; left in place per the task ("stay
dormant") to make the S2 re-attach a smaller diff.
**Suggested fix:** re-point to the freeze+overlay model + `project_settings` when S2 is ported.
**Severity:** LOW (dormant).

### `recommend()` still carries the old `namespace='catalogue'` filter
**Where:** `projects.service.js` recommend() category lookup.
**What:** v2dev `categories` dropped the `namespace` column; `scaffoldCategories` was fixed to
`parent_id IS NULL`, but the dormant `recommend()` still filters `namespace='catalogue'` and would
throw if ever called. Left as-is (dormant, re-ported in S2).
**Severity:** LOW (dormant) — flagged so S2 fixes it.

### Draft tab bodies 404 in S1
**Where:** project-detail draft tabs (Ballpark Cost / Marketplace).
**What:** they call the removed S2 item/estimate endpoints → 404. Expected; the S1 gate is the hero.
**Severity:** LOW (by design).

### venue_address_id not wired
`venueAddress` returns null (FR-00239, deferred — ties to the addresses slice). **Severity:** LOW.

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in)
