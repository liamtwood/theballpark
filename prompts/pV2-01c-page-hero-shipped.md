# Shipped — pV2-01c — Page Hero (`<app-page-hero>`)

**Version:** v2.02a (chip `[Dev v2] v2.02a`)
**Shipped:** see commit log
**Prompt:** `pV2-01c-page-hero-prompt.md`

## What changed (all in `client-v2/`)
- **NEW** `shell/page-hero/page-hero.component.ts` — `<app-page-hero>`: the standard hero band for every v2 feature page. Inputs per spec (`back` / `title` required / `subtitle` / `align` / `accent`), right-side `<ng-content select="[hero-actions]">` slot. **Host IS the band** per the pV2-01a standard — `host:` binds `bp-page-hero` + `--align-center` / `--accent-none` variant classes; no inner `<header>` wrapper.
- **CHANGED** `pages/hello` — first child is now the hero (title/subtitle from `auth.user()` via **`@let`**); body keeps the API dot + Aura button in the new global `.bp-page-body`. The pV2-01b in-body avatar+h1 intro is replaced by the hero (identity now lives in the band).
- **NEW** `pages/style/hero/hero-demo.component.ts` + route `/style/hero` — dev style sandbox: 4 stacked variants (title-only · +subtitle · +back+actions-slot · center/no-accent), the start of the v2 playground.
- `app.config.ts` — `ChevronLeft` added to the Lucide pick.
- `styles.css` — global `.bp-page-body` (32px padding).
- Env chips → `v2.02a` (dev/staging/prod).

## Deviations (flagged, not silent)
- **`--color-text` → `--theme-text`** — the spec's title CSS referenced `var(--color-text)`, which doesn't exist in v2's token set; criterion 11 requires existing tokens only, so the title uses `--theme-text` (same role).
- **Variant selectors as `:host(.bp-page-hero--…)`** — the spec's flat `.bp-page-hero--accent-none { }` in component styles can't match the host under emulated encapsulation; `:host(.variant)` is the working form. The class names on the host are exactly as the naming table locks them, so external styling/QC is unaffected.

## Responsive breakpoint
Kept the spec's **600px**: below it, padding compresses to `20px 16px 16px`, the title drops 28→22px, and the grid re-areas to `"back actions" / "text text"` (back link moves to the top row, text full-width below). Verified at 390px.

## Visual tweaks
- Demo-page heroes get `rounded-xl + overflow-hidden` host classes so the stacked variants read as cards in the sandbox (the band is square-edged in real page use).
- Variant 3 demos the actions slot with a small `p-button`.

## Verify — 14/14
1. ✓ Hero on hello with title "Hello, Sarah Mitchell" + subtitle "Creative Agency Ltd · agency_admin" from `AuthService.user()`.
2. ✓ Hero below the shell header, above `.bp-page-body` (geometry-verified).
3. ✓ Theme wash by default (the `--theme-soft` pink→green gradient).
4. ✓ `accent="none"` → transparent band (variant 4: `rgba(0,0,0,0)`).
5. ✓ `align="center"` centres text (computed `text-align: center`); left is default.
6. ✓ Back chevron + label renders; click navigated `/style/hero` → `/` via routerLink.
7. ✓ `[hero-actions]` slot projects arbitrary content (p-button in variant 3).
8. ✓ `/style/hero` shows the 4 variants.
9. ✓ <600px: padding 20/16/16, title 22px, back moves to top row (verified at 390px).
10. ✓ Zero `*ngIf` / `*ngFor` / NgModules / `any`.
11. ✓ CSS tokens only — zero raw hex in the hero component.
12. ✓ `ng build` + `ng lint` clean.
13. ✓ Old `client-angular/` on 4200 unchanged (`[Dev] v1.70a`).
14. ✓ Footer chip reads `[Dev v2] v2.02a`.

angular-developer skill invoked pre-build — `@let` (stable since v18.1/19, fine on 21) + attribute-select content projection confirmed.

pV2-01c flipped to `Done` in `prompts/backlog.md`. The page hero is now the standard for every future v2 page.
