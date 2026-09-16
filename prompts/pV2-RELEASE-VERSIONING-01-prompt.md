# pV2-RELEASE-VERSIONING-01 — Client-facing release versioning + release notes + About

**Type:** client-v2 + build/process · low risk (mostly labels + one env field)
**Owner:** CC implements + commits. Chat authored this spec.
**Why:** A client (Beth Pizey) is now reviewing preview. The granular build
counter `v2.NNN` is the wrong thing to show them. Introduce a client-facing
**release** version, drive all client surfaces from it, and make the release
note + About update a fixed per-promote step so it's consistent every release.

---

## The scheme (decided)

- **Internal build** — `v2.NNN`, bumped every commit. Unchanged. Engineering /
  QC traceability.
- **Client release** — `v0.MINOR.PATCH`, bumped per **promote**, by content:
  - fixes / small tweaks → **PATCH** (v0.1.0 → v0.1.1)
  - feature bundle → **MINOR** (v0.1.x → v0.2.0)
  - prod launch (GA) → **MAJOR** (→ v1.0.0)
- **This prompt lands the MACHINERY** (fields, chip, About, changelog re-key).
  The per-release *value* is set by the release runbook
  (`pV2-RELEASE-SEQUENCE-01`), not hardcoded here.
- **v0.1.0** = the "Ballpark Base Release" baseline (current preview, built from
  `v2.464`; note `docs/release-notes/v0.1.0.md`) — the changelog history entry.
- **v0.1.1** = the FIRST actual promote carrying this machinery (the Beth bug
  fixes). So set staging **release = v0.1.1** when this + FEEDBACK-REF promote.
- **v0.1.2** = project tidy (next promote). `v1.0.0` reserved for prod GA.
- Every release is **stamped with its source build**: "Preview v0.1.1 · built
  from v2.NNN".

**Single source of truth:** the release version lives in the environment file;
the chip, About, and What's New all read from it (or from `changelog.json`
derived on promote) so they can never disagree.

---

## Changes

### 1. Environment fields — `environment.staging.ts` / `.prod.ts` / `.ts`
Replace the single `versionChip` string with structured version fields:
```ts
// environment.staging.ts  (set to the version being promoted — v0.1.1 first)
release: 'v0.1.1',      // client-facing
build:   'v2.NNN',      // source dev build (traceability)
versionChip: 'Preview v0.1.1',   // derived label the chip shows
```
- `environment.prod.ts`: `release: 'v1.0.0'` (reserved), `build` set at cutover,
  chip `'v1.0.0'`.
- `environment.ts` (dev): keep the build counter; `release: 'dev'`, chip
  `'Dev v2.NNN'` as today. Dev has no client release.
- Keep whatever reads `versionChip` working (update its call sites if the shape
  changes).

### 2. Version chip + About — `shell/user-menu/user-menu.component.ts` (+ chip)
- The visible version everywhere the client sees it shows the **release**
  headline: **"Preview v0.1.1"**, with the build as a small secondary
  ("build v2.NNN") — e.g. on hover, or a muted sub-line.
- The **About** line in the user menu reads `release` + `build` from
  `environment` (single source) — so it updates automatically each release with
  no separate edit.

### 3. Release notes / What's New data — keep the pipeline, enrich the schema
The existing pipeline (`docs/release-notes/<ver>.md` → `scripts/gen-changelog.js`
→ `client-v2/public/changelog.json` → `pages/whats-new`) stays. Re-key to the
release version AND enrich the schema so the redesigned page
(`pV2-WHATSNEW-REDESIGN-01`) has structured data to render:
- Each **version entry** in `changelog.json` gains:
  - `release` (headline, e.g. `v0.1.1`), keeping `version` (build) for trace.
  - **`name`** — the release name (e.g. "Ballpark Base Release", "Bug fixes").
  - **`datetime`** — promote timestamp (date **+ time**), not just `date`.
    Source it from the promote (or the Release record's timestamp).
- Each **note item** becomes structured: `{ type, text }` where `type` ∈
  `new | improved | fixed` — so the page can show typed chips instead of raw
  markdown. (This kills the current raw-`**bold**` rendering bug.)
- **Patch releases** carry a `fixes` array **populated from the database at
  promote, then frozen** — NOT hand-written, NOT a live render-time query:
  - A generator step queries `shared.feedback` WHERE `target_version=<release>`
    AND `status='done'` → `{ ref, reporter, text, done }` rows → writes them into
    the release-note file / `changelog.json` **once**, at promote time.
  - **Immutable once released.** After a version is promoted, its fixes list is a
    permanent snapshot — the generator must NOT overwrite/regenerate an already-
    released version (idempotent no-op if the version already exists in
    `changelog.json`). Only the not-yet-promoted version can be (re)generated.
  - `reporter` = the issue's `submitted_by` → user name; `ref` = the `F-#####`;
    `text` = a client-safe line (issue title, tidied). The page renders these
    read-only as the fixes table — no edit path.
  - Net: stamping an issue's `target_version` + promoting = it appears
    automatically; nobody types or later edits the list.
- `gen-changelog.js`: parse `name` + item `type` + `datetime` from the
  release-notes file (header + typed bullets) into `changelog.json`.
- Release-notes files named by release (`docs/release-notes/v0.1.1.md`). The
  base note `docs/release-notes/v0.1.0.md` stays as the history entry.

### 4. Promote playbook — make it consistent every release
Update the promote checklist (wherever it lives — `project_preview_deploy_playbook`
/ ARCHITECTURE.md / the promote doc) so **every promote** does, in order:
1. Decide the bump from content (PATCH fixes / MINOR features).
2. Set `environment.staging.ts` `release` (new version) + `build` (source dev
   build) + `versionChip`.
3. Write/curate the release note (`docs/release-notes/<release>.md`), then
   `npm run changelog` to regenerate `changelog.json` + `CHANGELOG.md`.
4. Verify the chip, What's New (preview section), and About all show the new
   release + source build.
This checklist is the "consistent each release" guarantee.

---

## Set current state now
- `environment.staging.ts` → `release: 'v0.1.1'`, `build: '<promoted v2.NNN>'`,
  chip `'Preview v0.1.1'` (this ships as part of the v0.1.1 bugs promote — see
  `pV2-RELEASE-SEQUENCE-01`).
- Keep the **v0.1.0** base entry (`docs/release-notes/v0.1.0.md`) in
  `changelog.json` history as the baseline; add the **v0.1.1** entry (fixes
  table) for this promote.

---

## Acceptance
- [ ] `environment.staging.ts` carries `release` + `build`; chip shows
      "Preview v0.1.1".
- [ ] User-menu About shows release headline + build sub-label, read from env.
- [ ] What's New preview section headlines the release version + "built from
      v2.464".
- [ ] `gen-changelog.js` carries `release` through; re-running is clean.
- [ ] Promote playbook updated with the 4-step release routine.
- [ ] v2 builds; dev chip still reads "Dev v2.NNN". Bump build chip.

## Concerns not in spec
Standard section. Flag any call sites that assumed the old flat `versionChip`
string, and confirm dev/preview/prod all render sensibly.
