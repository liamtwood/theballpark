# pV2-FEEDBACK-REF-01 — Human-readable ref codes for feedback issues

**Type:** server + schema (additive) · small UI surface
**Owner:** CC implements + commits. Chat authored this spec.
**Why:** `shared.feedback` rows are only addressable by UUID today. Add a short,
human ref (BUG-001, ENH-014) so issues can be referenced in conversation and UI
— same idea as project `ref` (BP-019) and message `ref_code` (WA-001).

---

## Scheme

`<PREFIX>-<NNN>` — per-prefix, zero-padded to 3, global sequence (not
per-project). Prefix derived from the issue's `feedback_category` (or `type`):

| feedback_category / type | Prefix |
|---|---|
| Bug | `BUG` |
| Enhancement | `ENH` |
| Question | `QN` |
| Prompt | `PR` |
| Test Case | `TC` |
| folder (object_type='folder') | `FLD` |
| anything else / unknown | `FB` |

(If Liam picked a single flat `FB-###` stream instead, use that for all — confirm
before building. Default here is per-type.)

---

## Changes

### 1. Schema — `server/src/db/migrate-schemas.js`
- Add `ref VARCHAR(20)` to `shared.feedback` (nullable — additive).
- Add a unique partial index so refs don't collide:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_ref
    ON shared.feedback (ref) WHERE ref IS NOT NULL AND deleted_at IS NULL;
  ```
- Apply across the schemas the file already targets (note: `feedback` lives in
  the `shared` schema — follow the existing shared-schema handling in this file,
  don't loop it through public/preview/master like app tables).

### 2. Ref generation — `server/src/services/feedback.service.js`
- In `create(data)`, after the prefix is resolved, generate `ref` and include it
  in the INSERT. Mirror the `nextRefCode` pattern in `taxonomy.service.js`:
  resolve prefix → find the current max sequence for that prefix →
  `PREFIX-<max+1 zero-padded 3>`.
- **Concurrency:** wrap the read-max + insert so two simultaneous creates can't
  collide on the same ref — either a `pg_advisory_xact_lock` keyed on the prefix
  inside a `withTransaction`, or catch the unique-violation and retry once. Do
  NOT hand-roll BEGIN/COMMIT (hygiene Rule 1 — use the project's transaction
  helper).
- Prefix resolver: map from the row's `feedback_category` name (join
  `shared.feedback_categories`) or `type`, per the table above; fall back to `FB`.

### 3. Backfill — one-time migration (e.g. `server/src/db/migrate-feedback-ref.js`)
- Assign `ref` to all existing non-deleted `shared.feedback` rows that lack one,
  **grouped by prefix, ordered by `created_at ASC`**, so historical numbering is
  chronological. Idempotent (skip rows that already have a ref).
- Run it once against dev; it rides to preview/master at promote.

### 4. Surface the ref (light UI)
- Wherever feedback rows are listed/rendered today (the feedback drawer/list),
  show the `ref` as the leading identifier (e.g. a small mono chip `BUG-001`
  before the title). Backend + list display only — no new page.

---

## Acceptance
- [ ] New feedback via `create()` gets a `ref` (correct prefix + next sequence).
- [ ] Two rapid creates of the same prefix don't collide (advisory lock or
      retry proven).
- [ ] Backfill assigns chronological refs to all existing rows; re-running is a
      no-op.
- [ ] `uq_feedback_ref` prevents duplicates.
- [ ] Ref shows in the feedback list/drawer.
- [ ] migrate-schemas.js updated; server boots; one build. Bump chip.

## Concerns not in spec
Standard section. Note: the 5 client-feedback issues just logged
(area Projects, `pV2-PROJ-UX-01`) will get their refs from the backfill —
report what BUG/ENH numbers they land on.
