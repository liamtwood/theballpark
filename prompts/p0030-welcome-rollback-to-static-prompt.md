# CC Prompt — p0030 — Welcome: rollback to p0026 static baseline

Roll back the welcome page to the v1.65iG state (p0026 — static baseline). p0027, p0028, p0029 and all their patch commits have been unsuccessful at producing the designer's transition. Reset to clean ground; Liam decides the next approach from there.

Single commit. Pure file restore.

## What to do

Revert `client-angular/src/app/public/welcome/welcome.component.ts` to its state at commit **`295255b`** (`v1.65iG: welcome — strip to static baseline (p0026)`).

Cleanest path:

```bash
git checkout 295255b -- client-angular/src/app/public/welcome/welcome.component.ts
git diff --stat HEAD
ng build
```

That single file restore removes:
- All of p0027's bg-stack architecture (v1.65iH/iI)
- All of p0028's body-bg interpolation + horizontal orb translation (v1.65iJ/iK)
- All of p0029's orb-opacity pattern + diagonal positions (whatever version that landed at)

After the checkout, `welcome.component.ts` is back to the four-slides-snap-scroll-with-static-orbs baseline that shipped cleanly in v1.65iG.

## Verify

- `ng build` clean.
- Open `/welcome` on dev. Four slides scroll-snap normally. Each slide's content + orbs + grain render statically (no animation, no fade, no bg-stack, no JS-driven bg, no orb translation).
- Slide 1: green bg, pink orbs visible at their original `cx=100,cy=250` / `cx=700,cy=250` positions.
- Slide 2: pink bg, blue orbs.
- Slide 3 + 4: whatever their static baseline render is (likely green with green orbs per the original baseline — confirm against v1.65iG behaviour).
- Forward + backward scroll works (no event asymmetry left because there's no event-driven state).
- Scroll pill tracks.
- iOS Safari: no stale blur because there's no animation triggering Safari's Gaussian-blur compositor cache.
- No console errors.

Grep verify — these must all return zero hits (everything from the failed iterations is gone):

```bash
grep -n "SLIDE_COLORS\|setBg\|orbTransform\|orbOpacity\|bp-bg-stack\|bp-slide-bg-" client-angular/src/app/public/welcome/welcome.component.ts
```

Should return nothing.

## Mark backlog

- p0027 → already Superseded.
- p0028 → already Superseded.
- p0029 → flip to `Superseded` with note: "Rolled back to p0026 baseline via p0030."
- p0030 → mark `Done` after the revert ships.

When complete, write `p0030-welcome-rollback-to-static-shipped.md` per the ship-report convention.

Bump version to next available (`v1.65iL` or whatever's next). Commit message:

```
chore(v1.65iL): welcome — rollback to p0026 static baseline (p0030)

Reset welcome.component.ts to commit 295255b (v1.65iG, p0026's static
baseline). Removes p0027's bg-stack, p0028's body-bg interpolation +
horizontal orb translation, and p0029's orb-opacity pattern — none of
them produced the designer's intended transition. Liam decides the next
approach from this clean baseline.
```
