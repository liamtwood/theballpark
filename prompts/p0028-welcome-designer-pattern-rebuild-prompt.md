# CC Prompt — p0028 — Welcome rebuild: designer's actual pattern (body-bg interpolation + orb translation)

p0027 built a fixed-position bg-layer crossfade. Sound architecture, wrong tool for the visual effect we're trying to reproduce. The designer's reference demo (`paralaxblurandnoise.html`) uses a different pattern entirely:

1. **One continuous body background colour** that smoothly interpolates between adjacent slide colours based on scroll position. No layers, no opacity, no crossfade — just one CSS background value updated each frame.
2. **Orbs translate horizontally** across the viewport based on each slide's scroll progress. Large + blurred orbs sweep in from off-screen, dominate the viewport when centred, and exit the opposite side. The orb motion is what reads as "the transition" — colour interpolation alone doesn't.

This prompt rebuilds the welcome transition layer with that pattern. All four slides. Single commit.

p0027's bg-stack architecture goes away entirely; p0028 replaces it.

## Architecture

### 1. Drop the bg-stack

Delete:
- `.bp-bg-stack` container + all `.bp-slide-bg-N` children from the template
- All `.bp-bg-stack` / `.bp-slide-bg` CSS rules
- `bgOpacity(i)` predicate from the component
- The static slide-3 / slide-4 layers if they were added in v1.65iI

The welcome-root background style ALSO goes — it'll be set dynamically by JS each frame.

### 2. Interpolated body / welcome-root background

Single source of truth for the bg colour at any scroll position. Computed from `scrollProgress` (already exists from p0027) and applied directly via `root.style.background`. **No CSS classes, no layers.**

```typescript
private readonly SLIDE_COLORS = [
  '#287F4D',  // slide 1 — green
  '#EB7396',  // slide 2 — pink
  '#6391A4',  // slide 3 — blue
  '#6391A4',  // slide 4 — blue (same as slide 3 per the v1.65i7 baseline)
];

private setBg(scrollProgress: number) {
  // Number of intervals between colours
  const intervals = this.SLIDE_COLORS.length - 1;  // 3
  const scaled = scrollProgress * intervals;
  const i = Math.min(Math.floor(scaled), intervals - 1);
  const t = scaled - i;
  const c1 = this.hexToRgb(this.SLIDE_COLORS[i]);
  const c2 = this.hexToRgb(this.SLIDE_COLORS[i + 1]);
  const blended = this.blend(c1, c2, t);
  this.root.style.background = `rgb(${blended.r}, ${blended.g}, ${blended.b})`;
}

private hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

private blend(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}
```

Call `setBg(this.scrollProgress)` at the same point in the scroll handler that publishes `--scroll-progress`. One source, one update per scroll event.

At any scroll position, the body bg is **one** colour — the linearly interpolated blend of the two adjacent slide colours. No midpoint muddiness from layered opacity, no seam, no `position: fixed` layers. Just the background style updating in place.

### 3. Orb horizontal translation per slide

Each slide's `.bp-bg-layer` (the wrapper div around the SVG) gets a CSS transform applied based on that slide's progress. The orbs themselves stay at their fixed `cx` / `cy` inside the SVG — we move the whole wrapper.

```typescript
/**
 * slideProgress(i) returns:
 *   0   when slide i is one slide below the viewport (entering from below)
 *   0.5 when slide i is centred (the user is parked on it)
 *   1   when slide i is one slide above the viewport (exited above)
 * Linearly interpolated, clamped.
 */
private slideProgress(i: number): number {
  const intervals = TOTAL_STEPS - 1;
  const centre = i / intervals;
  const halfWindow = 1 / intervals;
  const raw = 0.5 + (this.scrollProgress - centre) / (2 * halfWindow);
  return Math.max(0, Math.min(1, raw));
}

orbTransform(i: number): string {
  const p = this.slideProgress(i);
  // Alternate direction per slide so the sweep doesn't read as mechanical:
  //   even slides: enter from left  (-90vw → +90vw)
  //   odd slides:  enter from right (+90vw → -90vw)
  const direction = i % 2 === 0 ? -1 : 1;
  const x = direction * (-90 + 180 * p);  // -90 → +90 (or reversed)
  return `translateX(${x}vw)`;
}
```

Wire it in the template:

```html
<div class="bp-bg-layer" 
     *ngIf="isCurrentSlide(0)"
     [style.transform]="orbTransform(0)">
  <svg class="bp-svg-bg" ...>...</svg>
</div>
```

Apply on all four slides. The `*ngIf="isCurrentSlide(i)"` (already exists from p0027 for slides 1+2) stays as the iOS Safari unmount mechanism. Extend it to slides 3 and 4 with the same predicate.

**Important:** the `<svg>` inside stays exactly as it is — same `viewBox="0 0 800 500"`, same `<circle>` elements at their current `cx`/`cy`/`r`, same `feGaussianBlur stdDeviation="20"`. The translation lives on the wrapper div, not inside the SVG.

### 4. Orb size — make them dominate the viewport

The designer's circles are 2000×2000px. Ours are r=280 in a viewBox of 800×500 — when rendered at common viewport widths, they're nowhere near as visually dominant.

Bump the orb size so they cover much more of the viewport when centred. Two options:

- *A — increase `r` on each `<circle>`.* Try `r="500"` or larger as a starting point. They'll still be bound by the SVG's viewBox, but with the wrapper at 100vw × 100vh, they'll fill much more space.
- *B — scale the SVG.* Add `width="200vw" height="200vh"` (or similar) to the `.bp-svg-bg` so the SVG itself is larger than the viewport. The orbs then naturally render bigger.

Start with **A** (simpler, fewer rendering surprises). Tune `r` per slide to match the dominance effect the designer's video shows. If A doesn't produce enough dominance, fall back to B.

### 5. Content opacity (keep from p0027)

`contentOpacity(i)` stays as-is. The text fade-in / fade-out timing was the part of p0027 that read correctly — preserve it.

```typescript
contentOpacity(i: number): number {
  const stops = 1 / (TOTAL_STEPS - 1);
  const centre = i * stops;
  const distance = Math.abs(this.scrollProgress - centre);
  const range = stops * 0.6;
  return Math.max(0, 1 - distance / range);
}
```

Apply to `[style.opacity]` on `.bp-slide-inner` for all four slides. The text fades out as you scroll away and fades in as you approach, gated tighter than the bg+orb so it doesn't appear over the wrong colour.

### 6. iOS Safari SVG unmount

Keep `isCurrentSlide(i)` from p0027 driving the `*ngIf` on `.bp-bg-layer` + `.bp-grain`. Extend to all four slides:

```html
<div class="bp-bg-layer" *ngIf="isCurrentSlide(i)" [style.transform]="orbTransform(i)">
  <svg ...></svg>
</div>
<div class="bp-grain" *ngIf="isCurrentSlide(i)"></div>
```

The `halfRange = 0.75 * stops` from p0027 stays. SVGs are mounted during the scroll window for their slide and unmounted otherwise — Safari's Gaussian-blur compositor cache doesn't get a chance to leak.

### 7. Change detection

The scroll listener (already exists, passive) calls a single update on every scroll event:

```typescript
const onScroll = () => {
  setProgress();      // publishes --scroll-progress + updates this.scrollProgress
  this.setBg(this.scrollProgress);  // directly mutates root.style.background
  this.cdr.detectChanges();  // synchronous — was markForCheck() in p0027, switching here
};
```

**Switch from `markForCheck()` to `detectChanges()` on the scroll handler** — synchronous CD means the orb transforms re-evaluate every frame. The `setBg` call updates the bg directly via `style.background`, bypassing Angular CD entirely (because it's not a binding). The orb transforms still go through Angular property bindings, so they need synchronous CD to stay in sync with the scroll.

If `detectChanges()` shows perf issues on slow devices, fall back to a `requestAnimationFrame` loop driven by the scroll event.

## What NOT to do

- Don't keep any of the bg-stack architecture. It's the wrong pattern; partial removal will collide with the new approach.
- Don't restore per-slide `.bp-slide-N { background: ... }` CSS rules. The body bg owns all colour now.
- Don't substitute CSS `filter: blur()` for the SVG `feGaussianBlur`. The original calibration comment block stands — that hasn't changed.
- Don't change the marketing content, scroll-snap, fonts, scroll pill, form, footer, Turnstile, content fetch.
- Don't rotate the orbs (the designer rotates up to 720°). Skip rotation for now — translation alone is the core effect. We can layer rotation in a follow-up if it adds value.

## Verify

- Open `/welcome` on dev, hard refresh. Version chip reads `[Dev] v1.65iJ` (or whatever the next bump is).
- Scroll from top to bottom slowly. Body bg interpolates smoothly across the whole page — green at top blending into pink in the middle into blue at the bottom. **No discrete colour transitions.** At any scroll position, the bg is ONE coherent colour.
- Orbs for the current slide are visible and translate horizontally as you scroll past their slide. Slide 1's pink orbs enter from one side, sweep through the centre, exit the other. Slide 2's blue orbs do the same in the opposite direction.
- When parked on a slide (snap settled), that slide's orbs sit at their centred position (around `translateX(0)`).
- Backward scroll produces identical visuals in reverse.
- Slide content fades in/out at the contentOpacity timing — bg has visibly arrived before text shows.
- iOS Safari rapid scroll: no stale Gaussian-blur texture, no white flash.
- Scroll pill still tracks position.

When complete, mark p0028 `Done` in `prompts/backlog.md` and write `p0028-welcome-designer-pattern-rebuild-shipped.md` per the cc-onboarding ship-report convention.
