# pV2-FEEDBACK-REF-01 — Human-readable ref codes for the tracker

**Type:** server + schema (additive) · small UI surface
**Owner:** CC implements + commits. Chat authored this spec.
**Why:** `shared.feedback` is a requirements-management tracker with a clear
hierarchy. Every record gets a short human ref, **prefix-scoped by level**.

**Note:** v2.470 built a single `F-` generator + backfill. This spec
**supersedes** it: `F-` → `BE-`, plus the RV-/EP-/FR-/TC- streams. The data is
already migrated (see "Already seeded").

---

## Scheme (decided) — five streams, one `ref` column

**Hierarchy: RV → EP → FR → BE → TC.**

| Prefix | Level | Category / rule | Numbering |
|---|---|---|---|
| **`RV-`** | Release version | `Release` folder | from 3 (1–2 seeded) |
| **`EP-`** | Epic (feature area) | `Epic` | from 20 (1–19 seeded) |
| **`FR-`** | Functional Requirement | `Requirement` | **from 207** (201–206 seeded; 1–200 = backfill room) |
| **`BE-`** | **Bug / Enhancement / Question** | those types, `object_type='issue'` | from 93 (1–92 seeded) |
| **`TC-`** | Test Case | `type='test_case'` | from 51 (1–50 seeded) |

- **`BE-` is type-independent.** Bug / Enhancement / Question all start as
  *something to investigate* and morph into each other, so they **share one
  stream** — reclassifying never changes the ref (type is a mutable attribute).
- **`RV-` / `EP-` / `FR-` / `TC-` are levels** — stable prefixes.
- **Non-Release folders** (e.g. Test Run) get **no ref**.

---

## Already seeded (do NOT overwrite)
The `ref` column + `uq_feedback_ref` index exist, and refs are assigned:
- **2 releases** `RV-00001` (v0.1.0), `RV-00002` (v0.1.1)
- **19 epics** `EP-00001…EP-00019`
- **6 requirements** `FR-00201…FR-00206`
- **92 issues** `BE-00001…BE-00092`
- **50 test cases** `TC-00001…TC-00050`

Generators **continue past these**; the backfill **skips any row with a `ref`**.

---

## Changes

### 1. Schema — `server/src/db/migrate-schemas.js` (idempotent; already on dev)
```sql
ALTER TABLE shared.feedback ADD COLUMN IF NOT EXISTS ref VARCHAR(16);
CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_ref
  ON shared.feedback (ref) WHERE ref IS NOT NULL AND deleted_at IS NULL;
CREATE SEQUENCE IF NOT EXISTS shared.feedback_rv_seq   START WITH 3;    -- RV-
CREATE SEQUENCE IF NOT EXISTS shared.feedback_epic_seq START WITH 20;   -- EP-
CREATE SEQUENCE IF NOT EXISTS shared.feedback_fr_seq   START WITH 207;  -- FR-
CREATE SEQUENCE IF NOT EXISTS shared.feedback_be_seq   START WITH 93;   -- BE-
CREATE SEQUENCE IF NOT EXISTS shared.feedback_tc_seq   START WITH 51;   -- TC-
```
If a sequence already exists, `setval` it to `max(number for that prefix)`.
`feedback` lives in the `shared` schema — follow the file's shared-schema handling.

### 2. Ref generation — `server/src/services/feedback.service.js`
Replace the v2.470 single-`F-` logic. In `create(data)`, assign by kind:
```
Release (category 'Release', folder) → 'RV-' || lpad(nextval(feedback_rv_seq),5,'0')
Epic         (category 'Epic')        → 'EP-' || lpad(nextval(feedback_epic_seq),5,'0')
Requirement  (category 'Requirement') → 'FR-' || lpad(nextval(feedback_fr_seq),5,'0')
Test Case    (type='test_case')       → 'TC-' || lpad(nextval(feedback_tc_seq),5,'0')
else (Bug/Enhancement/Question issue) → 'BE-' || lpad(nextval(feedback_be_seq),5,'0')
```
Skip ref for **non-Release folders**. **Never overwrite an existing `ref`.**
Sequences are atomic — no locks.

### 3. Backfill — done for the seeded set
Complete (chat ran it). Keep a guarded, idempotent migration that assigns refs
to any *future* unref'd rows by the rules above, skipping rows that already have
one.

### 4. Surface the ref (light UI) — mostly built (v2.470–478)
My-issues + What's New already show the ref. Ensure they render whatever prefix
the row carries (RV-/EP-/FR-/BE-/TC-), never a hard-coded `F-`.

---

## Acceptance
- [ ] New records get the right prefix from the right sequence, continuing past
      the seeded max (Release→RV, Epic→EP, Requirement→FR, Test Case→TC, else→BE).
- [ ] Reclassifying Bug↔Enhancement↔Question leaves the `BE-` ref unchanged.
- [ ] No row gets two refs; `uq_feedback_ref` holds; non-Release folders get none.
- [ ] UI renders the actual prefix (no hard-coded `F-`).
- [ ] Server boots; one build; chip bumped.

## Concerns not in spec
v0.1.1's **frozen** fixes note was generated with the old `F-`; the tracker now
shows `BE-` for those issues. Released notes are immutable, so v0.1.1 keeps `F-`
historically — unless Liam prefers regenerating it to `BE-` for consistency.
