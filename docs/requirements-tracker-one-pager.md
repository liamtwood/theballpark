# Ballpark — Requirements Tracker (Feedback subsystem)

The requirements-management + QC + feedback subsystem — the tool that tracks the
product's own development *and* user feedback. It's epic **EP-00016 (Requirements
Management)**, and it's tracking these very epics. Lives in the **`shared`
schema** (cross-environment), so a `public`-only scan misses it.

## The hierarchy — RV → EP → FR → BE → TC
| Level | Ref | What | Groups… |
|---|---|---|---|
| **Release** | `RV-#####` | a shipped release (v0.1.0, v0.1.1…) | epics via `target_version` |
| **Epic** | `EP-#####` | a feature area (19 of them, in 4 groups) | requirements/issues |
| **Requirement** | `FR-#####` | a planned capability under an epic (from 201) | issues |
| **Bug / Enhancement / Question** | `BE-#####` | issue-level work — one type-independent stream | — |
| **Test Case** | `TC-#####` | QC case, under a Test Run folder | — |

Seeded today: RV×2 · EP×19 · FR×6 · BE×92 · TC×50.

**Ref rules:** five prefix streams on one `ref` column (`shared.feedback.ref`).
`BE-` is **type-independent** — Bug/Enhancement/Question all start as "something
to investigate" and morph into each other, so reclassifying never renumbers.
`RV-/EP-/FR-/TC-` are stable levels. Non-Release folders (Test Run) get no ref.
Full spec: `prompts/pV2-FEEDBACK-REF-01-prompt.md`.

## Data model
- **`shared.feedback`** — every record: `ref`, `title`, `notes`, `status`,
  `priority`, `type`, `object_type` (`issue` | `folder`), `feedback_category_id`,
  `area_category_id`, `epic_group`, `target_version`, `parent_id` (tree),
  `submitted_by`, audit + soft-delete.
- **`shared.feedback_categories`** — the classification: issue/level types
  (Bug, Enhancement, Question, Prompt, **Epic**, **Requirement**, **Test Case**),
  folder types (**Release**, Test Run, Sprint, Workshop, Note, Minutes), and
  **area** rows (Projects, Catalogue, Suppliers, AI Agent, Auth, Settings…).
- **Linking:** releases ← epics via `target_version`; epics ← requirements/issues
  via `parent_id` / `target_version`; test cases ← Test Run folders via
  `parent_id`. `epic_group` puts epics into the 4 release-note groups
  (Organizations & Roles · Project · Marketplace · Platform & Admin).
- **Status vocab:** `open · todo · in_progress · pass · fail · done`. Test cases
  run `todo → pass/fail`; work items `open → done`.

## It generates the release notes (then freezes them)
The What's New notes are **populated from this tracker at promote, then
immutable**:
- **Base / feature release** → area sections from **epics**
  (`feedback_category='Epic'`, `target_version=<release>`), grouped by
  `epic_group` → `area`, as a **Ref · Feature · What's new** table.
- **Patch release** → a **fixes table** from **issues** (`target_version`,
  `status=done`): `Ref · Fixed · Reported by · ✓`.
- Frozen once released; the generator won't rewrite a shipped version.
- Source of truth for the note content, not the hand-written `.md`.

## Surfaces (v2, live on preview since v0.1.1)
- **What's New** — master-detail page (release rail → detail), reached from the
  user menu. `pages/whats-new`.
- **Report Issue** dialog — pick type + page/area, title, details → `POST
  /api/feedback`; `submitted_by` from the JWT (not the body), Zod-validated.
- **My Issues** table — the signed-in user's own issues (`mine` filter,
  JWT-derived). Ref · Type · Area · Title · Status · Date.
- Spec: `prompts/pV2-WHATSNEW-REDESIGN-01-prompt.md`.

## Services / API
- **`server/src/services/feedback.service.js`** — `create` (assigns the ref by
  kind), `list` (+ filters), `getCategories`, `createCategory`.
- **`server/src/routes/feedback.js`** — `GET /api/feedback`, `/:id`,
  `/categories`, `/versions`; `POST /api/feedback` (create).

## Open / notes
- The ref generator in code (v2.470) still emits the old `F-`; CC's follow-up
  (pV2-FEEDBACK-REF-01) switches it to the 5 prefix streams.
- v0.1.1's frozen note shows `F-` historically; the tracker now shows `BE-` for
  those issues (decision pending: keep frozen vs regenerate to `BE-`).
- No customer-facing "requirements" surface — this is internal/admin; end users
  only see Report Issue + My Issues + What's New.
