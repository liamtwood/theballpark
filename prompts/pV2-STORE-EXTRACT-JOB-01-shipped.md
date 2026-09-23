# pV2-STORE-EXTRACT-JOB-01 — Background pull jobs for the catalogue extractor

**Shipped:** 2026-09-23 · dev (public) · build v2.577
**Ask (Liam):** "spec and build the background job now" — a whole-catalogue pull is
minutes long; there was no cancel, and leaving the page lost the result. Store the
plan before loading, reconcile against it, run in the background with a cancel.

## What shipped

The Pull step now starts a **background job** instead of a blocking request:

1. **Plan snapshot up front** — `startPull` dedupes the selection by handle, applies
   the per-pull cap, and writes a `catalogue_extract_job` row (the deduped URL list +
   mapping + `selected`/`dropped` counts) *before any work*. Returns a `jobId` at once.
2. **In-process runner** — `runJob` processes the planned URLs one at a time,
   persisting progress (`processed/created/skipped/failed`) + results + gaps after
   each item. Survives the client leaving the page.
3. **Poll + re-attach** — the panel polls `GET …/extract/job/:jobId` every 1.5s and,
   on load, calls `GET …/extract/job` to re-attach to a job started earlier. Live
   progress bar + counts while running; settles into the existing result summary +
   gap report on `done`.
4. **Cancel** — `POST …/extract/job/:jobId/cancel` flips status to `cancelling`; the
   runner stops before the next item. Items already created stay pending.
5. **Admin DB context for a detached task** — the request's RLS context (the pinned
   client carrying `app.is_admin='t'`) is released when the HTTP response ends, so the
   fire-and-forget runner **re-establishes it** via `withAdminContext` (mirrors
   `middleware/request-context.js`). Without this every `createForOrg` insert fails
   RLS. Verified: before the fix, smoke inserts → *"row violates RLS policy for
   items"*; after, they succeed.

Builds on the same-day reconciliation fix (v2.575): `dedupeByHandle` reports drops,
so `created + skipped + failed + dropped = selected` — nothing vanishes untraced.

## Files

- `server/src/services/catalogue-extract.service.js` — refactored `pull` into
  `planPull` + `makePullContext` + `processUrl` + `summarizePull` (no dup); added the
  job engine: `withAdminContext`, `startPull`, `runJob`, `getJob`, `activeJobForOrg`,
  `cancelJob`, `jobToClient`, `loadPlan`, `isCancelled`. Exported the public four.
- `server/src/routes/admin-orgs.js` — `POST /extract/pull` now `startPull` (returns
  jobId; passes `req.user?.id`); new `GET /extract/job`, `GET /extract/job/:jobId`,
  `POST /extract/job/:jobId/cancel`. Pull-body url cap raised 100→500 (overflow is
  reported as `dropped`, not a 400).
- `client-v2/src/app/core/admin-org.service.ts` — `PullStart`/`PullJob` types;
  `extractPull` now returns `PullStart`; added `extractJob`/`extractActiveJob`/
  `extractCancel`.
- `client-v2/src/app/pages/suppliers/website-import-panel.component.ts` — job signal +
  polling + re-attach (`ngOnInit`) + cancel + progress bar; `done()` stops polling.
- `server/src/db/migrate-schemas.js` — table DDL + grants, placed EARLY + idempotent
  (BE-00095: file fatals partway) so forward builds get it in all schemas.

## DB (additive — no changes to existing objects)

`catalogue_extract_job` created in **public + preview + master** (via Supabase MCP),
with `GRANT SELECT,INSERT,UPDATE,DELETE … TO web_app_user` (+ `ALL TO service_role`),
matching `items`. No RLS on the table itself (admin-gated at the route; cross-org by
nature). Columns: id, org_id, status, mode, selected, total, plan, progress, results,
gaps, error, created_by, created_at, updated_at. Index on (org_id, created_at DESC).

## Verified

- Job engine smoke test (scratchpad): `startPull` → immediate jobId; per-item progress
  persisted (0→2); `running`→`done`; `activeJobForOrg` null after done; results carry
  named rows. Admin context makes cross-org inserts pass RLS. Two test artifacts
  soft-deleted afterwards.
- Server boots (health 200) after each service edit; `node --check` clean on all
  changed server files; `ng build` clean.

## Follow-ups / notes

- **Concurrency:** the runner still processes URLs sequentially (~5s each). A
  whole-site pull (hundreds) is still long — but now non-blocking + cancellable.
  Optional later: bounded concurrency + sitemap-driven discovery (lifts the 250-page
  crawl cap that caused the linen/tables miss).
- **Server restart mid-job:** an in-process runner dies with the process; the job row
  stays `running` (stale). A janitor sweep (mark `running` jobs older than N minutes
  `error`) is a small future add; not needed for QC.
- **QC:** dev `ng serve :4201` + server :3001. Analyse a section (e.g.
  `https://www.yahire.com/linen-hire`), Prepare, Load → watch the progress bar, try
  Cancel, leave the page and return (re-attach), confirm the final reconciliation
  line `N created · … · N dropped of M selected`.
