# pV2-01d — Visual tweaks: transparent hero + borderless header

## Read first

1. `WORKING_STANDARDS.md`
2. `prompts/cc-onboarding.md`
3. `prompts/pV2-01b-shell-chrome-shipped.md`
4. `prompts/pV2-01c-page-hero-shipped.md`
5. This prompt

## Background — what was found in QC

Liam walked through the shell chrome (pV2-01b) + page hero (pV2-01c) and
confirmed:

- ✓ Avatar circle uses `--bp-gradient` (master color)
- ✓ Font color uses `--bp-text-color` (master color)
- ✓ Ballpark wordmark uses `--bp-font` (matches the future Font Pair DB value)
- ✓ Ballpark wordmark font size = avatar initials font size (visually unified)
- ✓ Dropdown opens, dev user picker works, switching updates name + role + title + subtitle live
- ✓ Hero title + subtitle reflect the active user

Two visual issues to fix in this commit:

1. Hero band has a theme-soft wash by default — should be transparent
2. Shell header has a bottom hairline — should be flush / borderless

## Changes

### 1. `<app-page-hero>` default accent → transparent

In `client-v2/src/app/shell/page-hero/page-hero.component.ts`, flip the default
of the `accent` input:

```typescript
// Before
readonly accent = input<'theme' | 'none'>('theme');

// After
readonly accent = input<'theme' | 'none'>('none');
```

The hero band renders transparent by default. Routes that explicitly want the
theme wash can opt in with `<app-page-hero accent="theme" ...>`.

### 2. Update `/style/hero` demo

The four-variant demo at `/style/hero` was set up to showcase the variants.
With the default flipped, swap the showcase so users see both states clearly:

| Example | Spec was | Spec is now |
|---|---|---|
| 1. Title only | left, theme wash | left, transparent (default) |
| 2. Title + subtitle | left, theme wash | left, transparent (default) |
| 3. Title + subtitle + back | left, theme wash | left, transparent (default) |
| 4. Centered, no accent | center, none | center, theme wash — to demonstrate the OPT-IN variant |

(Or rearrange however reads cleanest — the goal is one example showing the
theme variant remains visible for QC purposes.)

### 3. `<app-shell>` header → borderless

In `client-v2/src/app/shell/app-shell.component.ts`, remove the bottom hairline
from the header styling:

```css
/* Before */
.bp-shell__header {
  border-bottom: var(--border-hairline);
  /* ... */
}

/* After */
.bp-shell__header {
  /* no border-bottom */
  /* ... */
}
```

The transparent header + transparent hero now flow together with no rule
between them. Page content below the hero still has its own separation via
the hero's own padding + the page body's wrapper.

## Hello page sanity check

The hello page should still read cleanly:

- Header: transparent, no rule
- Hero: transparent, "Hello, Sarah Mitchell · Creative Agency Ltd · agency_admin"
- Page body: padded API connection chip + themed PrimeNG button
- Footer chip: `[Dev v2] v2.02b`

## Acceptance criteria

1. `/` — header is transparent and has no bottom border
2. `/` — hero band is transparent (no soft wash background) by default
3. `/style/hero` — three default examples render transparent; one example with `accent="theme"` clearly shows the wash variant for visual comparison
4. Switching user via avatar dropdown still works; title + subtitle update live
5. No regressions in pV2-01b or pV2-01c acceptance
6. Footer chip bumps to `[Dev v2] v2.02b`
7. Old `client-angular/` on 4200 unchanged

## Out of scope

- Page-settings drawer (still deferred)
- Touching avatar / wordmark / font tokens (those passed QC)
- Any restructure of the host:-binding pattern (passed audit)

## Bump + ship

1. Version chip → `[Dev v2] v2.02b`
2. Commit message: `feat(v2.02b): transparent hero default + borderless header`
3. Ship report `prompts/pV2-01d-visual-tweaks-shipped.md` — include a brief
   note quoting what Liam tested and confirmed working in QC (the bullets at
   the top of this prompt) so the report doubles as a record of the QC pass
4. Flip backlog row to Done

## Reply with

- Commit SHA
- 7/7 acceptance criteria ticked
- Confirmation old app still works
- Anything else noticed in the visual pass
