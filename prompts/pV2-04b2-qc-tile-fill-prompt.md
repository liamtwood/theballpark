# pV2-04b2-qc — Tile background + icon container fill correction

> **QC-driven prompt** — follows pV2-04b1-qc's ship + Liam's visual QC.
> The `-qc` suffix marks this as a QC-feedback iteration. Small scope:
> tile + icon-container fills, plus a check on the `--bp-gradient` token's
> global standard status (already confirmed before this prompt — see
> "Note on `--bp-gradient`" below).

**QC tested:** 2026-06-11, against pV2-04b1-qc.

## Bugs

> **CORRECTED 2026-06-11 per Figma reference image.** Earlier draft said the "Add project" / "New Project" tile keeps a vivid gradient body. **That's wrong.** Per Figma, all five tiles are visually uniform — white body, soft pastel icon container, dark title, muted subtitle. The vivid `--bp-gradient` does NOT appear on any tile in `/home`; it lives in the brand mark + notification badge + brand CTAs elsewhere.

1. **All tile backgrounds** = `var(--color-surface)` (white). No tile is gradient-filled. Including the first tile (New Project).
2. **All icon container fills** = `var(--theme-soft)` (soft pastel pink → mint). The Lucide icon stroke = `var(--theme-accent)` (pink). Uniform across all five tiles.
3. **All titles** = `var(--color-text-primary)` (dark) in `var(--font-body)` / system sans. **All subtitles** = `var(--color-text-secondary)` (muted grey), `var(--font-body)`, 13–14px.
4. **No primary-variant tile.** If `bp-launcher-tile--primary` exists as a modifier from pV2-04b1-qc, **remove it** — there is no primary variant in this design. All five tiles share one style.

## Enhancements

- **Tile labels + subtitles** (Figma copy, 2026-06-11). Rename labels AND add a one-line subtitle below each title. Subtitle styling: `var(--font-body)`, 13px, weight 400, `var(--color-text-secondary)` on non-primary tiles, `var(--bp-text-on-gradient)` at 0.85 opacity on the primary tile.

  | Tile | Label | Subtitle |
  |---|---|---|
  | 1 | New Project | Manage active projects and supplier conversations. |
  | 2 | Past Projects | View completed and archived work. |
  | 3 | Inbox | Messages, supplier responses and updates. |
  | 4 | Marketplace | Browse suppliers, ideas and ballpark costs. |
  | 5 | Profile | Manage your portfolio, pricing and account. |

  Copy exactly as above. (The "New Project" tile's subtitle reads like an "active projects" line, not a "new project" CTA — flag in your ship report if it reads off in context, but ship verbatim.)

  Update both the labels and the tile route slugs if they were `add-project` / `view-projects` etc. — keep route → label aligned. If routes need to change (e.g. `/new-project`, `/past-projects`), flag in the ship report rather than guessing; don't break any in-flight routing without confirmation.

## Note on the two gradient tokens (distinguish them)

Two distinct tokens; using the wrong one = wrong brand expression.

| Token | Value | Use case |
|---|---|---|
| `--bp-gradient` | `linear-gradient(135deg, #d63384, #16a34a)` — VIVID | Brand mark, avatar fill, primary CTA body |
| `--theme-soft` | `linear-gradient(135deg, #fde7f0, #e6f4ea)` — SOFT pastel | Calm icon containers, active row tint, themed surface wash |

Both are global tokens in `client-v2/src/styles.css`. Reference as
`var(--bp-gradient)` or `var(--theme-soft)` — never re-declare, never
hex-code.

- Non-primary icon container backdrop: `var(--theme-soft)`. Lucide icon stroke: `var(--theme-accent)` (pink).
- Primary tile body: `var(--bp-gradient)`. Icon container backdrop: translucent-white over the gradient. Lucide icon stroke + title + subtitle: `var(--bp-text-on-gradient)` (white).

## Read first

1. `docs/CLAUDE.md`
2. `docs/DESIGN.md` (§2 brand tokens — confirm what you're applying)
3. `prompts/pV2-04b1-qc-home-visual-polish-shipped.md` (what landed)
4. `prompts/backlog.md` — confirm `pV2-04b2-qc` row reads `Ready`
5. This prompt

## What to change

`client-v2/src/app/shared/launcher/launcher-tile.component.ts`:

### Tile body (all five tiles)

```css
.bp-launcher-tile {
  background: var(--color-surface);             /* white */
  border: 1px solid var(--color-border-hairline);
  box-shadow: var(--shadow-md);                  /* lifted card, matches Figma */
  border-radius: var(--radius-card);
  /* other rules unchanged */
}
.bp-launcher-tile:hover {
  box-shadow: var(--shadow-lg);
}
```

No tile is gradient-filled. No primary variant. If `bp-launcher-tile--primary`
exists as a modifier class anywhere in the component or template, remove it.
Tile shadow at rest should be `--shadow-md` (was `--shadow-xs` — Liam flagged
this as drift from v1).

### Icon container (all five tiles)

```css
.bp-launcher-tile__icon-block {
  background: var(--theme-soft);       /* soft pastel pink → mint */
  color: var(--theme-accent);          /* pink Lucide stroke */
  border-radius: var(--radius-card);    /* rounded square, matches Figma */
}
```

The Lucide icon's stroke should render in the pink theme accent. Confirm via
DevTools that `color` cascades to the icon; if not, set explicit
`color: var(--theme-accent)` on `lucide-icon` inside the icon block.

### Title + subtitle

```css
.bp-launcher-tile__title {
  font-family: var(--font-body);
  font-size: 22px;                     /* matches v1 page-title scale */
  font-weight: 400;
  color: var(--color-text-primary);
}
.bp-launcher-tile__subtitle {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-secondary);
  line-height: 1.4;
}
```

## Acceptance

1. All five tiles (New Project / Past Projects / Inbox / Marketplace / Profile) have uniform white body with subtle hairline border and `--shadow-md` at rest
2. All five icon containers show SOFT pastel `--theme-soft` (pink → mint) with pink `--theme-accent` Lucide icon — uniform across tiles
3. Lucide icons render inside every tile icon container (Plus / Folder / Mail / Store / User or per existing `launcher-tile` component's mapping) — none missing
4. `bp-launcher-tile--primary` modifier removed if it exists; there is no primary variant
5. Tile labels match the new Figma copy (New Project / Past Projects / Inbox / Marketplace / Profile)
6. Subtitles render below each title in `--color-text-secondary`
7. No hex codes anywhere in component CSS — only `var(--bp-*)`, `var(--theme-*)` and `var(--color-*)` tokens
8. v2 build still clean (no raw colours leak in)
9. Hover/focus states still work and are visible against the new fills
10. v1 on 4200 unchanged

## Out of scope

- Layout, spacing, sizing — untouched
- Subtitle copy — untouched
- Back button — untouched
- Shell cog — untouched
- Drawer — untouched
- `<app-edit-field>` — untouched

## Concerns not in spec

Per `docs/ENGINEERING.md` — mandatory in your ship report. Items I'd want
to know:

- If translucent-white-over-gradient (`rgba(255,255,255,0.18)`) reads
  poorly against the brand palette, propose a token (e.g.,
  `--bp-text-on-gradient-soft`) and add it to `docs/DESIGN.md` §2
- Whether the hover state on the white tiles needs an explicit token
  (e.g., a subtle `--color-fill` background tint on hover)
- Whether the gradient stroke-width / icon size on the icon block read
  correctly (the gradient backdrop can swallow thin strokes)

## Bump + ship

1. Chip `[Dev v2] v2.09e`
2. Single small commit (or 2 max — one for icon container, one for tile body if it reads cleaner)
3. Ship report `prompts/pV2-04b2-qc-tile-fill-shipped.md` with "Concerns not in spec"
4. Flip backlog to `Shipped`; await audit-before-shipped pass

## Reply with

- Commit SHA(s)
- 7/7 acceptance verified
- Concerns not in spec
- Confirmation v1 on 4200 unchanged
- Visual screenshot (if easy) of the new `/home` tiles for compare with v1
