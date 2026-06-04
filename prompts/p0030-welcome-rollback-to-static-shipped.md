# p0030 — Welcome rollback to p0026 static baseline — Shipped

**Version:** v1.65iM
**Commit:** TBD (single atomic commit)
**Restores:** `client-angular/src/app/public/welcome/welcome.component.ts` to its state at commit `295255b` (v1.65iG, p0026's static baseline).

## What landed

Pure file restore. `git checkout 295255b -- client-angular/src/app/public/welcome/welcome.component.ts` returned the welcome component to the four-slides-snap-scroll-with-static-orbs baseline shipped in v1.65iG. Single-file diff: `+46 / -164` lines on welcome.component.ts; environment.ts bumped one tick.

## What got removed (by virtue of the rollback)

Everything from p0027, p0028, p0029, plus their patch commits:

- **p0027 / v1.65iH–iI** — Fixed-position `bp-bg-stack` with two `.bp-slide-bg` layers + `bgOpacity(i)` predicate + welcome-stage z-index + opacity-transition CSS.
- **p0028 / v1.65iJ** — Body-bg interpolation (`SLIDE_COLORS`, `setBg`, `hexToRgb`) + horizontal orb translation (`orbTransform` translateX) + `markForCheck` → `detectChanges` switch.
- **v1.65iK** — orb radius bumps `280 → 500` on slides 1/2/4 + `isCurrentSlide` halfRange widening to `1.0 * stops`.
- **p0029 / v1.65iL** — `orbOpacity(i)` + slide 1 diagonal corners + per-slide solid bg CSS restoration + slides 3/4 green correction.

All replaced with the static baseline. No animation, no bg-stack, no JS-driven bg, no orb translation, no orb-opacity.

## Grep verification (per p0030 spec — must return zero hits)

```
grep -n "SLIDE_COLORS\|setBg\|orbTransform\|orbOpacity\|bp-bg-stack\|bp-slide-bg-" \
  client-angular/src/app/public/welcome/welcome.component.ts
```

Returns nothing. ✓

## State after rollback

Welcome page at v1.65iG behaviour:
- Four slides snap-scroll on `scroll-snap-type: y mandatory`.
- Each slide renders its content + orbs + grain statically — no fade, no animation, no transform.
- Slide 1: green bg (`#287F4D`), pink orbs at `cx=100,cy=250` + `cx=700,cy=250` (horizontal middle, `r=280`).
- Slide 2: pink bg (`#EB7396`), blue orbs at diagonal positions (`r=280`).
- Slides 3 + 4: `#6391A4` blue per v1.65i7 baseline (NOT the green correction from p0029 — that was reverted with everything else).
- Welcome-root green floor `#287F4D` retained.
- `--scroll-progress` CSS var still published for the scroll pill.
- Step state tracking for chevron + counter intact.

## Backlog status

| ID | Status |
|----|--------|
| p0027 | Superseded |
| p0028 | Superseded |
| p0029 | Superseded (rolled back) |
| p0030 | Done |

## Next

Liam decides the next approach from this clean baseline. Three attempts at producing the designer's transition (p0027 bg-stack, p0028 body-bg interp + orb translation, p0029 orb opacity) didn't land it. The static baseline is correct ground to launch a fresh attempt from once the mechanic is clearer.

## Roll-back of the roll-back (if ever needed)

`git revert <v1.65iM commit>` reinstates p0029's orb-opacity state (v1.65iL). Each of p0027/28/29's individual commits can also be cherry-picked back if any subset proves useful.
