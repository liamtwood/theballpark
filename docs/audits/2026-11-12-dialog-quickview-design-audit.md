# Dialog shell + Quick View — design critique

**Date:** 2026-11-12 · **Reviewer:** product-design critique (read-only) · **Branch:** `rebuild/org-slice`
**Scope:** pV2-DIALOG-SHELL-01 (`app-modal` + 13 migrated dialogs, project one-view) and pV2-STORE-QUICKVIEW-02 (Quick View single-view redesign).

## Overall impression

This is a strong, disciplined consolidation: one real `app-modal` shell replaces ~13 hand-rolled headers/footers, the four `fixed inset-0` overlays are gone, and the "separator can't be forgotten" footer-slot design is exactly the right mechanism. The Quick View image-fixed / detail-scroll split is a genuine UX improvement with careful swipe + `inert` a11y plumbing. Two things hold it back from "done": the field-system standardisation didn't reach every surface (a single dialog still runs two field systems), and DESIGN.md — the stated SSOT — is now materially stale against what shipped, so the "one standard" exists in code but not in the doc anyone will read next.

## Consistency

- 🟡 **One dialog runs two field systems.** `custom-line-dialog` Single mode uses `ed-label`/`ed-input` (the new standard) but Grid mode still uses `bp-field-label` + `bp-input-field` (`custom-line-dialog.component.ts:121,130,132,134`). The Quick View footer qty also uses `bp-field-label`/`bp-input-field` (`quick-view-dialog.component.ts:240,242`). The ship report says "`ed-*` everywhere"; it isn't. **Recommendation:** the real gap is that `ed-input` is a 44px pill — it can't sit in a dense grid row or an inline stepper. Add a compact `ed-input--sm` density to the `ed-*` kit and migrate these two call sites, so there's one field family with two densities rather than two families.
- 🟡 **`ed-label` is a different type rank than the documented field label.** `ed-label` is `--text-xs` (10px) / weight 400 (`styles.css:342`), whereas DESIGN.md §5's `.bp-field-label` is 12px / 500. The migration standardised dialogs onto the *smaller, lighter* of the two. It's internally consistent now, but it quietly demoted every dialog field label. **Recommendation:** confirm 10px is intended for form labels (it reads as caption-sized), or bump `ed-label` to 11–12px; either way record the decision in DESIGN.md §5 so the two label ranks don't both stay "live."
- 🟢 **Dismiss-label rule is honoured.** Cancel on editors (confirm, invite, custom-line, edit-details), Close on the Quick View viewer. Good.
- 🟢 **Button semantics are consistent** across migrated dialogs (`bp-btn--primary` / `bp-btn--secondary` / `bp-btn-danger` / `bp-act--green/red`). The rename to solid `--theme-accent` is a pure alias (`styles.css:687-695`), zero visual change — confirmed.

## Visual hierarchy

- 🟡 **Two adjacent secondary buttons do opposite things.** In invite-supplier the footer is Cancel (`bp-btn--secondary`) · Save (`bp-btn--secondary`) · Send (`bp-btn--primary`) (`invite-supplier-dialog.component.ts:105,108,113`). "Save" (persist) is visually identical to "Cancel" (discard) and sits right next to it. Weight no longer encodes intent. **Recommendation:** make Save the primary and Send a distinct treatment, or merge to a single primary with a separate "Save without sending" text action — don't style persist and discard identically side by side.
- 🟡 **Quick View detail column is capped to the image height (~360px floor), not the viewport.** `sideMaxH = max(imgColH, 360)` (`quick-view-dialog.component.ts:499-502`); the inline `max-height.px` overrides the stylesheet's far more generous `max-height: 66vh` (`:314`), making that rule dead. Because the hero image is capped at 280px (`:338`), `imgColH` lands near the 360 floor almost always — so a rich item (description + variants + volume + services + boxed attribute cards + disclaimer) scrolls inside ~360px while the dialog has plenty of unused vertical room. This is the exact cramp the prompt flagged, and it's real. **Recommendation:** cap to `max(imgColH, 66vh)` (or clamp to e.g. 72vh) so the detail column uses the available height and only the short-image case tracks the image.
- 🟢 **Divider-only grouping reads well.** name → description → price → `hr` → variants → `hr` → volume → `hr` → services, each labelled section with an icon+label (`bp-qv-spec__label`), works — the hairlines carry the grouping the old boxes used to. Keeping the attribute cards boxed while unboxing volume/services is a slight mixed metaphor but defensible (cards are repeating records, the others are single facts).
- 🟢 **Pinned footer Add** is the right call — qty + "Add to ballpark · £…" stays visible while detail scrolls.

## Usability / interaction

- 🟢 **Close/escape/backdrop** are centralised in `app-modal` and all route to `(close)` via `onVisible` (`modal.component.ts:92-94`). Clean.
- 🟡 **`closeOnEscape` is hardcoded true in the shell** (`modal.component.ts:35`), not an input, while `closable`/`dismissable` are configurable. Confirm leans on this (ESC = Cancel), but a dialog that genuinely must not be ESC-dismissable (e.g. mid-save) can't opt out. **Recommendation:** expose `closeOnEscape` as an input defaulting true.
- 🟢 **Hero prev/next arrows** are real `<button>`s with `aria-label` and wrap correctly (`:132-137,480-483`); thumbnail strip stays. Good.
- 🟢 **Two-page swipe intact** with axis-lock, velocity-flick commit, rubber-band, and `prefers-reduced-motion` honoured (`:283,547-558`). Solid.
- 🟢 **Empty-footer edge.** The shell always renders the footer template + its bordered/padded bar (`modal.component.ts:52-59`, `styles.css:1820`); every current consumer has footer buttons so it's inert today, but a future footer-less dialog would show a stray separator. Worth a `@if` guard on the slot eventually.

## Accessibility

- 🟡 **`bp-btn--secondary` boundary fails non-text contrast.** The white secondary button is delimited only by `--color-border-hairline` = `rgba(15,23,42,0.10)` (`styles.css:664`), well under the 3:1 WCAG non-text-contrast bar against a white dialog body. Cancel/Close/Edit are hard to perceive as controls until hover. **Recommendation:** darken the secondary border to `--color-border-medium` (0.18) or add a subtle fill; text contrast is fine, it's the affordance that's weak.
- 🟡 **Confirm icon is always danger-red, even for non-danger confirms.** `.bp-modal__icon` is hardcoded `--color-danger-soft`/`--color-danger` (`styles.css:1855-1856`), but the confirm supports `danger === false` → a `bp-btn--primary` button (`confirm-dialog.component.ts:35`). A non-destructive confirm then shows a red icon above a neutral-primary button — mixed signal. **Recommendation:** tint the icon circle by danger (red vs accent/info), or drop it for the non-danger path.
- 🟢 **Quick View pane a11y is good** — `role="tablist"`/`tab`/`tabpanel`, roving `tabindex`, arrow-key nav, and both `aria-hidden` + `inert` on the offscreen pane (`:81-101,119-122,206-209`).
- 🟢 **Semantics are buttons, not divs**, throughout; nav arrows and steppers are labelled.
- 🟢 **Focus** is handled by PrimeNG's dialog trap/restore; no `static:true` ViewChild traps (all `viewChild()` signals, default static:false).

## Design-system integrity

- 🔴 **DESIGN.md is materially stale against what shipped** — and it's the stated SSOT. §8 still documents `.bp-btn-grad` as a gradient fill with "gradient reserved" guidance (the gradient was flattened to solid `--theme-accent` and `bp-btn--primary` is now the name); §6 still lists `app-modal` as a v1 "p-dialog wrapper with parchment header" while a real v2 shell now exists; §5's field-label row (`bp-field-label`) is contradicted by the `ed-*` standard the dialogs actually use. Both ship reports acknowledge the reconcile is owed. **Recommendation:** do the DESIGN.md pass now, not "later" — the next person building a dialog will read §8/§6 and build the wrong thing. Document `app-modal` (API + slots), the `ed-*` field kit as the dialog standard, and the flattened button rule.
- 🟡 **`app-modal` has no `icon` input** (prompt-flagged). Any dialog wanting a header icon must abandon the `title`/`subtitle` API and re-implement both in the `[modalHeader]` slot (as confirm does, `confirm-dialog.component.ts:21-28`). That re-hand-rolls the exact title treatment the shell exists to own. **Recommendation:** add an optional `icon` (+ icon tone) input to the common-case header so the escape hatch isn't needed for the most common reason to reach for it.
- 🟢 **No raw hex / raw Tailwind colour utilities** in the reviewed components (the build would fail anyway). Palette-bound utilities (`bg-fill`, `bg-text`, `text-surface`) used correctly in custom-line.
- 🟢 **`bp-btn--primary` === `bp-btn-grad`** confirmed at the rule level (`styles.css:687-695`) — the rename carries no visual regression.
- 🟢 **Inline `style` use is token-backed** (`style="background: var(--theme-soft)"` etc. in invite-supplier). Not strictly a §13-sanctioned exception (those are dynamic preview values + 0.5px borders) — prefer `bg-*` utilities where they exist — but it's tokens, not raw colour, so low-stakes.

## What works well

- The footer-slot design that makes the hairline separator structural and un-forgettable — the single best decision in the shell.
- Deleting the four `fixed inset-0` overlays and the Quick View L1/L2 picker + all its dead machinery; real surface-area reduction, not just a reskin.
- Quick View interaction plumbing: swipe axis-lock, velocity commit, `inert` panes, reduced-motion, ResizeObserver auto-height — careful, idiomatic Angular 21 (signals, `viewChild()`, OnPush).
- The one-view project pass: state *reveals* surfaces (`@if (g.summaryCode)`, `@if (g.hasAgreed)`) instead of branching the layout — the right structural instinct.
- The `NG8011` named-slot gotcha (one projected node per `@if`) is documented inline where the next dev will hit it.

## Priority recommendations

1. **Reconcile DESIGN.md now** (🔴): document `app-modal`, make the `ed-*` kit the written field standard, and fix §8's flattened-button + §6's app-modal entries. The SSOT currently describes a design that no longer ships.
2. **Fix the Quick View detail-column cap** (🟡): change `sideMaxH` to `max(imgColH, ~66–72vh)` so rich items don't scroll inside ~360px while the dialog has room; the dead `66vh` stylesheet rule shows the generous cap was once intended.
3. **Give the `ed-*` kit a compact density and finish the migration** (🟡): add `ed-input--sm`, convert `custom-line` Grid + Quick View qty off `bp-input-field`/`bp-field-label` so the "one field system" claim is actually true.
4. **Resolve the invite-supplier footer hierarchy** (🟡): Save and Cancel must not be identical secondary buttons sitting side by side doing opposite things.
5. **Two small a11y fixes** (🟡): darken `bp-btn--secondary`'s border to meet 3:1 non-text contrast, and tint the confirm icon by danger so a non-danger confirm isn't fronted by a red icon.
