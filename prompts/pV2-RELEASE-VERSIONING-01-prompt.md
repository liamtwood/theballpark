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
- **v0.1.0 = the "Ballpark Base Release"** — the FIRST release under this scheme,
  and it IS this upcoming promote (built from the promoted dev build, ~v2.469+).
  Its note (`docs/release-notes/v0.1.0.md`) describes the whole product, not a
  delta. It supersedes the old unversioned `v2.464` preview entry as the
  client-facing headline.
- **Next promote after v0.1.0** → `v0.1.1` (patch) or `v0.2.0` (features).
- **`v1.0.0` reserved for prod GA.**
- Every release is **stamped with its source build**: "Preview v0.1.0 · built
  from v2.464".

**Single source of truth:** the release version lives in the environment file;
the chip, About, and What's New all read from it (or from `changelog.json`
derived on promote) so they can never disagree.

---

## Changes

### 1. Environment fields — `environment.staging.ts` / `.prod.ts` / `.ts`
Replace the single `versionChip` string with structured version fields:
```ts
// environment.staging.ts
release: 'v0.1.0',      // client-facing
build:   'v2.464',      // source dev build (traceability)
versionChip: 'Preview v0.1.0',   // derived label the chip shows
```
- `environment.prod.ts`: `release: 'v1.0.0'` (reserved), `build` set at cutover,
  chip `'v1.0.0'`.
- `environment.ts` (dev): keep the build counter; `release: 'dev'`, chip
  `'Dev v2.NNN'` as today. Dev has no client release.
- Keep whatever reads `versionChip` working (update its call sites if the shape
  changes).

### 2. Version chip + About — `shell/user-menu/user-menu.component.ts` (+ chip)
- The visible version everywhere the client sees it shows the **release**
  headline: **"Preview v0.1.0"**, with the build as a small secondary
  ("build v2.464") — e.g. on hover, or a muted sub-line.
- The **About** line in the user menu reads `release` + `build` from
  `environment` (single source) — so it updates automatically each release with
  no separate edit.

### 3. Release notes / What's New — keep the pipeline, add the release headline
The existing pipeline (`docs/release-notes/<ver>.md` → `scripts/gen-changelog.js`
→ `client-v2/public/changelog.json` → `pages/whats-new`) stays. Re-key the
**client-facing headline** to the release version:
- Add a `release` field to each **preview** entry in `changelog.json`
  (headline `v0.1.1`), keeping `version` (build `v2.469`) for traceability.
- `whats-new.component.ts`: the **preview** section headlines the **release**
  version + date + "built from vX.NNN". (The "on dev — not yet on preview"
  section can stay build-keyed — it's the internal demo list.)
- `gen-changelog.js`: carry the `release` through from the release-notes file's
  header/frontmatter into `changelog.json`.
- Release-notes file: name it by release (`docs/release-notes/v0.1.1.md`) or add
  a `release:` header line — CC's call, but the release version must be the
  human headline.

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
- `environment.staging.ts` → `release: 'v0.1.0'`, `build: 'v2.464'`, chip
  `'Preview v0.1.0'`.
- Add/mark the current preview changelog entry (the `v2.464` one) with
  `release: 'v0.1.0'`.
- (The **v0.1.1** entry gets written when the pV2-PROJ-UX-01 bundle promotes —
  not in this prompt; this prompt just lands the scheme + v0.1.0 baseline.)

---

## Acceptance
- [ ] `environment.staging.ts` carries `release` + `build`; chip shows
      "Preview v0.1.0".
- [ ] User-menu About shows release headline + build sub-label, read from env.
- [ ] What's New preview section headlines the release version + "built from
      v2.464".
- [ ] `gen-changelog.js` carries `release` through; re-running is clean.
- [ ] Promote playbook updated with the 4-step release routine.
- [ ] v2 builds; dev chip still reads "Dev v2.NNN". Bump build chip.

## Concerns not in spec
Standard section. Flag any call sites that assumed the old flat `versionChip`
string, and confirm dev/preview/prod all render sensibly.
