# 2026-11-12 — Dialog shell + Quick View architecture audit

Scope: `pV2-DIALOG-SHELL-01` (app-modal + 13 dialog migrations + project one-view) and
`pV2-STORE-QUICKVIEW-02` (Quick View single-view redesign). Read-only architecture pass
against v2 component standards (`docs/CLAUDE.md` §"v2 component standards" — `docs/ENGINEERING.md`
does not exist in this tree) and framework idioms.

## Overall

Solid, standards-clean work: every touched file is standalone + OnPush + signals + `@if`/`@for`,
`input()`/`output()`/`model()`, `inject()`, no raw colors, no TS `any`, no `static:true`. The
`app-modal` shell is a genuine single-point-of-control win and the Quick View refactor correctly
uses `viewChild` + `effect` for its ResizeObserver (no static-query lifecycle trap). The real
debt is in two places the standardisation left behind: the headline Quick View "image fixed /
detail scrolls" cap is defeated on mobile, and the project detail form now exists twice (hidden
Details tab + the new dialog) — the exact extract-before-duplicate case. Both large components
(item-edit 1166, project-detail 1028) are well over the 400-line alarm and now carry dead-ish
surfaces.

## Findings

### 🟡 Quick View inline `max-height` defeats the mobile single-column media query
`quick-view-dialog.component.ts:159` binds `[style.max-height.px]="sideMaxH()"` on `.bp-qv2__side`.
The `@media (max-width: 720px)` rule (lines 386–389) sets `.bp-qv2__side { max-height: none; overflow: visible }`
to let the detail flow below the image on narrow screens. An inline style always beats a stylesheet
rule, so once `imgColH` is measured (> 0) the `max-height` cap persists on mobile; only `overflow`
flips to visible, leaving a short, meaningless box with content spilling. The responsive path the
refactor documents does not actually take effect.
**Fix:** make `sideMaxH()` viewport-aware (return `null` below 720px via a resize signal), or move
the cap into a CSS custom property the media query can override (`--qv-side-cap`), or gate the
binding with a `capSide()` computed that is false on narrow.

### 🟡 Project detail form is now duplicated (extract-before-duplicate)
The new edit path uses `project-details-fields.component.ts` (name/client/event-type/date/location/
guests/budget + financials) with its own NATO-date normalisation (`onEventDateBlur`/`onEventDatePicked`,
lines 126–135) and budget thousands-grouping (`budgetDisplay`/`onBudgetInput`, lines 118–124). The
**same** fields and the **same** two helpers are reimplemented in `project-detail.component.ts` for the
hidden Details tab: NATO date at `798–811`, budget grouping at `onBudgetBlur` 899–903 + `toForm` 1020.
Two sources of truth for identical logic — precisely the case the hygiene rule names.
**Fix:** now that `app-project-details-fields` is the canonical form, delete the hidden Details-tab
field block and route completeness deep-links at the edit dialog, or have the Details tab mount
`app-project-details-fields` too. Don't keep both.

### 🟡 `modalFooter` NG8011 footgun is undocumented in the shell's own API
`modal.component.ts:52–58` projects the footer via `<ng-content select="[modalFooter]" />`. Named-slot
projection drops nodes nested inside a multi-root `@if`, so every consumer must give each footer button
its own single-root `@if` (worked around in `invite-supplier-dialog.component.ts:97` and `custom-line-dialog.ts`).
This sharp edge is only captured in a consumer comment + the ship report — the shell's JSDoc (lines 9–18)
describes the `[modalFooter]` slot without warning about it. The next dialog author will wrap two buttons
in one `@if` and silently lose them.
**Fix:** add the constraint to the `[modalFooter]` JSDoc on the shell ("one projected node per `@if`
branch — a multi-root `@if` mis-slots, NG8011"), and ideally wrap the body/footer slots so a single
`@if` with multiple buttons still projects.

### 🟡 Component bloat — both large components over the 400 alarm, carrying dead-ish surfaces
`item-edit.component.ts` = 1166 lines, `project-detail.component.ts` = 1028 (guidance: 250 warn / 400
alarm). project-detail is the worse offender post-pass: the Details tab is hidden from `projNav`
(`project-detail.component.ts:514–519`) yet its full ~140-line template `@case ('details')` (165–303)
plus `saveSection`/`buildPatch`/`snapshot`/`restore`/`editingFlags`/`DetailForm` all remain, reachable
only via completeness deep-links into a tab users can't navigate to.
**Fix:** extract the Details-tab editor into its own component (or remove it in favour of the dialog,
see the duplication finding) and split item-edit's volume/variants dialog bodies into child components.

### 🟢 Silent empty catch in `completeWelcome`
`project-detail.component.ts:773` ends the post-confirm `router.navigate(...).catch(() => {})` with no
comment (rule: catch blocks justify their silence). Other catches in the pass are compliant
(`quick-view-dialog.ts:441`, `custom-line-dialog.ts:254` both commented).
**Fix:** add a one-line reason or `console.warn` as the sibling `setTab`/`goToTab` navs already do.

### 🟢 `confirm-dialog` comment claims ESC = Cancel, but `closable=false` may disable it
`confirm-dialog.component.ts:8,19` sets `[closable]="false"` and comments "ESC/backdrop = Cancel". In
the shell `closeOnEscape` is hard-wired `true` (`modal.component.ts:33`), but PrimeNG gates Escape on
`closable` in several versions, so Escape may be a no-op here; backdrop cancel still works via
`dismissableMask`. Either the comment or the behaviour is wrong.
**Fix:** verify Escape actually cancels in this PrimeNG version; if not, drop the claim or expose/force
`closeOnEscape` independently of `closable`.

### 🟢 Quick View: stale/inverted comments + leftover layout-picker scaffolding
After Layout-1 removal, `quick-view-dialog.component.ts:298` still reads "The configurator column stays
in view while the left column scrolls" — inverted (the image/left is fixed, the right/detail scrolls).
The header grid keeps a "layout picker right" comment (318) and an empty `<div></div>` right spacer (104)
from the removed 1|2 picker.
**Fix:** correct the comment; keep or label the spacer (it does centre the switcher in the `1fr auto 1fr`
grid, so note that rather than leave it looking orphaned).

### 🟢 Quick View uses `effect()` to reset state on item change
`quick-view-dialog.component.ts:578–583` resets `pane`/`heroIdx`/`qty` in an `effect` keyed on `item()`.
It reads none of the signals it writes, so there's no same-effect read/write hazard — but Angular guidance
discourages effects whose job is to set signals; a `linkedSignal` keyed on the item identity is the
idiomatic reset.
**Fix:** optional — model the per-item reset as `linkedSignal(() => this.item(), ...)` or a computed
source; low priority.

## What's solid

- **Standards compliance across every touched file**: standalone, OnPush, signals, `@if`/`@for`,
  `input`/`output`/`model`, `inject`, `host:` root class on the dialogs (`contents`/`block`), no raw
  hex or raw Tailwind color utilities, no TS `any` (only the sanctioned `$any($event.target)` template
  idiom), no `ViewChild static:true`.
- **`app-modal` visibility contract is sound**: one-way `[visible]="open()"` + `(visibleChange)` → `close`
  only on `false`, host owns `open`. No flash/desync; `shown`/`onShow` forwarding is a plain emit. Confirm
  correctly drives it from a service signal.
- **Quick View ResizeObserver is correctly built**: `viewChild` + `effect` with `onCleanup` disconnect,
  re-runs as panes mount/unmount; `align-items: start` keeps `imgCol.offsetHeight` equal to content (no
  stretch), and `sideMaxH` returns `null` before measurement so the CSS `66vh`/floor is a safe default.
  No real feedback loop on desktop — the capped right column never drives the left column's height.
- **Swipe + vertical scroll coexistence**: axis-lock on gesture start + `touch-action: pan-y` cleanly
  separates horizontal pane-swipe from the detail column's vertical scroll.
- **Genuine de-duplication already done**: image carousel chrome extracted to `app-image-carousel`,
  the project form extracted to `app-project-details-fields` (shared by add-project + welcome + edit),
  the edit-link logic shared via `itemEditLink`.

## Top fixes

1. Make the Quick View right-column cap viewport-aware so the mobile single-column media query wins
   (the headline "image fixed / detail scrolls" refactor is currently broken < 720px).
2. Collapse the duplicated project detail form — delete the hidden Details-tab field block (and its
   NATO-date + budget-grouping copies) or mount `app-project-details-fields` there.
3. Document the `modalFooter` "one node per `@if`" constraint on the shell's own JSDoc (and ideally
   make multi-root projection safe) before the next consumer hits NG8011.
4. Split the two 1000+-line components — extract the (now hidden) Details-tab editor and item-edit's
   volume/variants dialog bodies.
5. Comment or log the silent `router.navigate().catch(() => {})` in `completeWelcome`; verify the
   confirm-dialog ESC-cancel claim against this PrimeNG version.
