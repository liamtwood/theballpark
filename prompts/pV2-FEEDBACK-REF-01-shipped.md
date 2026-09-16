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

## QC notes
(Liam)

## Chat audit
(chat)
