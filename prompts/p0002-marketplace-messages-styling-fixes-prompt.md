# CC Prompt — p0002 — Marketplace + Messages styling fixes

Follow-up to **p0001**. The first implementation of p0001 missed several things. These are all "match the mockup" corrections — the p0001 spec and `p0001-marketplace-messages-styling-mockup.html` already describe the target; this prompt just lists where the build diverged.

Same rules as p0001: use existing v1.22 tokens only (`--shadow-xs/sm`, `--border-hairline`, `--radius-card/button/pill`, `--theme-*`, semantic `--color-*`). No new tokens, no hardcoded shadows / radii / hex. Icons are Lucide only. Styling and structural-layout only — no data-flow or logic changes.

These apply to both the Marketplace and Messages (shared components).

## Fixes

1. **Search panel must be white.** It rendered with the theme tint as its background — give it `--color-surface` + `--border-hairline` + `--shadow-xs`, identical to every other panel.
2. **Delete the stray container between the page header and the category-circles panel.** It serves no purpose — remove the element entirely. The category-circles panel sits directly on the tinted page ground.
3. **Panel headers must be one fixed height** so the hairline dividers align across FILTER / RESULTS / PROJECT SUMMARY — they should read as one continuous line across the row.
4. **Header icons — drop the circle.** PROJECT SUMMARY's icon rendered inside a circle; FILTER and RESULTS did not. Remove the circle on all three: a plain inline Lucide icon beside the eyebrow. Circles are for category icons and avatars only, never panel-header eyebrows.
5. **The search input needs its own field container** inside the (now white) panel — `--theme-soft` fill + `--border-hairline`, so it reads as an input and not floating placeholder text.
6. **Trim the search panel's vertical padding.** It is far too tall for 12px text — tighten to match the other panels' header rhythm.
7. **Separate the Recommend button from the view toggle** in the RESULTS header. They are different control types (AI action vs display mode) and must not read as one cluster — add a gap or a divider between them.
8. **Active category circle = solid `--theme-accent` fill with a white icon** — not the light fill + thin ring. The active state must be unmistakable. The "+ Add category" circle is also `--theme-accent`-filled; the two stay distinct by icon and end-of-row position.
9. Minor: the category-circles panel has wide empty side margins — tighten if quick.

## Verify

- Both tabs: search panel is white and matches the other panels; no stray container above the circles.
- The three panel-header dividers line up across the row.
- All three panel headers carry a plain inline Lucide icon — no circles.
- Active category circle is a solid themed fill with a white icon; switch the theme preset and confirm it recolours.
- No hardcoded shadow / radius / hex values introduced.

When complete and verified, mark p0002 `Done` in `prompts/README.md`.
