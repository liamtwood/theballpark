# CC Prompt — p0004 — Marketplace browse-strip + ghost-hairline fixes

Two remaining issues from the p0001 / p0002 implementation. Both are visible on the live Marketplace; both are in the catalogue-grid component. Uses the existing **p0001 mockup** (`p0001-marketplace-messages-styling-mockup.html`) as the target — no new mockup.

Same rules as ever: existing v1.22 tokens only, no hardcoded shadow / radius / hex, icons Lucide.

## 1. The category and search panels read as if they're inside a pink wrapper

The `.bp-browse-strip` wrapper around the category-circles panel and the search panel is intended to be a transparent layout-only container (the comment in `styles.css` ~line 925 says so). But its `margin: 12px 12px 0` creates a narrow 12px gutter on the left and right of both panels, and the page-ground (`--theme-bg`) showing through that thin gutter reads visually as **"the wrapper has a pink fill."** It's especially obvious at the left edge of the viewport.

The 3-column body below (`.bp-cat-body`) doesn't have this effect because it doesn't carry the same horizontal inset — so the cat + search area looks bounded and pink while the columns sit cleanly on the same ground.

**Fix.** Either:
- **Preferred** — match the horizontal alignment: the browse strip should have the *same left/right inset as the 3-column body below*, so the page-ground reads as one continuous tinted ground from top of catalogue area to bottom, with no apparent wrapper around the cat + search panels. Remove `.bp-browse-strip`'s asymmetric `margin: 12px 12px 0` and let it inherit the same horizontal positioning as `.bp-cat-body`.
- **Alternative** — if the layout requires the strip to be horizontally inset, then drop the page-ground tint from that strip area entirely so the cat and search panels sit on white in that band. Either solution is fine; do not leave the thin pink gutter.

Files: `client-angular/src/styles.css` (`.bp-browse-strip`, `.bp-cat-body`). The panel chrome on `.bp-browse-panel` and `.bp-search-panel` is correct — leave them as they are.

## 2. Ghost hairline inside the category-circles panel

There is a thin horizontal hairline visible near the bottom of the `.bp-browse-panel` (category-circles panel). It's not the panel's outer border — it sits inside, just above the bottom edge, like a leftover divider.

**Fix.** Find and remove the spurious `border-bottom` (or hairline `<div>`) on a child element of `.bp-browse-panel`. Likely candidates: the `<app-category-circles>` host or a child element inside it (`shared/components/category-circles/category-circles.component.ts`), or a stale divider rule in `styles.css` scoped to `.bp-browse-panel`. The panel should have only its own outer panel chrome — `--border-hairline` + `--radius-card` — no internal dividers.

## Verify

- Look at the left edge of the Marketplace page: no thin pink band hugging the cat/search area. The page-ground tint reads as one continuous ground from top to bottom of the catalogue area.
- The category-circles panel has no internal hairline at its bottom edge.
- The 3-column body's horizontal alignment is unchanged.

When complete, mark p0004 `Done` in `prompts/README.md`.
