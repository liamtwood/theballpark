# pV2-RAINBOW-01 — Restyle "Go with this Ballpark" (kill the gradient)

**Type:** client-v2 UI · tiny styling fix
**Owner:** CC implements + commits. Chat authored this. Tracker: the logged
**BE** "Restyle Go with this Ballpark — remove the rainbow gradient". Target
**v0.1.2**.

## What
The **"Go with this Ballpark"** primary button (in the project cart footer —
`client-v2/src/app/pages/projects/project-estimate.component.ts`) uses a
rainbow/gradient fill. Replace it with the **standard primary button** styling
(tokens only — no hex, no raw Tailwind colours, no gradient).

Liam: "GET RID OF THE RAINBOW forever." So:
- Fix this button to the standard primary style.
- **Check for a shared gradient class/token** driving the rainbow (e.g. a
  `.bp-*gradient*` class or a gradient CSS var). If one exists and is used
  elsewhere, note every consumer in the ship report — Liam may want a wider
  sweep (a follow-up), but this prompt is scoped to **this button** unless the
  class is used only here (then remove it).

## Acceptance
- [ ] "Go with this Ballpark" renders as the standard primary button (no
      gradient), still full-width in the cart footer, same click behaviour.
- [ ] No raw hex / Tailwind colour utilities introduced; tokens only.
- [ ] Ship report lists any shared gradient class + its other consumers (for a
      possible app-wide sweep).
- [ ] Builds clean; chip bumped.

## Concerns not in spec
Standard section — flag the gradient's blast radius (is it this button only, or
a shared treatment used across the app?).
