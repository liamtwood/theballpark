# pV2-FEEDBACK-REF-01 — Human-readable ref codes for feedback issues

**Type:** server + schema (additive) · small UI surface
**Owner:** CC implements + commits. Chat authored this spec.
**Why:** `shared.feedback` rows are only addressable by UUID today. Add a short,
human ref (`F-00001`) so issues can be referenced in conversation and UI — same
idea as project `ref` (BP-019) and message `ref_code` (WA-001).

---

## Scheme (decided)

**One flat, global sequence** — `F-<NNNNN>`, zero-padded to 5: `F-00001`,
`F-00002`, …

- **Type-independent by design.** The ref does NOT encode Bug/Enhancement/
  Question — so reclassifying an issue's type never changes its ref. (This is
  the whole point: one stream, stable id, `type` is just a mutable attribute.)
- One shared sequence across all issue rows (not per-type, not per-project).
- Applies to `object_type = 'issue'` rows (Bug, Enhancement, Question, Prompt,
  Test Case all share the stream). Folders (`object_type = 'folder'`) don't need
  a ref — skip them.

---

## Changes

### 1. Schema — `server/src/db/migrate-schemas.js`
- Add `ref VARCHAR(12)` to `shared.feedback` (nullable — additive).
- Create a dedicated sequence for the number (concurrency-safe by construction —
  no advisory lock or retry needed):
  ```sql
  CREATE SEQUENCE IF NOT EXISTS shared.feedback_ref_seq;
  ```
- Unique partial index so refs never collide:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_ref
    ON shared.feedback (ref) WHERE ref IS NOT NULL AND deleted_at IS NULL;
  ```
- `feedback` is in the `shared` schema — follow the file's existing shared-schema
  handling; don't loop it through public/preview/master like app tables.

### 2. Ref generation — `server/src/services/feedback.service.js`
- In `create(data)`, for issue rows assign:
  ```
  ref = 'F-' || lpad(nextval('shared.feedback_ref_seq')::text, 5, '0')
  ```
  Set it in the same INSERT (or a `SELECT nextval` immediately before). The
  sequence guarantees uniqueness without locks or max+1 races. Skip ref for
  `object_type = 'folder'`.
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
