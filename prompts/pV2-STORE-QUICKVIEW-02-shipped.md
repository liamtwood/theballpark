# pV2-STORE-QUICKVIEW-02 — Quick View: single view, image-fixed layout

**Date:** 2026-11-12 · **Branch:** `rebuild/org-slice` · Interactive design pass with Liam.

## Problem

Quick View carried two demo layouts (1 = single column, 2 = two column) behind a live
1|2 picker, persisted per-browser. Liam confirmed **Layout 2 is the only view**, and the
two-column layout needed rework: the detail was split across both columns, the image
shared space with specs, and there was no image navigation.

## What shipped

- **Single view** — Layout 1 and the 1|2 picker removed, plus all their machinery
  (`QV_LAYOUT_KEY`/`readStoredLayout`, `layout`/`setLayout`, `dialogStyle`,
  `descOpen`/`descLong` show-more clamp, the `app-image-carousel` import, the L1-only CSS).
  Dialog is a fixed 1040px / 96vw.
- **Two equal columns** (`1fr / 1fr`). **LEFT = the image, held fixed; RIGHT = all the
  detail, scrolls on its own.** The right column caps its `max-height` to the image
  column's measured height (ResizeObserver on `#imgCol` → `imgColH`, 360px floor) so the
  full image shows and the detail scrolls beside it — no dead space.
- **Right column order:** name → description → price → **divider** → options (variant
  picker) → **divider** → Volume pricing → **divider** → Included services → Show-more
  details → disclaimer. Volume pricing + Included services were **unboxed** (dropped the
  `.bp-qv-spec` box for a hairline `.bp-qv2__rule` divider, per Liam); the Show-more
  attribute cards keep their boxes (Liam: fine).
- **Hero image nav** — circular prev/next chevrons overlaid on the main image
  (`heroStep(±1)`, wraps); thumbnail strip stays below.
- **Add + Qty pinned to the footer** — the primary action (Qty stepper + "Add to
  ballpark · £…") moved out of the scrollable column into the footer bar (Close + Add on
  the right, Qty on the left) so it stays visible while the detail scrolls.
- **Markdown** — Included services now renders `md` (`bp-md`) like the description.
  Variant-option descriptions already render markdown (item-variant-picker); spec-group
  values stay plain (Liam: short key:value facts, markdown risks mis-render).
- Semantic buttons (`bp-btn--primary`/`--secondary`) + supplier pane `[wide]="true"`.

## Files touched

`client-v2/src/app/pages/marketplace/quick-view-dialog.component.ts` (template, styles,
class); `client-v2/src/app/shared/catalogue/item-attribute-cards.component.ts` untouched.

## Acceptance

Compiles clean on dev2 (:4202) throughout. Liam QC'd: single view, image fixed + detail
scrolls, hero arrows, footer Add, dividers, markdown. "Looks great."

## Concerns not in spec

- **Still on `p-dialog`, not `app-modal`** — quick-view has a custom header (supplier +
  page switcher) and footer, plus the swipe/ResizeObserver track. Migrating its shell onto
  `app-modal` (via `[modalHeader]`/`[modalFooter]` slots) is a deferred follow-up so the
  dialog-standardisation set is complete.
- The right-column scroll cap is the image height (360px floor). On a very short/wide image
  the detail scroll area is small; the floor keeps it usable. Tunable if needed.

## QC notes
(Liam)

## Chat audit
(chat)
