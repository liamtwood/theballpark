# CC Prompt — p0027 — Welcome bg crossfade: slide 1 → 2 only

Layer a clean transition system on top of p0026's static baseline. Scope is **slides 1 and 2 only** — slides 3 and 4 stay as static p0026 baseline until a follow-up extends the pattern. Validate the architecture on one transition before replicating to the rest.

The principle (from the designer's demo + our analysis): every visual property is `f(scrollProgress)`. No event state, ever. Symmetric forward/backward by construction.

Single commit. Tight scope. Slides 3 and 4 untouched.

## Architecture

### 1. Single scroll-progress source

Component publishes one `scrollProgress` number, 0 to 1, normalised across the full welcome scroll height. Computed from `window.scrollY / (scrollHeight - innerHeight)`. Updated via a single RAF loop driven by `scroll` + `resize`. **No other scroll-derived state lives anywhere else in the component.**

Also publish it as `--scroll-progress` on `.bp-welcome-root` (preserve / replace whatever publishes it for the scroll pill). One source of truth for the var.

### 2. Fixed-position bg-layer stack

Add to the welcome template, BEFORE the slide stage, OUTSIDE `.bp-welcome-stage`:

```html
<div class="bp-bg-stack" aria-hidden="true">
  <div class="bp-slide-bg bp-slide-bg-1"
       [style.opacity]="bgOpacity(0)"></div>
  <div class="bp-slide-bg bp-slide-bg-2"
       [style.opacity]="bgOpacity(1)"></div>
</div>
```

```css
.bp-bg-stack {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.bp-slide-bg {
  position: absolute;
  inset: 0;
  will-change: opacity;
}
.bp-slide-bg-1 { background: <slide 1's intended bg colour>; }
.bp-slide-bg-2 { background: <slide 2's intended bg colour>; }

.bp-welcome-stage {
  position: relative;
  z-index: 1;  /* slide content + orbs render on top of the bg stack */
}
```

Use whatever colours slide 1 and slide 2 had before p0026's strip — read the v1.65 comment trail or git history. If the original per-slide bg colours can't be cleanly recovered, ask before guessing.

### 3. Bg opacity function

For 4 slides, scroll-progress 0 to 1, each slide's "centre" sits at `i / (TOTAL_STEPS - 1)`:
- Slide 0 (slide 1) centre = 0.0
- Slide 1 (slide 2) centre = 0.333
- Slide 2 (slide 3) centre = 0.667
- Slide 3 (slide 4) centre = 1.0

Each bg layer's opacity is a linear ramp from 1 at its centre to 0 by the time you reach the next slide's centre:

```typescript
bgOpacity(i: number): number {
  const stops = 1 / (TOTAL_STEPS - 1);     // 0.333 for 4 slides
  const centre = i * stops;
  const distance = Math.abs(this.scrollProgress - centre);
  return Math.max(0, 1 - distance / stops);
}
```

Effect:
- At scrollProgress = 0.0 → slide 1 bg opacity 1.0, slide 2 opacity 0.0, viewport pure slide 1 colour
- At scrollProgress = 0.167 → slide 1 opacity 0.5, slide 2 opacity 0.5, viewport even blend
- At scrollProgress = 0.333 → slide 1 opacity 0.0, slide 2 opacity 1.0, viewport pure slide 2 colour

**No seam can exist** because both layers are `position: fixed; inset: 0;` — each covers the entire viewport. The viewport always renders the literal weighted sum of the two adjacent bg colours.

### 4. Continuous content opacity for slide 1 + slide 2 only

Replace any binary visibility on `.bp-slide-1-inner` and `.bp-slide-2-inner` with continuous opacity:

```typescript
contentOpacity(i: number): number {
  const stops = 1 / (TOTAL_STEPS - 1);
  const centre = i * stops;
  const distance = Math.abs(this.scrollProgress - centre);
  // Tighter curve than bg — content fades out faster than bg
  const range = stops * 0.6;
  return Math.max(0, 1 - distance / range);
}
```

```html
<div class="bp-slide-inner bp-slide-1-inner"
     [style.opacity]="contentOpacity(0)">...</div>
<div class="bp-slide-inner bp-slide-2-inner"
     [style.opacity]="contentOpacity(1)">...</div>
```

The `range` multiplier (0.6 above) is the knob — smaller value = sharper content reveal, larger value = more gradual overlap with the bg blend. Start at 0.6; tune in QC. Pick a value where the bg has visibly settled before the new content is fully visible (the "bg floods first" principle, expressed as a numerical offset between the curves).

**Slide 3 and slide 4 inners are NOT touched.** They render as p0026's baseline.

### 5. Reinstate the iOS Safari SVG unmount — for slides 1 and 2 only

Add `*ngIf` back on slide 1 and slide 2's `bp-bg-layer` SVG, gated by `isCurrentSlide(i)` derived from scroll position:

```typescript
isCurrentSlide(i: number): boolean {
  const stops = 1 / (TOTAL_STEPS - 1);
  const centre = i * stops;
  const halfRange = stops * 0.75;  // mounted slightly past the snap window
  return Math.abs(this.scrollProgress - centre) <= halfRange;
}
```

```html
<div class="bp-bg-layer" *ngIf="isCurrentSlide(0)"><svg ...></svg></div>
<div class="bp-grain" *ngIf="isCurrentSlide(0)"></div>
```

Same pattern on slide 2. Halfrange of 0.75 stops means the SVG mounts when the user is anywhere from "fully on this slide" through "halfway to the adjacent slide" — generous mount window so the SVG is present during the crossfade, unmounted only when clearly off this slide. Tune in QC if Safari complains.

**Slide 3 + slide 4 SVGs stay always-mounted as p0026 left them.**

## What NOT to touch

- Slide 3 and slide 4 — their content, their SVG, their grain, their CSS. All unchanged from p0026 baseline.
- Scroll snap (`scroll-snap-type: y mandatory` etc.).
- The SVG `feGaussianBlur stdDeviation="20"` calibration.
- All marketing content.
- Logo, header CTA, form, footer.
- The scroll pill.

## What NOT to do

- Don't add orb translate / rotate parallax. We can layer that on after the crossfade is solid; not in this prompt.
- Don't reintroduce `exitingFromSlide` or any event-driven state. The whole point is scroll position drives everything.
- Don't add per-slide bg colours via `.bp-slide-N` classes. The bg comes from the fixed-position stack only.
- Don't crossfade slide 3 or slide 4 — they're explicitly out of scope and stay static.

## Verify

- Forward scroll from top to slide 2: bg smoothly crossfades between slide 1's colour and slide 2's colour. Content on slide 1 fades out as bg blends; content on slide 2 fades in *after* the bg has visibly settled (because content opacity uses a tighter curve than bg opacity).
- **Backward scroll from slide 2 to top: same as forward, just reversed.** No seam, no flicker, no flutter, no wrong-colour band at any speed. Test with slow scroll (proximity-style mid-park).
- Bg colours at any scroll point are a coherent full-viewport blend of two layers — never a hard horizontal seam.
- Continue scrolling to slide 3 / slide 4 — they should render as p0026 baseline (no transition, just static). No regression.
- Scroll backward from slide 3 to slide 2 — slide 2's content + bg should re-render correctly (it'll snap back into the crossfade region). Slide 3 stays static-bg.
- iOS Safari (real device or Safari Tech Preview): rapid scroll between slides 1 and 2 doesn't leave a stale blur texture or a white flash. The bg-layer SVG mounts/unmounts cleanly.
- Scroll pill still tracks position.
- Reduced-motion: not applicable yet (no parallax to disable), but verify no JS errors.

When complete, mark p0027 `Done` in `prompts/backlog.md` and write `p0027-welcome-bg-crossfade-slide-1-to-2-shipped.md` per the ship-report convention.

**After this lands:** if the pattern reads cleanly on the 1 → 2 transition, a follow-up prompt extends it to slides 2 → 3 and 3 → 4. Don't pre-empt that; validate this one first.
