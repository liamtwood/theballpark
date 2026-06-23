# Shipped — p0035 — `<app-update-me>` banner component + apply to known offenders

**Version:** `[Dev] v1.66r`
**Prompt:** `p0035-update-me-banner-component-prompt.md`

## What changed

### 1. New shared component
- `shared/components/update-me/update-me.component.ts` — standalone, OnPush.
  - Selector `<app-update-me>`. Inputs: `reason` (required), `note?` (optional).
  - Renders ONLY when `environment.production === false` via `*ngIf="!isProduction"`.
    Angular's `fileReplacements` swaps `environment.ts` → `environment.prod.ts`
    (`production: true`) at build time, so it is gated out of prod builds at runtime.
  - Text: `UPDATE ME — adopt <{{ reason }}> when next refactoring this page`,
    optional `(note)` suffix. Lucide `alert-triangle` @ size 14. Non-interactive
    (no click, no dismiss — only refactoring removes it).

### 2. Applied to offenders (5 placements)
| File | reason | note |
|---|---|---|
| settings/organisation | `app-page-header` (top) | — |
| settings/organisation | `app-edit-section` (ORGANISATION DETAILS) | has inline edit pencil |
| settings/organisation | `app-edit-section` (FINANCIAL DEFAULTS) | has inline edit pencil |
| settings/subscription | `app-page-header` (top) | — |
| settings/team | `app-page-header` (top) | — |

Each host added `UpdateMeComponent` to its standalone `imports`.

## Deviations from prompt
- **Profile page skipped** — no Profile component exists in the repo
  (`find -iname "*profile*"` → nothing). The 2 Profile rows in the prompt's
  table were skipped, dropping the expected ~7 placements to **5**. To be
  added when the Profile page is built.
- **Lucide wiring** — the prompt's `LucideAngularModule.pick({ AlertTriangle })`
  returns a `ModuleWithProviders`, which is invalid in a standalone component's
  `imports` (TS-992012). This app uses a global icon registry (`core/icons.ts`,
  which already registers `AlertTriangle`), so the component imports bare
  `LucideAngularModule` like every other component. Icon renders by name.
- **Tokens** — no `--color-warning*` tokens exist. Per the prompt's fallback
  chain: bg `--theme-soft`, border `1px dashed --color-action-text`, icon +
  text `--color-action-text`, code chip bg `--color-action-bg`. Reads as a
  calm parchment strip with a red dashed nag border.

## Verify
- ✓ Component at `shared/components/update-me/`.
- ✓ `npx ng build` (production config) compiles clean.
- ✓ `grep -rn "<app-update-me" client-angular/src/app` → 5 placement hits
  (+2 doc-comment refs inside the component itself).
- ✓ Prod gating: `*ngIf="!isProduction"` with `production: true` in the
  prod env file → banner does not render in production builds.
- Org page shows 3 banners (top + 2 section markers); Subscription + Team 1 each.

## Not done (out of scope, by design)
- Did **not** extract the real `<app-page-header>` / `<app-section-card>` /
  `<app-edit-section>` components — later prompts.
- Did **not** refactor any hand-rolled chrome — marking debt, not paying it.
