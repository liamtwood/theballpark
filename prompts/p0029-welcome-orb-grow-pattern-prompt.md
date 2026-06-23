# CC Prompt — p0029 — Welcome: orb-grow pattern (designer's actual mechanic)

After studying the designer's Figma file (`BALLPARK - SPLASH - Initial`), the actual transition mechanic is NOT horizontal orb translation + body bg interpolation (what p0028 built). It's much simpler:

1. **Each slide has its own SOLID background colour.** No interpolation between slides.
2. **Orbs fade in (opacity 0 → 1) as the user scrolls through a slide** — they don't translate. At parked state, orbs are invisible; at exit, orbs fill the viewport.
3. **Orb colour = next slide's background colour.** Slide 1's orbs are pink because slide 2 is pink. When the orbs are fully visible at the end of slide 1, the viewport is mostly pink. The snap to slide 2 (which has pink bg) is seamless — no colour jump.
4. **Slide 1 orbs are at DIAGONAL corners**, not the horizontal middle positions in current code.

This is the rebuild on that mechanic. Drops the entire body-bg interpolation + horizontal translation system from p0028. Single commit.

## What changes

### 1. Restore per-slide solid background colours

In the styles block, re-add the per-slide bg colours that p0026 stripped. **Note:** slide 3 + 4 colours are GREEN, not blue — the designer's Figma clearly shows green for both. The `#6391A4` blue from v1.65i7 was wrong; ignore it.

```css
.bp-slide-1 { background: #287F4D; }  /* green */
.bp-slide-2 { background: #EB7396; }  /* pink */
.bp-slide-3 { background: #287F4D; }  /* green — corrected from blue */
.bp-slide-4 { background: #287F4D; }  /* green */
```

If you want to confirm the exact slide 3/4 green vs the slide 1 green, ask before changing — they may be subtly different shades. Defaulting to the same green is safe.

### 2. Drop the body bg interpolation

Delete:
- `private readonly SLIDE_COLORS = [...]`
- `private setBg(rootEl, p)` method
- `private hexToRgb(hex)` method
- The `this.setBg(root, p)` call inside `setProgress()`

`.bp-welcome-root` no longer has a JS-driven background. Each slide owns its own bg via CSS.

### 3. Replace `orbTransform` with `orbOpacity`

Delete:
```typescript
orbTransform(i: number): string { ... }
```

Add:
```typescript
/**
 * Orb opacity for slide i.
 *
 * 0 when slide i is at or before its centred state (parked or entering from below).
 * Ramps to 1 as the user scrolls THROUGH slide i toward the next slide.
 *
 * The orb colour previews the next slide's bg colour, so at full opacity
 * the viewport reads as the next slide's colour — making the snap seamless.
 */
orbOpacity(i: number): number {
  const p = this.slideProgress(i);
  return Math.max(0, Math.min(1, (p - 0.5) * 2));
}
```

### 4. Wire opacity (not transform) on each slide's bg-layer wrapper

Template change for every `.bp-bg-layer`:

```html
<!-- before (p0028) -->
<div class="bp-bg-layer" *ngIf="isCurrentSlide(0)" [style.transform]="orbTransform(0)">

<!-- after (p0029) -->
<div class="bp-bg-layer" *ngIf="isCurrentSlide(0)" [style.opacity]="orbOpacity(0)">
```

Apply to all four slides. The `*ngIf="isCurrentSlide(i)"` mount predicate stays (iOS Safari blur-cache defeat).

### 5. Move slide 1's orb positions to diagonal corners

Current slide 1 has orbs at `cx=100,cy=250` and `cx=700,cy=250` (horizontal middle — creates a wide bar pattern when blurred). Designer's intent is diagonal corners — when blurred, they spread to form the X-pattern visible in the Figma's slide 1 frame 4.

Change slide 1's two `<circle>` elements:

```html
<!-- before -->
<circle cx="100" cy="250" r="280" fill="url(#s1-pink)"/>
<circle cx="700" cy="250" r="280" fill="url(#s1-pink)"/>

<!-- after — diagonal corners, top-left + bottom-right -->
<circle cx="0"   cy="0"   r="280" fill="url(#s1-pink)"/>
<circle cx="800" cy="500" r="280" fill="url(#s1-pink)"/>
```

Slide 2 already has diagonal positions (`cx=700,cy=0` + `cx=100,cy=500`) — leave those alone. Slides 3 + 4 keep their existing positions (slide 3 centre top + bottom, slide 4 horizontal middle).

### 6. Bump orb radius for full dominance at opacity 1

When the orb is at opacity 1, it needs to fill the viewport with its colour (slide 2's pink, etc.) so the snap to next slide is seamless. Current `r=280` in a viewBox of 800×500 may be too small — at full opacity the corners would still show the underlying slide bg.

Bump slide 1's circles to `r="400"` (or higher — tune in QC). Slide 2 stays r=280 for now since the user previously reported its composition was working. Slide 3 stays r=240. Slide 4 stays r=280.

### 7. Keep the rest

Unchanged from p0028:
- `scrollProgress` instance property + `--scroll-progress` CSS var publishing
- `slideProgress(i)` predicate
- `isCurrentSlide(i)` mount predicate (with `halfRange = stops * 1.0` from v1.65iK)
- `contentOpacity(i)` for slide-inner fade
- iOS Safari `*ngIf` unmount on SVG bg-layer + grain
- `cdr.detectChanges()` synchronous CD in scroll handler
- scroll-snap, fonts, marketing content, form, footer, Turnstile, scroll pill

## What NOT to do

- Don't reintroduce body bg interpolation. The whole point is each slide has its own solid colour.
- Don't bring back `orbTransform` / horizontal translation. Opacity is the only mechanic now.
- Don't add CSS transitions on the opacity binding — scroll-position-driven opacity should respond directly to scroll, not animate on its own.
- Don't change slide 2's orb positions (they're already correctly diagonal).
- Don't change the SVG `feGaussianBlur stdDeviation=20` calibration.
- Don't extend opacity animations to anything other than `.bp-bg-layer`. Content opacity stays as-is.

## What's still unresolved

The slide 2 → slide 3 transition has a colour mismatch: slide 2's orbs are **blue** (`s2-blue`), but slide 3's bg is **green** (per Figma). When slide 2's blue orbs are fully grown at slide 2's exit, the viewport will be blue — then the snap to slide 3 (green bg) will be a hard jump.

Three possibilities:
- (a) Slide 2's orb colour should be changed from blue to green to match slide 3's bg. Recolour the `<linearGradient id="s2-blue">` stops to greens.
- (b) The blue-to-green snap is intentionally abrupt — the designer accepted that one as a hard transition.
- (c) Slide 3 has a brief blue-to-green flood that we haven't accounted for.

**For p0029, leave slide 2's orbs blue.** Ship the rest, QC slides 1 → 2 + slides 3 / 4 with their new solid green bgs. Decide the slide 2 → 3 fix in a follow-up after Liam sees the new state.

## Verify

- Scroll from top to bottom slowly.
- **Parked on slide 1:** solid green bg, no orbs visible. Text "REAL COSTS REAL FAST" reads cleanly.
- **Scrolling slide 1 → 2:** pink orbs gradually appear from diagonal corners (top-left + bottom-right), grow / become visible to fill the viewport with pink by slide 1's exit.
- **Snap to slide 2:** seamless — slide 2's solid pink bg matches the fully-grown pink orbs. No jump.
- **Parked on slide 2:** solid pink bg, no orbs visible. "AI Powered by real costs..." text reads cleanly.
- **Scrolling slide 2 → 3:** blue orbs appear from diagonal corners (top-right + bottom-left), grow to fill viewport with blue.
- **Snap to slide 3:** colour jump from blue (orbs) to green (slide 3 bg) — **expected for now**, see "What's still unresolved" above.
- **Parked on slide 3:** solid green bg with dark green orbs at top + bottom (existing slide 3 composition). Text reads.
- **Scrolling slide 3 → 4:** dark green orbs of slide 3 fully visible; snap to slide 4 (also green bg) is seamless.
- **Backward scroll** (slide 2 → slide 1, slide 3 → slide 2, etc.): same visuals in reverse. Pink orbs fade out as you arrive at slide 1's green parked state.
- iOS Safari rapid scroll: no stale blur texture.

When complete, mark p0029 `Done` in `prompts/backlog.md` and write `p0029-welcome-orb-grow-pattern-shipped.md` per the cc-onboarding ship-report convention.
