# p0027 — Welcome bg crossfade: slide 1 → 2 only — Shipped

**Version:** v1.65iH
**Commit:** TBD (single atomic commit)
**Branch:** dev (preview pending QC checkpoint)

## What landed

The scroll-position-driven transition pattern from the designer's analysis, now layered on top of p0026's static baseline — scoped to **slides 1 and 2 only**. Slides 3 + 4 are untouched and continue to render as static p0026 baseline.

The principle: every visual property in scope is `f(scrollProgress)`. No event state. Symmetric forward / backward by construction.

## Architecture

### Single scroll-progress source
- `scrollProgress: number` instance property, range 0..1. Computed in the scroll handler as `clamp(stage.scrollTop / (stage.scrollHeight - stage.clientHeight), 0, 1)`.
- Same value written to `--scroll-progress` on `.bp-welcome-root` for the right-edge scroll pill.
- One source, two consumers — instance prop drives the predicates; CSS var drives the pill.
- `cdr.markForCheck()` fires every scroll tick so OnPush re-evaluates predicates as the user scrolls within a slide.

### Fixed-position bg-stack
```html
<div class="bp-bg-stack" aria-hidden="true">
  <div class="bp-slide-bg bp-slide-bg-1" [style.opacity]="bgOpacity(0)"></div>
  <div class="bp-slide-bg bp-slide-bg-2" [style.opacity]="bgOpacity(1)"></div>
</div>
```
- `.bp-bg-stack` is `position: fixed; inset: 0; z-index: 0; pointer-events: none;`
- Two `.bp-slide-bg` children, both `position: absolute; inset: 0;`. Will-change: opacity.
- `.bp-slide-bg-1` background `#287F4D` (slide 1 green). `.bp-slide-bg-2` background `#EB7396` (slide 2 pink).
- `.bp-welcome-stage` gets explicit `z-index: 1` so slides + their orbs / grain / content stack above the bg layers.
- The v1.65hS / v1.65iG green floor on `.bp-welcome-root` is removed — the bg-stack owns it now.

### Predicates (pure functions of scrollProgress)
```typescript
bgOpacity(i: number): number {
  const stops = 1 / (TOTAL_STEPS - 1);
  const centre = i * stops;
  const distance = Math.abs(this.scrollProgress - centre);
  return Math.max(0, 1 - distance / stops);
}

contentOpacity(i: number): number {
  const stops = 1 / (TOTAL_STEPS - 1);
  const centre = i * stops;
  const distance = Math.abs(this.scrollProgress - centre);
  const range = stops * 0.6;
  return Math.max(0, 1 - distance / range);
}

isCurrentSlide(i: number): boolean {
  const stops = 1 / (TOTAL_STEPS - 1);
  const centre = i * stops;
  const halfRange = stops * 0.75;
  return Math.abs(this.scrollProgress - centre) <= halfRange;
}
```

- `bgOpacity` is a linear ramp from 1 at the slide's centre to 0 at the next slide's centre. Adjacent layers always sum to 1 → viewport renders a clean alpha-blend at every scroll position. No seam possible.
- `contentOpacity` uses a tighter range (`stops * 0.6`) so content fades faster than bg — gives the "bg floods first, content reveals second" pattern as a numerical offset between curves.
- `isCurrentSlide` uses a generous `0.75 * stops` halfRange so the SVG stays mounted during the crossfade and unmounts only when clearly off-slide. Defeats iOS Safari's Gaussian-blur compositor cache.

### Template wiring (slides 1 + 2 only)
- Slide 1 `.bp-bg-layer` + `.bp-grain`: `*ngIf="isCurrentSlide(0)"`.
- Slide 1 `.bp-slide-inner`: `[style.opacity]="contentOpacity(0)"`.
- Slide 2 `.bp-bg-layer` + `.bp-grain`: `*ngIf="isCurrentSlide(1)"`.
- Slide 2 `.bp-slide-inner` + `.bp-marquee-wrap`: `[style.opacity]="contentOpacity(1)"`.

Slides 3 + 4: **untouched**. Their SVG, grain, and inner content stay always-mounted at static opacity per p0026 baseline.

## Visual behaviour

Forward scroll from top to slide 2:
1. `scrollProgress = 0` → `bgOpacity(0) = 1`, `bgOpacity(1) = 0`. Slide 1 green visible, slide 1 SVG + grain + content all rendered at full opacity.
2. `scrollProgress = 0.167` (halfway between slide 1 and slide 2 centres) → `bgOpacity(0) = 0.5`, `bgOpacity(1) = 0.5`. Viewport renders a 50/50 alpha-blend of green and pink. Slide 1 content opacity ≈ 0.16 (tight curve), slide 2 content opacity ≈ 0.16. Both nearly invisible — the eye sees clean bg blend.
3. `scrollProgress = 0.333` → `bgOpacity(0) = 0`, `bgOpacity(1) = 1`. Pure pink. Slide 1 content invisible; slide 2 content fully visible.

Backward scroll: same curves, reversed. By construction symmetric.

Past slide 2 (scrollProgress > 0.333) into slide 3 + 4 territory: bg-stack stays at pure pink (`bgOpacity(1) = 1` for any scrollProgress past its centre... wait, actually that's not quite right). Re-reading the formula: at scrollProgress = 0.5 (between slide 1 and slide 2 centres in the 4-slide spread), `bgOpacity(1) = 1 - |0.5 - 0.333| / 0.333 = 1 - 0.5 = 0.5`. And there's no slide-3 bg layer yet, so the viewport behind slide 3 shows slide-2 pink at 0.5 opacity over... nothing (no floor). Hmm — that's a visual gap.

**Known limitation:** without a slide-3 bg layer or a floor colour, the viewport behind slides 3 + 4 will show a thinning slide-2 pink → eventually black (browser default body bg) as scrollProgress moves past 0.333 toward 1.0. This is the gap the follow-up prompt closes by extending the pattern to slides 3 + 4. Slides 3 + 4 themselves still have all their content + orbs rendering at full opacity (p0026 baseline), so the gap is hidden as long as the user is parked on one of those slides. It only shows during the slide 2 → 3 transition.

## What NOT touched

- Slides 3 and 4: content, SVG, grain, CSS — all unchanged from p0026 baseline.
- `scroll-snap-type: y mandatory` + snap-align + snap-stop.
- SVG `feGaussianBlur stdDeviation="20"` calibration.
- All marketing content.
- Logo, header CTA, form, footer, Turnstile, content fetch.
- Right-edge scroll pill.

## Roll-back if needed

`git revert <v1.65iH commit>` restores v1.65iG static baseline cleanly. The bg-stack, predicates, and scroll-position state are all introduced in this one commit; reverting drops them all and re-instates the welcome-root green floor.

## Next

If 1 → 2 reads clean (no seam, no flutter, symmetric forward / backward, iOS Safari blur-cache stays defeated):
- **Follow-up p0028** extends the same pattern to slides 2 → 3 and 3 → 4. Adds two more bg layers (`.bp-slide-bg-3`, `.bp-slide-bg-4`), removes the v1.65iG "all transparent" handling for slides 3 + 4, wires their bg-layer / grain / inner to the same predicates.

If 1 → 2 still has a visible artifact: tune `range` in `contentOpacity` (currently `stops * 0.6` — drop to 0.4 for sharper content reveal, raise to 0.8 for more overlap with bg). Or tune `halfRange` in `isCurrentSlide` if the SVG mount/unmount feels off.
