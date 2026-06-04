# p0028 — Welcome rebuild: designer's actual pattern — Shipped

**Version:** v1.65iJ
**Commit:** TBD (single atomic commit, dev only — preview pending QC checkpoint)
**Supersedes:** p0027's bg-stack architecture (v1.65iH/iI) — fully removed in this commit.

## What landed

p0027's fixed-position bg-stack crossfade replaced with the designer's actual pattern from `paralaxblurandnoise.html`:

1. **One continuously-interpolated body background colour** — no layers, no opacity, no crossfade. Single `rgb(...)` value applied directly to `.bp-welcome-root.style.background` each scroll tick.
2. **Orbs translate horizontally** — each slide's `.bp-bg-layer` wrapper gets a CSS `translateX()` based on the slide's progress through the viewport. Even slides enter from left, odd from right.

All four slides participate this time (p0027 was scoped to 1+2; the rebuild covers everything in one pass).

## Architecture

### Body bg interpolation
```typescript
private readonly SLIDE_COLORS = [
  '#287F4D',  // slide 1 — green
  '#EB7396',  // slide 2 — pink
  '#6391A4',  // slide 3 — blue
  '#6391A4',  // slide 4 — blue (same as slide 3 per v1.65i7 baseline)
];

private setBg(rootEl: HTMLElement | null, p: number) {
  const intervals = this.SLIDE_COLORS.length - 1;  // 3
  const scaled = p * intervals;
  const i = Math.min(Math.floor(scaled), intervals - 1);
  const t = scaled - i;
  const c1 = this.hexToRgb(this.SLIDE_COLORS[i]);
  const c2 = this.hexToRgb(this.SLIDE_COLORS[i + 1]);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  rootEl.style.background = `rgb(${r}, ${g}, ${b})`;
}
```

Called from `setProgress()` alongside the `--scroll-progress` CSS var update. One colour value, one update per scroll event. No CSS class involved.

### Orb translation
```typescript
slideProgress(i: number): number {
  const intervals = TOTAL_STEPS - 1;
  const centre = i / intervals;
  const halfWindow = 1 / intervals;
  const raw = 0.5 + (this.scrollProgress - centre) / (2 * halfWindow);
  return Math.max(0, Math.min(1, raw));
}

orbTransform(i: number): string {
  const p = this.slideProgress(i);
  const direction = i % 2 === 0 ? -1 : 1;
  const x = direction * (-90 + 180 * p);  // -90vw → +90vw (or reversed)
  return `translateX(${x}vw)`;
}
```

`slideProgress(i)` returns 0 when slide i is one slide below the viewport, 0.5 at centre, 1 when one slide above. Linearly clamped. `orbTransform(i)` maps it to a viewport-wide horizontal sweep with alternating direction per slide.

Wired on all four slides:
```html
<div class="bp-bg-layer" *ngIf="isCurrentSlide(i)" [style.transform]="orbTransform(i)">
  <svg ...></svg>
</div>
```

### Content opacity (kept from p0027)
Unchanged formula. Applied to all four slides now (was 1+2 only in p0027):
```typescript
contentOpacity(i: number): number {
  const stops = 1 / (TOTAL_STEPS - 1);
  const centre = i * stops;
  const distance = Math.abs(this.scrollProgress - centre);
  const range = stops * 0.6;
  return Math.max(0, 1 - distance / range);
}
```

### iOS Safari unmount (extended)
`isCurrentSlide(i)` with `halfRange = stops * 0.75` mount window gates the bg-layer + grain. Now applied to all four slides — slides 3 + 4 inherit the same iOS Safari blur-cache defeat.

### Change detection
Scroll handler switched `cdr.markForCheck()` → `cdr.detectChanges()`. Synchronous CD means orb transforms + content opacities update in the same frame as `setBg()`, so bg colour and orb position never drift.

## Template changes

Slide 1, 2, 3, 4 — every `.bp-bg-layer` gets:
- `*ngIf="isCurrentSlide(N)"` (was on 1+2 already, added to 3+4)
- `[style.transform]="orbTransform(N)"`

Every `.bp-grain`:
- `*ngIf="isCurrentSlide(N)"` (was on 1+2, added to 3+4)

Every `.bp-slide-inner`:
- `[style.opacity]="contentOpacity(N)"` (was on 1+2, added to 3+4)

Slide 2's `.bp-marquee-wrap`: `[style.opacity]="contentOpacity(1)"` (kept).

Removed:
- `<div class="bp-bg-stack">` + its two children.

## CSS changes

Removed:
- `.bp-bg-stack` rule.
- `.bp-slide-bg` rule + `.bp-slide-bg-1` / `--2` colour overrides.
- `.bp-welcome-root { background: #287F4D }` (set by JS now).

Kept:
- `.bp-welcome-stage { z-index: 1 }` — harmless now that bg-stack is gone, but doesn't hurt.

## What NOT touched (per p0028 spec)

- SVG `feGaussianBlur stdDeviation="20"` calibration. Original `<circle>` `cx` / `cy` / `r` values preserved (no orb size bump — saved for follow-up if dominance isn't enough).
- Marketing content, scroll-snap (`y mandatory` + snap-stop), fonts.
- Logo, header CTA, form, footer, Turnstile, content fetch.
- Right-edge scroll pill (still driven by `--scroll-progress`).

## Known follow-ups

The prompt called for bumping orb `r` from `280 → 500` to make orbs dominate the viewport when centred. **Held back** as a separate tune-up: the current `r=280` orbs combined with the new horizontal sweep may already produce the visual effect the designer wants, and bumping `r` is reversible if dominance is still insufficient. Easier to QC the sweep-only baseline first, then add size if needed.

## Roll-back

`git revert <v1.65iJ commit>` returns to v1.65iI (p0027 bg-stack with restored welcome-root green floor + opacity transition). Independent of all other welcome changes.

## Verify

- Scroll from top to bottom slowly: bg interpolates smoothly through green → pink → blue. One coherent colour at any scroll point.
- Orbs visible only when their slide is current; sweep horizontally across the viewport as scroll progresses past their slide.
- Even slides (1, 3) enter from one side, odd (2, 4) from the other — sweep doesn't read as mechanical.
- Backward scroll: identical visuals in reverse.
- Content text fades in/out at contentOpacity timing — bg has settled before text shows (tighter range than bg interpolation).
- iOS Safari rapid scroll: no stale Gaussian-blur texture (bg-layer mounts via `*ngIf="isCurrentSlide(i)"` and unmounts when off-slide).
- Right-edge scroll pill still tracks.

If the sweep feels too aggressive or too subtle, the knob is the `(-90 + 180 * p)` expression in `orbTransform`. Reduce magnitude (e.g., 60 instead of 90) for a tighter sweep; increase for a wider one.
