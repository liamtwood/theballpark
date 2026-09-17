# pV2-FEEDBACK-REF-01 — Human-readable ref codes for the tracker

**Type:** server + schema (additive) · small UI surface
**Owner:** CC implements + commits. Chat authored this spec.
**Why:** `shared.feedback` rows need short human refs (like project `BP-019`).
The tracker is a requirements-management system with a clear hierarchy, so refs
are **prefix-scoped by level**.

**Note:** v2.470 already built a single `F-` generator + backfill. This spec
**supersedes** that: switch `F-` → `BE-`, and add the `EP-` and `FR-` streams.
The data is already migrated (see "Already seeded").

---

## Scheme (decided) — three streams, one `ref` column

**Hierarchy: EP → FR → BE → Test Case.**

| Prefix | Level | Category | Numbering |
|---|---|---|---|
| **`EP-`** | Epic (feature area) | `Epic` | from 20 (1–19 seeded) |
| **`FR-`** | Functional Requirement (planned capability under an epic) | `Requirement` | **from 207** (201–206 seeded; 1–200 = backfill room) |
| **`BE-`** | **Bug / Enhancement / Question** (issue-level work) | Bug, Enhancement, Question, Prompt | from 93 (1–92 seeded) |
| — | Test Case | `Test Case` | no ref (UUID) |

- **`BE-` is type-independent.** A "question" often turns out to be a bug, a
  "bug" an enhancement — they all start as *something to investigate*. So Bug /
  Enhancement / Question **share the BE- stream**, and reclassifying between them
  **never changes the ref** (the type is a mutable attribute; the id is stable).
- **`EP-` / `FR-` are levels** (an epic never becomes a requirement) → stable
  prefixes of their own.
- Folders (`object_type='folder'` — releases, test runs) and Test Cases get **no
  ref**.

---

## Already seeded (do NOT overwrite)
The `ref` column + `uq_feedback_ref` index exist, and refs are assigned:
- **19 epics** `EP-00001…EP-00019` (v0.1.0 base release)
- **6 requirements** `FR-00201…FR-00206` (the roadmap items)
- **92 issues** `BE-00001…BE-00092` (backfilled)

The generators must **continue past these**, and the backfill must **skip any
row that already has a `ref`**.

---

## Changes

### 1. Schema — `server/src/db/migrate-schemas.js` (idempotent; already applied to dev)
```sql
ALTER TABLE shared.feedback ADD COLUMN IF NOT EXISTS ref VARCHAR(16);
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_ref
  ON shared.feedback (ref) WHERE ref IS NOT NULL AND deleted_at IS NULL;
-- three sequences, started past the seeded max
CREATE SEQUENCE IF NOT EXISTS shared.feedback_be_seq   START WITH 93;   -- BE-
CREATE SEQUENCE IF NOT EXISTS shared.feedback_epic_seq START WITH 20;   -- EP-
CREATE SEQUENCE IF NOT EXISTS shared.feedback_fr_seq   START WITH 207;  -- FR-
```
If a sequence already exists, `setval` it to `max(number for that prefix)` so it
never re-issues an assigned ref. `feedback` is in the `shared` schema — follow
the file's shared-schema handling.

### 2. Ref generation — `server/src/services/feedback.service.js`
Replace the v2.470 single-`F-` logic. In `create(data)`, assign by
`feedback_category` name:
```
Epic         → 'EP-' || lpad(nextval('shared.feedback_epic_seq')::text, 5, '0')
Requirement  → 'FR-' || lpad(nextval('shared.feedback_fr_seq')::text,   5, '0')
else (Bug/Enhancement/Question/Prompt, object_type='issue', not test_case)
             → 'BE-' || lpad(nextval('shared.feedback_be_seq')::text,   5, '0')
```
Skip ref for `object_type='folder'` and `type='test_case'`. **Never overwrite an
existing `ref`.** Set it in the same INSERT (or `SELECT nextval` just before) —
sequences are atomic, no locks.

### 3. Backfill — already done for the 92 BE + 19 EP + 6 FR
The one-time backfill is complete (chat ran it). Keep a guarded migration that
assigns refs to any *future* unref'd issue rows chronologically, skipping rows
that already have one — idempotent.

### 4. Surface the ref (light UI) — mostly built (v2.470–478)
The My-issues table + What's New already show the ref. Just ensure they render
whatever prefix the row carries (BE-/EP-/FR-), not a hard-coded `F-`.

---

## Acceptance
- [ ] New Bug/Enhancement/Question → `BE-`; new Requirement → `FR-`; new Epic →
      `EP-`; each from its sequence, continuing past the seeded max.
- [ ] Reclassifying Bug↔Enhancement↔Question leaves the `BE-` ref unchanged.
- [ ] No row gets two refs; `uq_feedback_ref` holds; test cases/folders get none.
- [ ] UI shows the row's actual prefix (no hard-coded `F-`).
- [ ] Server boots; one build; chip bumped.

## Concerns not in spec
Note: v0.1.1's **frozen** fixes-table note was generated with the old `F-`
prefix; the tracker now shows `BE-` for those same issues. Since released notes
are immutable, v0.1.1 keeps `F-` historically (or regenerate it to `BE-` if Liam
prefers consistency over the freeze rule — his call).
