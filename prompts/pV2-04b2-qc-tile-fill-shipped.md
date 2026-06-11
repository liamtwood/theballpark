# pV2-04b2-qc — Tile background + icon container fill correction · SHIPPED

**Status:** Shipped (awaiting chat audit pass before Done)
**Version chip:** `[Dev v2] v2.09e`
**Branch:** dev — single commit (the white tile bodies + primary-variant removal already landed in `05c95ce` during the chat-QC round; this commit applies the Figma-corrected icon fills, type scale and copy).

## Acceptance — 10/10 (verified by computed styles on /home)

1. ✓ Five uniform white bodies (`rgb(255,255,255)`, no background-image), hairline border, **`--shadow-md` at rest** (`0 4px 12px rgba(15,23,42,0.08)` — the v1-drift flag closed)
2. ✓ Icon containers `--theme-soft` (pastel `#fde7f0 → #e6f4ea`) with `--theme-accent` pink stroke (`rgb(214,51,132)`) — uniform
3. ✓ Lucide SVG renders inside every icon block
4. ✓ Zero `bp-launcher-tile--primary` elements; variant fully deleted (input/styles/interface, since `05c95ce`)
5. ✓ Labels: New Project / Past Projects / Inbox / Marketplace / Profile
6. ✓ Subtitles verbatim Figma copy in `--color-text-secondary`
7. ✓ Tokens only (raw-color lint guard green; no hex in component)
8. ✓ Build + lint + 51 specs clean
9. ✓ Hover (translateY + `--shadow-lg`) and focus-within accent ring unchanged, visible on white
10. ✓ v1 on 4200: /home 200, untouched

Title scale per spec: 22px / 400 / `--font-body`, dark text.

## Concerns not in spec

1. **`--color-text-primary` doesn't exist in v2** — the spec's title CSS references it (v1's token). v2's equivalent is `--color-text` (#111111, DESIGN.md structural neutrals); used that rather than minting a duplicate-role token. Renders as specified.
2. **Stale primary-tile lines in the spec** — the CORRECTED banner says no tile is gradient-filled, but §"Note on the two gradient tokens" and the subtitle-enhancement line still describe a primary tile body/white-subtitle treatment. Followed the correction + acceptance 1–4 (uniform, no primary); the translucent-white-over-gradient concern is therefore N/A.
3. **Fixed labels end the events-label interpolation** — "New Project"/"Past Projects" ship verbatim, so the configurable `eventLabel` no longer affects this surface (it already left the drawer in 04b1). The payload field + computed remain for future surfaces; if the drawer's label config is now fully orphaned, a cleanup prompt can retire it.
4. **Both project tiles route to `/projects`** — the spec said don't guess new slugs. "New Project" and "Past Projects" currently land on the same Coming-soon stub; the projects arc should give them distinct destinations (and "New Project" probably wants the create modal).
5. **Subtitle copy quirk flagged as requested** — "New Project"'s subtitle ("Manage active projects and supplier conversations.") reads like an active-projects line, not a create-CTA line. Shipped verbatim per the spec.
6. **Hover tint token** (spec question): the existing hover treatment (lift + shadow-lg) reads clearly on white; no `--color-fill` tint needed in my judgment — easy to add if Figma shows one.
7. **Icon legibility** (spec question): pink stroke at 1.5px on the pastel wash has strong contrast; nothing swallowed.
