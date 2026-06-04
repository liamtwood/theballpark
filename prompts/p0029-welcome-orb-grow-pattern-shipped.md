# p0029 — Welcome orb-grow pattern — Shipped

**Version:** v1.65iL
**Commit:** TBD (single atomic commit, dev only — preview pending QC)
**Supersedes:** p0028's body-bg interpolation + orb horizontal translation (v1.65iJ/iK). Both removed.

## What landed

After studying the designer's Figma, the actual transition mechanic is the simpler one:
1. Each slide has its own solid background colour — no interpolation between slides.
2. Orbs fade in (opacity 0 → 1) as the user scrolls through a slide — they don't translate.
3. Orb colour previews the next slide's bg colour, so at full opacity the viewport reads as the next slide's colour and the snap is seamless.
4. Slide 1's orbs sit at diagonal corners (top-left + bottom-right), not horizontal middle.

p0029 ships exactly that.

## What changed

### TS

Deleted:
- `private readonly SLIDE_COLORS` array
- `private setBg(rootEl, p)` method
- `private hexToRgb(hex)` method
- The `this.setBg(root, p)` call inside `setProgress()`
- `orbTransform(i): string` method

Added:
- `orbOpacity(i: number): number` — `Math.max(0, Math.min(1, (slideProgress(i) - 0.5) * 2))`. 0 when slide i is parked or entering from below; ramps to 1 as user scrolls THROUGH the slide toward the next one. Designer mechanic.

Scroll handler now clears any inline `root.style.background` left from p0028's setBg() mutations (one-time on `ngAfterViewInit` boot) so CSS-driven slide bgs show through where the user is parked.

### Template

For each of slides 1, 2, 3, 4:
- `.bp-bg-layer` binding: `[style.transform]="orbTransform(N)"` → `[style.opacity]="orbOpacity(N)"`.

Slide 1 specifically:
- Orb positions moved from horizontal middle (`cx=100,250` + `cx=700,250`) to diagonal corners (`cx=0,0` + `cx=800,500`). Forms the X-pattern the designer's Figma shows.
- Orb radius bumped 500 → 400. The orb fade-in does the dominance work now; the radius bump from v1.65iK is no longer needed at the same magnitude.

Slides 2, 4:
- Orb radius reverted 500 → 280. Same reasoning — fade-in handles dominance.

Slide 3 unchanged at `r=240` (its cx=400 / cy=0 vs cy=500 layout constrains it).

### CSS

Per-slide solid backgrounds restored (the bg-stack / body-interpolation systems are gone):
- `.bp-slide-1 { background: #287F4D; }` — green
- `.bp-slide-2 { background: #EB7396; ... }` — pink (flex layout kept)
- `.bp-slide-3 { background: #287F4D; }` — **green** (corrected from `#6391A4` blue; designer Figma says green)
- `.bp-slide-4 { background: #287F4D; }` — **green** (same correction)

## What's still unresolved

Slide 2 → slide 3 transition has a colour mismatch:
- Slide 2's orbs are **blue** (`#79A8BA → #457187` via the `s2-blue` linearGradient).
- Slide 3's bg is **green**.
- At slide 2's exit (orbs at opacity 1), the viewport reads blue. Snap to slide 3 → hard jump to green.

p0029 left slide 2's orbs blue (as instructed by the prompt). Three options for a follow-up fix once you've QC'd the rest:
- **(a)** Recolour the `s2-blue` gradient stops to greens so the slide 2 → 3 handoff matches.
- **(b)** Accept the blue → green jump as intentional.
- **(c)** Add a transient blue-to-green flood on slide 3 entry.

Decide after seeing the new state on dev.

## Roll-back

`git revert <v1.65iL commit>` restores v1.65iK (body-bg interpolation + horizontal orb sweep + r=500 on slides 1/2/4 + 1.0-stop mount window). Independent of all other welcome changes.

## Verify

- Scroll top → bottom slowly.
- Parked on slide 1: solid green bg, no orbs visible (orbOpacity=0 at slideProgress=0.5).
- Scroll slide 1 → 2: pink orbs fade in from diagonal corners (top-left + bottom-right), grow opacity to 1 as scroll reaches slide 1's exit. Viewport reads pink just before the snap.
- Snap to slide 2: pink bg = pink orbs — seamless handoff.
- Parked on slide 2: solid pink bg, no orbs.
- Scroll slide 2 → 3: blue orbs fade in (positions already diagonal). Viewport reads blue at exit.
- Snap to slide 3: GREEN bg appears — **expected jump, see "still unresolved" above**.
- Parked on slide 3: solid green bg, no orbs.
- Scroll slide 3 → 4: dark-green orbs fade in (cx=400 / cy=0 + cy=500), grow to opacity 1.
- Snap to slide 4: green = green, seamless.
- Backward scroll: same in reverse.
- iOS Safari rapid scroll: no stale blur texture (the `*ngIf="isCurrentSlide(i)"` mount/unmount stays — `halfRange = stops * 1.0` from v1.65iK preserved).
- Scroll pill still tracks.
