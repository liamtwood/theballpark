# Shipped — p0038A — Backup + Angular v17 → v18 upgrade (PrimeNG held at v17)

**Version:** v1.70a
**Shipped:** branch `upgrade/angular-v20` (NOT merged to dev — awaiting Liam's local QC)
**Prompt:** `p0038A-angular-upgrade-prompt.md`

## Backup
- Tag `pre-angular-upgrade-v1.69f` created + pushed (named to real HEAD — p0038 shipped after the prompt was written, so HEAD was v1.69f, not the prompt's `v1.69e`).
- Branch `upgrade/angular-v20` checked out from `12cabd9` (doc-prep commit on dev).
- Doc-prep commit `12cabd9` pushed to dev first (inbox-v2 plan + p0038A prompt + backlog rows + re-scoped p0038 — uncommitted docs from Liam).
- Supabase snapshot skipped (frontend-only upgrade, no schema changes).

## Audit outcome (the decision)
- **Target: Angular 18, PrimeNG stays 17.** The pivotal fact: `primeng@17` peers `@angular/core ^17 || ^18`, so Angular bumps to 18 while PrimeNG (and the classic `primeng/resources/themes/*.css` we import) stays put → **zero styling blast radius.**
- **Why not 19/20/22:** PrimeNG 18+ dropped the classic CSS theming for the new styled-mode/design-token system (`@primeuix/styled` + `@primeng/themes`). Angular 19+ forces PrimeNG 19+ → a full theming migration across our `styles.css` override layer. That's a separate, dedicated prompt — out of scope here. Angular 18 is the clean ceiling.

## What changed
- `client-angular/package.json` — `@angular/*` 17.3 → 18.2.14, `@angular/cli` + `@angular-devkit/build-angular` 17.3 → 18.2.21, `@angular/compiler-cli` → 18.2.14.
- `client-angular/package-lock.json` — regenerated (clean install via ng update).
- `client-angular/src/environments/environment.ts` — version chip → `[Dev] v1.70a`.
- **No source files changed** — all `ng update` migration schematics reported "No changes made":
  - Two-way binding longform · HTTP module → provider fns · afterRender phase API · BootstrapContext for SSR → all no-ops.
- **Unchanged deps:** `primeng` 17.18.15, `lucide-angular` 0.577 (peers Angular 13–21), `rxjs` 7.8, `zone.js` 0.14.3, `typescript` 5.4.2 (v18 wants ≥5.4 <5.6).

## Why it was clean (audit confirmed)
Fully standalone (0 `@NgModule`), `bootstrapApplication`, modern `@angular-devkit/build-angular:application` (esbuild) builder, no custom webpack; 0 `ViewChild static:true`, 0 `entryComponents`, 0 legacy `ModuleWithProviders`, 0 old `Renderer`.

## Build + smoke test
`ng build` clean (only pre-existing NG8107 optional-chain lint warnings — present before the upgrade). Dev server compiled on Angular 18 in ~8s.

| Route | Result |
|---|---|
| `/home` | ✓ "Welcome back, Woodland Agency" |
| `/projects` | ✓ "Events" landing |
| `/projects/:id` | ✓ detail (tab band + `app-edit-section`) |
| `/inbox` (v1) | ✓ |
| `/inbox-v2` (p0038 stub) | ✓ hero renders |
| `/shop` (**marketplace, high-risk**) | ✓ catalogue-grid + search row + sidebar + item cards |
| project marketplace + **cart drawer** | ✓ `app-cart-drawer` opens, `bp-drawer` chrome applied, header "Your selections", body renders, `position:fixed` — PrimeNG sidebar works |
| `/settings` | ✓ "Profile" |

No upgrade-introduced console errors on any route.

## ⚠️ Pre-existing latent bug found (NOT an upgrade regression — flagged, not fixed)
`/shop` + project-marketplace log `NG02100: InvalidPipeArgument: Unable to convert "May Half Term — 25–30 May 2025 (...)" into a date` from `DatePipe` in `CatalogueGridComponent` ([catalogue-grid.component.ts:1003](client-angular/src/app/shared/components/catalogue-grid/catalogue-grid.component.ts#L1003)):
`{{ proj.event_date ? (proj.event_date | date:'d MMM y') : '—' }}`.
- One project's `event_date` holds **free text** ("May Half Term — …"), not an ISO date. `DatePipe` throws on unparseable strings — **identical behavior in Angular 17 and 18** (DatePipe parsing unchanged). It threw on v17 too; just hadn't been hit in prior smoke tests.
- Page still renders (per-row pipe failure, recovered). **Not folded into the upgrade commit** (p0038A out-of-scope = no v1 fixes beyond migration; keeps the upgrade atomic for QC). Recommended separate fix: guard the pipe with a parseable-date check (or coerce/normalise the `event_date` data).

## Diff
Net: **+3113 / −1988** — dominated by `package-lock.json` regeneration; 12 real lines in `package.json` + 1 in `environment.ts`.

## Status
- Branch `upgrade/angular-v20` pushed; **not merged to dev**.
- Backlog `p0038A` left as-is — flips to **Done on merge** (per instruction "flip backlog row to Done after merge").

Pull `upgrade/angular-v20`, run locally, QC. Merge to dev when satisfied. Chip reads `[Dev] v1.70a`.
