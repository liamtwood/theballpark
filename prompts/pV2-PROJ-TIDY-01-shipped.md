# pV2-PROJ-TIDY-01 — Projects table: drop 6 dead columns (status_id kept)

**Shipped:** 2026-09-17, chip `Dev v2.482`
**Owner:** CC. Chat (design) authored the spec. Liam gave the direct GO for the
destructive DROP ("drop the 6, keep status_id"). Dev-only this pass; rides to
preview/master at the next promote (drops are idempotent, all three schemas).

## Scope change vs the prompt — status_id KEPT (pre-check blocker)
The prompt listed 7 columns. The required `status_id` pre-check found it is **not
dead** — it has live consumers, so per the prompt's own "pause and report" rule
it was excluded:
- v1 `project.service.js` (:4200) JOINs `statuses` on `p.status_id` (getAll/getById)
  to render the status label.
- v2 `projects.service.js` **and** `inbox.service.js` **dual-write** it
  (`resolveStatus` → `status_id=$n`; the message-suppliers live-flip does
  `UPDATE projects SET … status_id=$3`). The prompt's change-list didn't cover
  those two v2 files, so dropping the column would break v2 project create/update
  and the message-suppliers flip.

Dropping `status_id` needs its own v1-status-FK decommission (remove the v2
dual-write, repoint v1's JOIN to the `status` text, migrate the v1 model) —
**tracked as BE-00094**. The other 6 dropped cleanly.

## What landed — 6 columns dropped across public/preview/master
`ai_hints`, `missing_fields` (0-data, superseded by `parsed_brief_json`) and
`stand_size`, `stand_width_m`, `stand_depth_m`, `stand_type` (v1 exhibition
legacy, unused in v2).

- **`migrate-schemas.js`** — removed the 6 from the `preview.projects` CREATE def
  (master = `LIKE preview`), and added idempotent `ALTER … DROP COLUMN IF EXISTS`
  for each of the 6 across public/preview/master in the early projects-ALTER
  block. Applied: verified all three schemas now expose only `status_id` from the
  target set (the 6 are gone). Re-run is a no-op.
- **`project.service.js`** (v1) — stripped the 6 from create() (destructure +
  INSERT: 31→25 params, renumbered), update() (destructure + UPDATE: 34→28
  params, renumbered), duplicate() (INSERT: 24→20 params). `status_id` untouched
  everywhere (draft-default, JOINs, dual-write intact).
- **`seed.js`** — removed `stand_*` from both project inserts (26→22 params each).
- **`client-angular/.../project.model.ts`** (v1) — deleted the 6 optional fields;
  `status_id?` kept.
- **client-v2** — no references; builds clean.

## Files touched
| File | Notes |
|---|---|
| server/src/db/migrate-schemas.js | CREATE def trimmed + 18 idempotent DROP COLUMN IF EXISTS (6 cols × 3 schemas) |
| server/src/services/project.service.js | 6 cols stripped from create/update/duplicate; params renumbered; status_id kept |
| server/src/db/seed.js | stand_* removed from both project seed inserts |
| client-angular/src/app/models/project.model.ts | 6 optional fields deleted |
| client-v2/src/environments/environment.ts | chip → v2.482 |

## Acceptance
- [x] Pre-check done; `status_id` has a live consumer → excluded + logged (BE-00094).
- [x] migrate-schemas drops all 6 across public/preview/master idempotently; verified applied.
- [x] SELECT on projects no longer returns the 6 (information_schema check: only status_id remains of the set).
- [x] client-v2 builds clean.
- [x] One atomic commit; chip bumped.
- [~] Server boot + project round-trip: syntax-checked + param counts verified; Liam spot-checks a create/read/update on localhost (v1 :4200 + v2).

## Concerns not in spec
- **`migrate-schemas.js` aborts later on `column "message_item_id" does not
  exist`** (a different table's step, ~line 2139) on this DB — pre-existing,
  NOT from this change. The projects drops run early (before that step) so they
  applied cleanly, but a full `db:migrate:schemas` run doesn't complete on this
  DB. Flagged already in the FEEDBACK-REF iteration; worth fixing before the next
  promote's schema step relies on a clean full run.
- **v1 `migrate.js` (deprecated)** still contains the 6 column defs — left as-is
  (prompt said optional; no new logic added there).
- `duplicate()` doc comment still says "dimensions" in its non-copied list —
  cosmetic; the stand_* copy is gone.

## QC notes
(Liam)

## Chat audit
(chat)
