# p0026 — Strip welcome to static slides — Shipped

**Version:** v1.65iG
**Commit:** TBD (atomic, single-commit deletion)
**Branch:** dev → preview (preview pending QC checkpoint)

## What landed

The welcome page is now a deliberately-boring static baseline. Four slides snap-scroll on `scroll-snap-type: y mandatory`. Each renders its content + orbs + grain with no animation, no bg flood, no scroll-driven anything. The welcome-root green floor (`#287F4D`) is the only background colour visible behind the slides — slide sections are transparent, the stage is transparent, the v1.65hW stage gradient is gone, the v1.65iF fixed bg tiers are gone.

Verified grep checks (both must return zero hits — both do):

```
grep -rn "exitingFromSlide" client-angular/src/app/public/welcome/
grep -rn "v1.65hW\|stage-tall\|stage gradient" client-angular/src/app/public/welcome/
```

## Deleted

**Template:**
- 2 × `<div class="bp-bg-tier">` divs (v1.65iF crossfade tiers).
- `[class.bp-slide-exiting]` bindings on slide sections.
- `*ngIf="isCurrentSlide(N)"` on every `.bp-bg-layer` + `.bp-grain` (slides 1, 2, 3).
- `[style.opacity]="contentOpacity(N)"` on every `.bp-slide-inner` + `.bp-marquee-wrap`.

**Component class:**
- `slideF` instance property.
- `isCurrentSlide(i)`, `slideProgress(i)`, `contentOpacity(i)`, `tierOpacity(i)` methods (and earlier `contentRevealed(i)` from v1.65iC/iD).
- `exitingFromSlide` field — already gone in v1.65iC; comment trail scrubbed.
- `lastSettledIdx` field — no longer used.
- `setCurrentInView()` + `settleTimer` machinery from `ngAfterViewInit`.
- `--s1-leaving` / `--s2-leaving` / `--s3-leaving` CSS-var publishing in `setProgress()`.
- `requestAnimationFrame` + `behavior: 'instant'` special-case in `scrollToSlide()` — now a plain `stage.scrollTo({ behavior: 'smooth' })`.
- Every-scroll-tick `cdr.markForCheck()` (was only there to re-evaluate the now-deleted predicates).

**CSS:**
- `.bp-bg-tier` rules + `.bp-bg-tier--pink` / `--teal` colour overrides.
- `.bp-welcome-stage` `z-index: 2` override (no tiers below to render above).
- `.bp-welcome-stage` `background-image: linear-gradient(...)` 4-band gradient (v1.65hW) + `background-size`, `background-attachment: local`, `background-repeat`.
- Per-slide `background: #color` on `.bp-slide-1/2/3/4`.
- `.bp-slide-1 .bp-svg-bg circle { r: calc(280px + var(--s1-leaving, 0) * 1500px) }` orb-expansion math + the `--s2-leaving` twin.
- `@media (max-width: 720px) { .bp-slide-1/2 .bp-svg-bg { display: none } }` mobile defensive hide (v1.65hX).
- `.bp-svg-bg circle { opacity: 0 }` + `.bp-slide.in-view .bp-svg-bg circle { animation: bp-orb-fade-in 1.4s ... }` + `@keyframes bp-orb-fade-in`.
- Slide-2 content slide-up animations (`bp-scroll-up` keyframes + `.bp-slide-2.in-view .bp-slide-2-inner` / `.bp-marquee-wrap` triggers).
- Slide-3 `from-left` / `from-right` column reveal animations.
- Slide-4 stamp / bounce / form-rise animations.
- `.bp-slide.bp-slide-exiting` defensive `display:none` / `opacity:0` rules.

## Kept

- All marketing content (text, headlines, subtitles, marquee categories, form fields, footer copy).
- Per-slide SVG bg-layers with `feGaussianBlur stdDeviation="20"`. Always mounted — no `*ngIf`. The iOS Safari `*ngIf` SVG unmount pattern is temporarily gone; p0027 re-adds it driven by scroll position.
- Per-slide grain via SVG feTurbulence. Always mounted.
- `scroll-snap-type: y mandatory`, `scroll-snap-align: start`, `scroll-snap-stop: always`.
- Playfair Display + Libre Franklin + Inter font cascade.
- Logo + header CTA + `/api/welcome/content` cascade + form submission flow + Cloudflare Turnstile.
- `.bp-welcome-root` green floor (`#287F4D`).
- The `--scroll-progress` CSS-var publishing for the right-edge scroll pill.
- Scroll pill itself + chevron icon button.
- `step` state tracking for chevron `*ngIf` + counter labels.

## Visual result

All four slides sit on green. Slide 1 shows green + pink orbs + content (unchanged from before — green was its native bg). Slide 2 shows green + blue orbs + content (different — slide 2 was pink before). Slides 3+4 show green + green orbs + content (orbs nearly invisible — they were on teal before). Scrolling between slides reveals the next slide's static composition; the mandatory snap keeps a single slide visible at a time so there's nothing to flash mid-transit.

This is deliberately not the final look — it's the clean baseline that p0027 builds the new bg-crossfade pattern on top of. Boring but correct.

## Roll-back if needed

`git revert <v1.65iG commit>` returns the v1.65iF state (continuous opacity + proximity snap + fixed bg tiers). Independent of every other welcome change.

## Next

**Checkpoint:** ship to dev, QC the static baseline reads as expected, then p0027 begins. Scope: bg-crossfade + content reveal + iOS Safari SVG unmount via scroll predicate, but only for slides 1 ↔ 2. Validate the principle on one transition before extending to 2 → 3 / 3 → 4.
