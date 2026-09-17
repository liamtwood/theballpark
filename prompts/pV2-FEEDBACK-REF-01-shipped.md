# pV2-FEEDBACK-REF-01 — Human refs (F-NNNNN) for feedback issues

**Shipped:** 2026-09-16, chips `v2.470` (machinery) + surfaced in `v2.472` (UI).
**Owner:** CC. Chat authored the spec.

## What landed
- **Schema (`migrate-schemas.js`, shared):** additive `ref VARCHAR(12)` + `shared.feedback_ref_seq` + `uq_feedback_ref` partial unique index (`WHERE ref IS NOT NULL AND deleted_at IS NULL`). `shared` is one cross-environment schema.
- **Ref generation (`feedback.service.create`):** issue rows get `F-' || lpad(nextval(seq),5,'0')` in the INSERT (atomic, no locks). **Folders and `type='test_case'` are excluded** from the stream — flat, type-independent numbering (per the RELEASE-SEQUENCE runbook default). Reclassifying `type` never changes the ref.
- **Backfill (`migrate-feedback-ref.js`):** idempotent, chronological (`created_at ASC`); ran on the shared schema → **92 issues F-00001…F-00092**. The 5 Beth fixes are **F-00087–F-00091**; the rainbow-button bug is **F-00092**.
- **Ref surface (§4):** delivered via **pV2-WHATSNEW-REDESIGN-01** — the ref shows as an `F-#####` chip in the What's New fixes table and the My-issues table. (No standalone feedback list existed before; this is its first v2 surface.)

## Files touched
| File | Notes |
|---|---|
| server/src/db/migrate-schemas.js | ref column + sequence + unique index (shared.feedback) |
| server/src/services/feedback.service.js | ref on create (issue rows only, excl test_case) |
| server/src/db/migrate-feedback-ref.js | new — idempotent chronological backfill |

## Acceptance
- [x] New issue via `create()` gets `F-NNNNN`; folders/test_case excluded.
- [x] Reclassifying `type` leaves `ref` unchanged (ref is independent).
- [x] Backfill assigns chronological refs; re-run is a no-op; sequence past max.
- [x] `uq_feedback_ref` prevents duplicates; sequence is concurrency-safe.
- [x] Ref surfaced (via the redesign's tables).
- [x] migrate-schemas updated; server boots; chip bumped.

## Concerns not in spec
- **Test-case exclusion** deviates from this prompt's prose ("Test Case … share the stream") in favour of the newer RELEASE-SEQUENCE runbook default (exclude) — confirmed by Liam. Numbering: 92 non-test issues, rainbow = F-00092.

## Iteration — five prefix streams (2026-09-17, v0.1.2 bundle)
**Triggered by:** rewritten prompt — supersede the single `F-` stream with the
five level-scoped streams (RV→EP→FR→BE→TC). Data already migrated by chat.

**What changed**
- **`migrate-schemas.js`** — `ref` widened `VARCHAR(12) → VARCHAR(16)`; five
  sequences created (`feedback_{rv,epic,fr,be,tc}_seq`) with documented `START`
  values; each `setval`'d to `MAX(existing ref number for that prefix)` so the
  migration is a safe no-op on re-run and always sits one past live data. Old
  `feedback_ref_seq` left in place (now unused, harmless).
- **`feedback.service.create()`** — ref stream chosen by **level**: `type='test_case'`
  → `TC-`; category name `Release`→`RV-`, `Epic`→`EP-`, `Requirement`→`FR-`;
  non-Release folder → no ref; everything else (issue bug/enh/question) → `BE-`.
  Category name is looked up once (trusted mapping → sequence name inlined;
  `nextval()` keeps assignment atomic). `BE-` is type-independent, so
  reclassifying bug↔enh↔question never changes the ref (`patch()` never writes `ref`).
- **`migrate-feedback-ref.js`** — rewritten to the five-stream rules; guarded
  (only `ref IS NULL`), skips non-Release folders, idempotent.

**Applied to DB** — `migrate-schemas` ran; sequences aligned to live data:
BE→next 93, EP→20, FR→**209** (chat already added FR-00207/208), RV→3, TC→51.
(The shared schema block succeeded; a later unrelated `message_item_id` step in
migrate-schemas errored — pre-existing, not from this change — flagged below.)

**Client** — no change: the report toast already renders `created.ref` and
My-issues binds `f.ref`, so any prefix shows verbatim. What's New fix refs
switch to `BE-` via the v0.1.1 note edit (see WHATSNEW iteration).

**Concern:** `migrate-schemas.js` aborts later on `column "message_item_id" does
not exist` (a different table's step) on this DB — pre-existing, unrelated to the
feedback refs, but it means a full `db:migrate:schemas` run doesn't complete
cleanly here. Worth a separate look before the next promote's schema step.

## QC notes
(Liam)

## Chat audit
(chat)
