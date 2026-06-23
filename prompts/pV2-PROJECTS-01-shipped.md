# pV2-PROJECTS-01 — Projects list view + project card + status dual-model

**Shipped:** 2026-06-13, chips `[Dev v2] v2.22a` (server) + `v2.22b` (client)
**Commits:** `0812b05` (server: migration + service + gated route), `39afb99` (client: list page + card)

## What landed

- **`projects.status` dual-model (option d).** migrate-schemas adds `projects.status TEXT` to public/preview/master; backfills 1:1 from `statuses.name` WHERE `entity_type='project'` (draft/active/completed/archived map exactly to the codelist), NULL `status_id` → the `draft` default. `status_id` left in place — v1 on :4200 untouched. Live verified: 35 draft / 2 active / 1 completed, **0 status↔status_id mismatches**.
- **`project_status` codelist consumer pointer wired** → `projects.status` (was NULL at CODELISTS-01 because the column didn't exist). Drives the `/settings/codelists` in-use deactivation gate.
- **`ProjectsService` (server)** — thin route, SQL here. `listForOrg(orgId)` returns card-shaped rows (org-scoped, soft-delete excluded, distinct-supplier subquery). `resolveStatus(code)` is the dual-write primitive (code → `{status, statusId}`) for PROJECTS-02/03 writers; `DEFAULT_STATUS='draft'`.
- **Gated `/api/projects-v2` (interim path).** v1 owns the live ungated `/api/projects` (and trusts query `org_id`), so v2 can't share/gate it; took `/api/projects-v2`, reclaim the clean path at v1 retirement (pV2-11). `org_id` from JWT only.
- **`<app-project-card>`** per CARDS.md image 8: cover (or `folder-open` placeholder), optional event-type `.bp-tag-chip` overlay, `.bp-ref-eyebrow`, 2-line-clamp name, `<app-status-pill list="project_status">`, suppliers + relative-age meta, `.bp-price-large` "£X Ballpark". Chrome from `.bp-card .bp-card--zoom` (zero component chrome — RP-07).
- **`/projects` list page** — `.bp-vpfit` shell, **full-width (rails dropped** per PROJECTS.md), Current | Completed `<app-tab-band>` bucketed by status with live count badges, `eventLabel`-driven copy, `resource()` load + empty/error states. Route swapped from the coming-soon stub.

## Files touched

| File | SHA | Notes |
|---|---|---|
| server/src/db/migrate-schemas.js | 0812b05 | projects.status ALTER + 1:1 backfill + draft default + consumer-pointer UPDATE (3 schemas) |
| server/src/services/projects.service.js | 0812b05 | NEW — listForOrg + resolveStatus dual-write primitive |
| server/src/routes/projects-v2.js | 0812b05 | NEW — gated GET / (org-scoped list) |
| server/src/index.js | 0812b05 | mount v2.use('/projects-v2', …) |
| client-v2/.../core/projects/project.types.ts | 39afb99 | NEW — ProjectCard + COMPLETED_STATUSES + relativeAge |
| client-v2/.../core/projects/project.service.ts | 39afb99 | NEW — list() → /api/projects-v2 |
| client-v2/.../pages/projects/project-card.component.ts | 39afb99 | NEW — image-8 card |
| client-v2/.../pages/projects/projects-page.component.ts | 39afb99 | NEW — list page + tabs |
| client-v2/.../app.routes.ts | 39afb99 | /projects → ProjectsPageComponent |

## Acceptance

- projects.status column + 1:1 backfill + draft default — ✓ live verified (0 mismatches)
- consumer pointer → projects.status — ✓ live verified
- v1 untouched — ✓ status_id kept; /api/projects unchanged; v1 reads its FK
- Project card matches image 8 — ⏳ awaiting Liam's visual QC (see data note below)
- Current/Completed bucket by status — ✓ in code (badges = counts)
- Greens — ✓ client build / lint / style-guard / 67 tests; server 48/48

## API audit checklist

#### `GET /api/projects-v2` (new)
- ✓ Method semantics (read) / ✓ Authorization: inherits v2 gate (authenticate + requireActiveMembership) / ✓ **org_id from JWT only** (never client) / ✓ Status codes (200; 401 unauth via gate) / ✓ Response shape (camelCase card array) / ✓ Information disclosure: org-scoped, soft-delete excluded / ✓ Observability: errors via next() → central handler / N/A Idempotency (GET) / ✓ Performance: single query; distinct-supplier correlated subquery bounded by an org's project count

## Concerns not in spec

### Live preview QC blocked twice over
**Where:** runtime, not code.
**What:** (1) The running :3001 API server predates the route mount, so `/api/projects-v2` 404s until it reloads/restarts (nodemon should pick it up; the codelists session was on an older process). (2) **No dev-seed agency user's org has any projects** — the 36 seeded projects sit in an orphan org (`b9025772`) with no active members; Liam's agency org (`30dd1b12`) has 0. So a live QC shows the (correct) empty state, not cards.
**Suggested fix:** reseed a handful of the orphan projects into Liam's agency org (low-risk — they're unreachable junk) OR seed fresh demo projects, so the card grid can be QC'd. Awaiting Liam's go before mutating ownership data.
**Severity:** MEDIUM (blocks visual QC, not the feature)

### eventLabel pluralisation is naive
**Where:** projects-page.component.ts labelPlural()
**What:** `eventLabel() + 's'` → Projects/Events/Jobs. Fine for the configured values; a label ending in 's'/'y' would mispluralise. No such value exists today.
**Severity:** LOW

### Supplier orgs reaching /projects
**Where:** route + tile.
**What:** The endpoint is org-scoped, so a supplier hitting /projects gets their own (none) — but suppliers shouldn't see the surface. Gating is the agent-only home tile; the route itself isn't role-gated beyond active membership. Fine for now (suppliers have no Projects tile); a `project.view` guard is a later hardening.
**Severity:** LOW

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in — leave the section header so chat finds it)
