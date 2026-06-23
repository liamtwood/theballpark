# CC Prompt — p0025 — Welcome slide reveal: event-driven → scroll-position-driven

The Welcome page's slide reveal logic is currently event-driven: when the user begins to leave a slide, an `exitingFromSlide` state flips and `*ngIf` conditions throughout the template hide that slide's SVG / grain / content. Works going forward, breaks going backward — the "leaving" event doesn't fire when you scroll up into a previously-exited slide, so its SVG stays unmounted (or remounts asymmetrically) and the orbs / text don't return at the right time.

Fix: replace event-driven state with scroll-position-derived functions. Same scroll position always produces the same visuals regardless of direction. Reverse direction works for free because the logic is symmetric by construction.

The uploaded `paralaxblurandnoise.html` demo is the **reference implementation of the principle** (everything is `f(scrollPercent)`), not the target codebase. Keep all of welcome's existing content, layouts, fonts, scroll-snap, iOS Safari hardening — just change *how* the reveal logic decides what to render.

## What changes

### 1. Derive a clean `scrollProgress` value (already exists)

The component already publishes `--scroll-progress` (0 to 1) as a CSS var on `.bp-welcome-root` (v1.65gZ24, see the comment block around the scroll listener). Use this as the canonical source of truth. If it's not already exposed as a TypeScript property on the component (e.g. `scrollProgress: number`), promote it to one — `*ngIf` conditions need to read it from the template.

Also compute per-slide normalised progress: `slideProgress(index)` returns `0` when the slide is fully below the viewport, `1` when it's fully above, and a linear interpolation while the slide is the current snap target. Pure function of `scrollProgress` and `index`. Used by §2 for content reveals.

### 2. Replace `exitingFromSlide`-based `*ngIf` conditions

Audit every `*ngIf="exitingFromSlide !== N"` in the template (there are multiple — bg-layer, grain, slide-inner content per slide). Replace each with a scroll-position-derived predicate. Two candidates:

- **`isCurrentSlide(index)`** — true when `scrollProgress` is within `[index/4, (index+1)/4)`. Use this to gate the SVG bg-layer + grain (the iOS Safari unmount targets).
- **`contentRevealed(index)`** — true when the slide is the current one AND the bg flood has settled (i.e., once the user has snapped to it). This matches the "background colour floods first, content reveals second" trick you developed. Concretely: true when `slideProgress(index) > 0.6` (or whichever threshold matches what feels right — tune in QC).

Both predicates are symmetric — scrolling up into slide 2 fires the same `isCurrentSlide(1)` transition as scrolling down into it.

**Delete the `exitingFromSlide` field and all its mutators.** It's the source of the asymmetry; don't try to keep it as a back-up.

### 3. Preserve the "bg first, content second" reveal pattern

The forward-direction trick you built — let the previous slide's bg flood to the new slide's bg first, then reveal the new slide's orbs + text — must survive the refactor and work bidirectionally.

The way to land it via scroll-position functions:

- **Bg layer** (the SVG with the orbs): gated by `isCurrentSlide(index)`. Mounted only when this slide is the active snap target. The Safari unmount happens automatically as the user scrolls past.
- **Content reveal** (`bp-slide-inner` — headline, subtitle, etc.): gated by `contentRevealed(index)` with a threshold (`slideProgress > 0.6` or similar). So during the snap transition, the bg layer mounts immediately when the slide becomes current, but the text waits until the snap is mostly settled. Going backward: same threshold, same delay, same symmetric behaviour.

This is exactly the forward pattern, expressed as scroll-position functions instead of transition events. Going up scrolls "backward" through the same thresholds — content unmounts first (when `slideProgress` drops below the threshold), then the bg layer unmounts (when the slide stops being current).

### 4. Keep scroll-snap

Scroll-snap mandatory stays exactly as it is — `scroll-snap-type: y mandatory`, `scroll-snap-align: start`, `scroll-snap-stop: always`. The snap behaviour is independent of the reveal logic; this prompt only changes how the slides decide what to render at each scroll position.

### 5. Optional: orb parallax during the snap transition

Bonus polish from the demo, not required for the reverse-direction fix. While the user is scrolling between snaps, the orbs could `translateX` slightly (say ±20vw range) tied to `--scroll-progress`. Gives a kinetic feel without overwhelming the static composition. Implement only after §1-§4 are solid; tune the range to taste. Skip entirely if it conflicts with the iOS Safari blur cache.

## What NOT to do

- **Don't replace scroll-snap with continuous scroll** (the demo's pattern). You want the storytelling structure; only the reveal logic moves to scroll-position-driven.
- **Don't change the SVG/feGaussianBlur approach to CSS `filter: blur()`.** The comment block at the top of `welcome.component.ts` is firm: "Don't substitute CSS filter: blur() — calibrated against prototype."
- **Don't touch the marketing content** (slide text, marquee categories, form fields, footer). All of that stays as-is.
- **Don't change the iOS Safari `*ngIf` removal pattern** at the architectural level — keep the SVG unmounted on slide exit. Just trigger the unmount via scroll-position predicate (`isCurrentSlide`) instead of transition event (`exitingFromSlide`).
- **Don't add the demo's body-bg RGB interpolation.** Welcome's stage-tall gradient (v1.65hW) already does the equivalent in CSS. Don't double up.

## Verify

- **Forward direction unchanged.** Scrolling down slide-by-slide still produces the same visual sequence as before — bg flood, then orbs + content reveal. No regression on the polish you spent weeks getting right.
- **Backward direction now works.** Scrolling up from slide 4 to slide 3 produces the same bg-flood-then-content-reveal sequence in reverse. Each slide's orbs and text appear after the bg has settled, regardless of which direction you came from.
- **iOS Safari blur cache stays defeated.** Test on a real iOS device (or Safari Tech Preview). Scrolling rapidly between slides doesn't leave a stale blur texture or a momentary white flash on the bg-layer. The SVG is mounted only when its slide is current; unmounted otherwise.
- **Scroll progress pill** (driven by `--scroll-progress`) still tracks position smoothly in both directions.
- **No `exitingFromSlide` references remain in the codebase.** Grep:
  ```bash
  grep -rn "exitingFromSlide" client-angular/src/app/public/welcome/
  ```
  Should return zero hits. If anything remains, it's a footgun that'll silently reintroduce the asymmetry.

When complete and verified, mark p0025 `Done` in `prompts/backlog.md` and write `p0025-welcome-scroll-driven-reveal-shipped.md` per the cc-onboarding ship-report convention.
