# pV2-RAINBOW-01 — Kill the gradient on "Go with this Ballpark"

**Shipped:** 2026-09-17, chip `Dev v2.480`
**Owner:** CC. Chat authored the spec. Target v0.1.2.
**Commit:** (see git — v2.480)

## What landed
- The **"Go with this Ballpark"** button (project cart footer,
  `project-estimate.component.ts`) switched from `.bp-btn-grad` (the vivid
  `--bp-gradient` rainbow) to **`.bp-btn-accent`** — the solid dark-pink
  `--theme-accent` primary. That class's own comment already names it "The
  project-cart 'Go to Ballpark' CTA", so this is the intended standard, matches
  Liam's earlier "use the new dark pink", and is tokens-only (no hex, no raw
  Tailwind, no gradient). Full-width (`flex-1`) and click behaviour unchanged.

## Files touched
| File | Notes |
|---|---|
| client-v2/src/app/pages/projects/project-estimate.component.ts | `bp-btn-grad` → `bp-btn-accent` on the cart-footer CTA (1 line) |
| client-v2/src/environments/environment.ts | chip → v2.480 |

## Acceptance
- [x] Button renders as the standard solid primary (dark pink, no gradient),
      still full-width in the cart footer, same click (`goToFinal`).
- [x] Tokens only — no hex / raw Tailwind colours introduced.
- [x] Builds clean; chip bumped.
- [~] Liam QCs the visual on localhost.

## Concerns not in spec
### `.bp-btn-grad` blast radius (the shared gradient class)
**Where:** `client-v2/src/styles.css` defines `.bp-btn-grad` (the `--bp-gradient`
CTA); after this change it is still consumed by **19 component files** —
sow-document, quote-document, supplier-detail, profile-team-section, supplier-card,
customize-dialog, quick-view-dialog, add-to-project-dialog, coachmarks-settings,
early-access, line-editor, estimate-preview-rail, options-picker, custom-line-dialog,
confirm-dialog, item-edit-actions, message-suppliers-dialog, image-picker,
dialogs-demo (style demo).
**What:** This prompt was scoped to the one cart button. If "GET RID OF THE
RAINBOW forever" means app-wide, those 19 consumers (Save changes, Create,
dialog confirm CTAs, etc.) still use the gradient.
**Suggested fix:** A follow-up sweep — either repoint the primary CTAs to
`.bp-btn-accent` case by case, or redefine `.bp-btn-grad` itself to the solid
accent (one-line, changes all 19 at once, keeps the class name). Liam's call —
deferred, needs the design decision on whether the gradient survives anywhere
(e.g. landing/hero) or dies everywhere.
**Severity:** LOW (cosmetic; no functional impact).

## QC notes
Tested on localhost as part of the v0.1.2 bundle — QC pass (Liam, 2026-09-17).

## Chat audit
(chat)
