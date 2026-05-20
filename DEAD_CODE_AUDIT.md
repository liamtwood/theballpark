# Dead Code Audit — Ballpark Angular client

**Tool:** [Knip](https://knip.dev) v5 (installed `--save-dev` in `client-angular/`)
**Run from:** `client-angular/`
**Command:** `npm run audit:dead-code` (`npx knip`)
**Config:** `client-angular/knip.json`
**Date:** 2026-05-20
**Mode:** AUDIT ONLY — no code deleted, no imports changed.

Knip exits with code `1` whenever it finds issues; that is expected for a
report run and does not indicate a tool failure.

---

## 1. Unused files

Files that exist in `src/` but are never imported or referenced from the
entry chain (`main.ts` → `app.component.ts` → `app.config.ts` →
`app.routes.ts`).

| # | Path | LOC | Assessment | Original purpose |
|---|------|-----|------------|------------------|
| 1 | `client-angular/src/app/core/services/ai.service.ts` | 11 | **Needs investigation** | Wraps `POST /ai/parse-brief` endpoint. Returns `ParsedBrief`. Server route may still exist — was used by an earlier brief-parsing flow now replaced by `brief-parser.service.ts`. |
| 2 | `client-angular/src/app/core/services/estimate.service.ts` | 14 | **Needs investigation** | CRUD wrapper over `/estimates` (`getAll`, `getById`, `create`, `update`, `delete`, `getByProject`). The whole estimates feature appears unwired in the Angular app — confirm the backend table/route status before deletion. |
| 3 | `client-angular/src/app/features/projects/pages/project-detail/tabs/event/event.component.ts` | 664 | **DO NOT DELETE** | Intentionally retained legacy file. Both `project-detail.routes.ts` and `event-drawer.component.ts` carry comments saying "kept in repo for git-history continuity" — the current Event UI lives in `event-drawer.component.ts`. This is a documented kept-for-history reference, not dead code. |
| 4 | `client-angular/src/app/shared/components/currency-display/currency-display.component.ts` | 13 | **Safe to delete** | Tiny wrapper around `GbpPipe` (`<span>{{ value \| gbp }}</span>`). Never referenced; the pipe is used directly everywhere else. |

**Subtotal:** 4 files, 702 lines (or **38 lines** once the intentionally-retained `event.component.ts` is excluded).

---

## 2. Unused dependencies (`package.json`)

| # | Package | Likely purpose | Safe to remove? |
|---|---------|----------------|-----------------|
| 1 | `autoprefixer` | PostCSS plugin for vendor prefixes. Angular CLI 17 pulls a copy transitively; top-level declaration is likely redundant. | **Needs investigation** — verify build still works after removal. Project has no explicit `postcss.config.*`, so Tailwind/CLI handles it implicitly. |
| 2 | `postcss` | CSS transform engine for Tailwind + autoprefixer. Same story as above — transitive dep of `tailwindcss` and `@angular-devkit/build-angular`. | **Needs investigation** — build may still work if removed, but keep until verified. |
| 3 | `primeflex` | CSS utility classes from the PrimeNG ecosystem (`p-flex`, `p-grid`, etc). Zero references in `src/**/*.{ts,html,css}` and no `@import` of its stylesheet. | **Yes** — genuinely unused, replaced by Tailwind. |
| 4 | `primeicons` | **FALSE POSITIVE.** Imported via CSS at `client-angular/src/styles.css:3` (`@import "primeicons/primeicons.css"`). All `pi pi-*` classes (e.g. `pi pi-times`, `pi pi-check`) depend on it. Knip does not scan CSS `@import`s. | **No — do not remove.** |

**Subtotal:** 1 confirmed-safe (`primeflex`), 2 needs-investigation (`autoprefixer`, `postcss`), 1 false positive (`primeicons`).

---

## 3. Unused exports

| # | File | Export | Type | Assessment |
|---|------|--------|------|------------|
| 1 | `src/app/core/icons.ts:109` | `iconToKebab` | function | **In use internally** (`icons.ts:122`) but not consumed by other modules. Drop the `export` keyword rather than delete. |
| 2 | `src/app/models/index.ts:1` | `Status` | re-export | **Dead barrel re-export.** `Status` model is only consumed by `status.service.ts`, which itself is no longer imported anywhere (status badges read static colour classes from `styles.css`). Safe to remove from barrel; underlying model file `models/status.model.ts` would die with it. |
| 3 | `src/app/models/index.ts:8` | `Estimate` | re-export | **Dead barrel re-export** — only consumer is the unused `estimate.service.ts`. Tied to (#1.2 above). |
| 4 | `src/app/models/index.ts:10` | `BallsTransaction` | re-export | **Dead barrel re-export** — no consumer in code. Confirm with backend whether transactions UI is planned before pruning the model. |
| 5 | `src/app/models/index.ts:11` | `ParsedBrief` | re-export | **Dead barrel re-export** — only consumer is the unused `ai.service.ts`. Tied to (#1.1 above). |

---

## 4. Unused types / interfaces

| # | File | Symbol | Assessment |
|---|------|--------|------------|
| 1 | `src/app/core/icons.ts:102` | `IconName` (type) | Defined `keyof typeof ICON_REGISTRY`, never referenced. **Safe to delete.** |
| 2 | `src/app/core/services/brief-parser.service.ts:38` | `ParsedCategory` (interface) | **In use internally** at line 35 (`ParsedCategory[]`). Drop the `export` keyword, do not delete. |
| 3 | `src/app/core/services/shell-context.service.ts:18` | `ShellBack` (interface) | **In use internally** at line 35 (`back?: ShellBack`). Drop the `export` keyword, do not delete. |
| 4 | `src/app/models/balls-transaction.model.ts:1` | `BallsTransaction` (interface) | Functionally dead — no consumer. Tied to barrel re-export #3.4. |
| 5 | `src/app/models/estimate.model.ts:1` | `Estimate` (interface) | Functionally dead once `estimate.service.ts` is removed. Tied to #1.2 / #3.3. |
| 6 | `src/app/models/parsed-brief.model.ts:1` | `ParsedBrief` (interface) | Functionally dead once `ai.service.ts` is removed. Tied to #1.1 / #3.5. |
| 7 | `src/app/models/status.model.ts:1` | `Status` (interface) | Functionally dead. Tied to #3.2. |

---

## 5. Cross-reference vs. existing inventory

`TECHNICAL_INVENTORY.md` does **not** exist in this repo — no inventory to
cross-reference. The closest documents are `ARCHITECTURE.md`,
`WORKING_STANDARDS.md`, and `CHANGELOG.md`; none enumerate services
component-by-component.

A few cross-checks worth noting:

- **Services with no consumers** — `ai.service.ts`, `estimate.service.ts`.
  WORKING_STANDARDS.md lists `ai.service.js` only on the backend side; the
  Angular `ai.service.ts` predates the current `brief-parser.service.ts`
  and looks like an unwired remnant. `estimate.service.ts` is not
  mentioned anywhere in WORKING_STANDARDS.md's Angular services list.
- **Routes with no nav path** — none flagged by Knip. The
  `project-detail.routes.ts` keeps `event.component.ts` *off* the router,
  which is the documented intent.
- **Confirmed-dead components** — none previously suspected (no inventory
  to compare).
- **Components thought active but unused** — `currency-display.component.ts`
  (`<app-currency>`). Likely a leftover from an earlier currency-pill
  experiment; the `gbp` pipe is used inline everywhere instead.
- **False positives Knip cannot detect** — `primeicons` (CSS `@import`),
  `event.component.ts` (intentionally retained for git history).

---

## 6. Summary

| Metric | Count |
|--------|-------|
| Total unused files (raw) | 4 |
| Total unused files (after excluding intentionally-retained) | 3 |
| Total unused dependencies (raw) | 4 |
| Total unused dependencies (after excluding false-positive `primeicons`) | 3 |
| Total unused exports | 5 |
| Total unused exported types | 7 |
| Estimated lines of dead code (excluding retained `event.component.ts`) | ~38 LOC of code + ~95 LOC of model/type files (≈ **133 LOC** purgeable) |

### Recommended immediate deletions (high confidence)

- `client-angular/src/app/shared/components/currency-display/currency-display.component.ts` (13 LOC, no consumer, `gbp` pipe used inline everywhere).
- `primeflex` dependency (no source references).
- `IconName` type in `src/app/core/icons.ts` (defined, never referenced).
- Drop `export` keyword from `iconToKebab` (`icons.ts`), `ParsedCategory` (`brief-parser.service.ts`), and `ShellBack` (`shell-context.service.ts`) — they are file-local helpers, not public API.

### Needs investigation (decide with product context)

- `ai.service.ts` + `ParsedBrief` model — confirm the AI brief-parse
  endpoint is fully owned by `brief-parser.service.ts` (server still
  exposes `/ai/parse-brief`?). If yes, delete both.
- `estimate.service.ts` + `Estimate` / `EstimateItem` model — is the
  estimates feature on the roadmap or shelved? Backend may still expose
  `/estimates`; check before pruning.
- `BallsTransaction` model — there is a backend Balls service; is a
  client-side transactions UI planned? If not, delete the model.
- `Status` model — confirm no plan to reintroduce dynamic status lookups
  (current status pill colouring is CSS-only).
- `autoprefixer` + `postcss` dependencies — verify the Angular CLI 17
  build still succeeds with these pruned from the top-level deps
  (they remain transitively via `tailwindcss` / `@angular-devkit`).

### Do NOT touch

- `client-angular/src/app/features/projects/pages/project-detail/tabs/event/event.component.ts` — kept for git-history continuity per comments in `event-drawer.component.ts:42` and `project-detail.routes.ts:17`.
- `primeicons` dependency — used via CSS `@import` at `styles.css:3`; Knip misses CSS imports.

---

## How to re-run

```bash
cd client-angular
npm run audit:dead-code           # human-readable report
npm run audit:dead-code:json      # JSON output for tooling
npx knip --files                  # only unused files
npx knip --exports                # only unused exports
npx knip --dependencies           # only unused deps
```

A machine-readable JSON dump is checked in at
`client-angular/knip-report.json` for the run that produced this audit.

---

## Next step

Purge planning. Once product confirms the **needs-investigation** items
above, a follow-up prompt will delete the confirmed-dead code in a single
pass. This file (`DEAD_CODE_AUDIT.md`) should be regenerated after that
purge to verify the cleanup is complete.
