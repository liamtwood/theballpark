# CC Prompt — p0026 — Strip welcome to static slides

Back out p0025 and the original transition machinery on the welcome page. End state: four slides that snap-scroll, each renders its content + orbs + grain, no animated transitions, no bg flood, no scroll-driven anything. Boring on purpose. This is the clean baseline that p0027 will build the new transition system on top of.

Single commit. Tight scope.

## Delete

- `exitingFromSlide` field on the component class, all mutators, all initialisers
- Every `*ngIf="exitingFromSlide !== N"` condition in the template (audit slide 1 / 2 / 3 / 4 bg-layer + grain + slide-inner gates)
- The bg-flood-first hack (whatever fires the bg-colour repaint as the user begins to leave a slide — find it via the v1.65 comment trail referencing "flood", "exit", or similar)
- The v1.65hW scroll-tall stage gradient on `.bp-welcome-stage` (the `linear-gradient` painted across the entire stage height that mirrors slide boundaries)
- Per-slide `background-color` rules on `.bp-slide-1`, `.bp-slide-2`, `.bp-slide-3`, `.bp-slide-4` in the styles block
- Anything p0025 introduced — scroll-position predicates (`isCurrentSlide`, `contentRevealed`, etc.), the continuous opacity bindings, the `scrollProgress` property if it was added in p0025 (NOT the `--scroll-progress` CSS var used by the scroll pill — that stays)
- The scroll listener's emit-to-component logic if it was added in p0025 specifically for the transition (preserve any pre-existing logic that drives the scroll pill)

## Keep

- All marketing content (text, headlines, subtitles, marquee categories, form fields, footer copy)
- Per-slide SVG bg-layers with `feGaussianBlur stdDeviation="20"` — the calibration comment block at the top of the component is firm: do not substitute CSS `filter: blur()`
- Per-slide grain via SVG feTurbulence
- `scroll-snap-type: y mandatory`, `scroll-snap-align: start`, `scroll-snap-stop: always` on `.bp-slide`
- The iOS Safari `*ngIf` SVG unmount pattern — **but its trigger rewires in p0027**. For p0026, the SVG is always mounted (no `*ngIf` on the bg-layer). Acceptable temporary regression — p0027 puts the unmount back, driven by scroll position.
- Playfair Display + Libre Franklin + Inter font cascade
- Logo + header CTA + `/api/welcome/content` cascade + form submission flow
- The `--scroll-progress` CSS var publishing for the scroll pill (preserve whatever already drove the pill before p0025)
- The scroll pill itself (`.bp-scroll-track` + `.bp-scroll-pill`)

## Don't bother

- Don't refactor what's left for tidiness in this commit. The point is to delete cleanly, not polish.
- Don't introduce the new bg-crossfade pattern. That's p0027.
- Don't touch the multiline headline (`multiline()` helper) or the eyebrow logo logic.

## Verify

- `npm start` / `ng build` clean.
- Open `/welcome` on dev. Four slides visible, each snap-scrolls to. Content renders. Orbs render (statically — no fade-in / fade-out). Grain renders. Scroll snap behaves.
- No animated transitions anywhere — scrolling between slides reveals the next slide's static composition with whatever the default body bg shows around them.
- Backward scroll works (because there's no event-driven asymmetry left to break).
- Scroll pill still tracks position.
- No console errors. No regression on form submission.
- Grep verify — these must all return zero hits:
  ```bash
  grep -rn "exitingFromSlide" client-angular/src/app/public/welcome/
  grep -rn "v1.65hW\|stage-tall\|stage gradient" client-angular/src/app/public/welcome/
  ```

When complete, mark p0026 `Done` in `prompts/backlog.md` and write `p0026-welcome-strip-to-static-shipped.md` per the cc-onboarding ship-report convention.

**Checkpoint:** ship, QC, confirm the static baseline reads correctly before p0027 begins. The welcome page can ship like this to dev — it's boring but correct.
