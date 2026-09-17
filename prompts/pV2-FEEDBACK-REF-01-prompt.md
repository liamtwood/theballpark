# pV2-FEEDBACK-REF-01 — Human-readable ref codes for feedback issues

**Type:** server + schema (additive) · small UI surface
**Owner:** CC implements + commits. Chat authored this spec.
**Why:** `shared.feedback` rows are only addressable by UUID today. Add a short,
human ref (`F-00001`) so issues can be referenced in conversation and UI — same
idea as project `ref` (BP-019) and message `ref_code` (WA-001).

---

## Scheme (decided)

**Two flat, prefix-scoped sequences** on one shared `ref` column:
- **`F-<NNNNN>`** — issues (Bug, Enhancement, Question, Prompt). `F-00001`…
- **`EP-<NNNNN>`** — **epics** (feedback_category = `Epic`). `EP-00001`…

- **Type-independent within a stream.** The ref does NOT encode Bug/Enhancement/
  Question — reclassifying an issue's type never changes its ref.
- **Prefix by record kind, not by type:** epics (category `Epic`) → `EP-`;
  everything else that gets a ref → `F-`.
- Applies to `object_type = 'issue'` rows. **Exclude `type='test_case'`** from
  the `F-` stream (test cases keep their UUID / TC identity). Folders
  (`object_type='folder'`) don't get a ref — skip them.

**Already seeded (do NOT overwrite):** the `ref` column exists, and **19 epics
`EP-00001…EP-00019`** (the v0.1.0 base release) are already assigned. Chat added
the column + these rows manually. The `EP-` sequence must continue **from 20**;
the `F-` sequence starts fresh. The backfill must skip any row that already has
a `ref`.

---

## Changes

### 1. Schema — `server/src/db/migrate-schemas.js`
- `ref VARCHAR(16)` on `shared.feedback` — **already added by chat; make it
  idempotent** so migrate-schemas is the source of truth without conflict:
  ```sql
  ALTER TABLE shared.feedback ADD COLUMN IF NOT EXISTS ref VARCHAR(16);
  ```
- **Two** sequences (concurrency-safe, no locks). Set `feedback_epic_seq` to
  start past the seeded epics (currently 19):
  ```sql
  CREATE SEQUENCE IF NOT EXISTS shared.feedback_ref_seq;                 -- F-
  CREATE SEQUENCE IF NOT EXISTS shared.feedback_epic_seq START WITH 20;  -- EP-
  ```
  (If the sequence already exists, `setval` it to `max(EP number)` so it never
  re-issues an assigned EP-.)
- Unique partial index (already added by chat; keep idempotent):
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_ref
    ON shared.feedback (ref) WHERE ref IS NOT NULL AND deleted_at IS NULL;
  ```
- `feedback` is in the `shared` schema — follow the file's existing shared-schema
  handling; don't loop it through public/preview/master like app tables.

### 2. Ref generation — `server/src/services/feedback.service.js`
- In `create(data)`, assign a ref by record kind:
  ```
  epic  (feedback_category = 'Epic') → 'EP-' || lpad(nextval('shared.feedback_epic_seq')::text, 5, '0')
  issue (not test_case, not folder)  → 'F-'  || lpad(nextval('shared.feedback_ref_seq')::text,  5, '0')
  ```
  Set it in the same INSERT (or `SELECT nextval` just before). Sequences
  guarantee uniqueness without locks/retries. Skip ref for `object_type =
  'folder'` and for `type='test_case'`. **Never overwrite an existing `ref`.**
- No hand-rolled transactions needed for this (sequence is atomic); if you touch
  more than one write, use the project's transaction helper (hygiene Rule 1).

### 3. Backfill — one-time migration (e.g. `server/src/db/migrate-feedback-ref.js`)
- Assign `ref` to all existing non-deleted `object_type='issue'` rows lacking
  one, **ordered by `created_at ASC`** (chronological numbering), pulling from
  the same sequence.
- Then ensure the sequence is past the highest assigned value (it will be, since
  the backfill draws from it) so new creates continue cleanly.
- Idempotent — skip rows that already have a ref.

### 4. Surface the ref (light UI)
- Wherever feedback rows are listed/rendered today (the feedback drawer/list),
  show `ref` as the leading identifier — a small mono chip `F-00001` before the
  title. Backend + list display only; no new page.

---

## Acceptance
- [ ] New issue via `create()` gets `F-NNNNN` from the sequence.
- [ ] Reclassifying an issue's `type` leaves its `ref` unchanged.
- [ ] Backfill assigns chronological refs to all existing issues; re-run is a
      no-op; sequence continues past the max.
- [ ] `uq_feedback_ref` prevents duplicates; concurrent creates don't collide.
- [ ] Ref shows in the feedback list/drawer.
- [ ] migrate-schemas.js updated; server boots; one build. Bump chip.

## Concerns not in spec
Standard section. The 5 client-feedback issues just logged (area Projects,
`pV2-PROJ-UX-01`) will get their `F-` numbers from the backfill — report which.
