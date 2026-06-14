# Pills — non-interactive labels + counters + indicators

One-pager. The pill family covers small visual indicators that aren't
buttons: status badges, tag chips, count badges, unread dots. Interactive
"chip toggles" live in `BUTTONS.md` (`.bp-chip` / `.bp-chip--active`).

Pairs with: `CODELISTS.md` (status pill is the consumer of status codelist
meta); `BUTTONS.md` (interactive chips); `CARDS.md` (tag chips overlay on
card images, count badges in card meta rows); `DESIGN.md` §5 (typography
role for the status pill text).

## What it is

Anything pill-shaped that **conveys state or category but is not itself an
action** falls under this primitive family:

- **Status pill** — entity lifecycle state (Draft, Active, Completed)
- **Tag chip** — category / brand / type label (Warehouse / Industrial, Nike)
- **Count badge** — small number indicator (3 unread, 9 items)
- **Unread dot** — minimal binary indicator (has-new / read)
- **Capsule meta** — micro-labels (ETA, distance, "From £X")

If a pill is clickable / toggleable, it's a `.bp-chip` from `BUTTONS.md`,
not a pill from this doc. The distinction matters for accessibility
(buttons need keyboard focus + ARIA roles; pills don't).

## Why we needed it

Same logic as buttons + cards: by the time you've shipped four
status-bearing surfaces, you have four slightly different reds + three
border-radius variants + two ways of showing counts. Locking pill chrome
once makes every future status / tag / badge consistent on day one, and
ties status pills to the codelist `meta` so colour + icon come from the
data — not from per-component CSS.

## The archetypes

| Archetype | Class | Visual | Driver |
|---|---|---|---|
| **Status pill** | `.bp-status-pill` | 11px UPPERCASE tracked, semi-rounded pill, SOLID fill from codelist `meta.color` + white text/icon (v1 parity, locked 2026-06-13) | Codelist `meta` (color / icon / label) — see CODELISTS.md |
| **Tag chip** | `.bp-tag-chip` | 13px tracked-normal, soft pastel pill, `--theme-soft` bg + `--theme-text` text | Static / inline content |
| **Count badge** | `.bp-count-badge` | Small circle (or stadium for 2+ digits), accent bg + white text, sits as overlay or inline | Live count from data |
| **Unread dot** | `.bp-unread-dot` | 8px circle, brand-accent solid | Binary state (has-unread true/false) |
| **Capsule meta** | `.bp-capsule` | 11px regular pill, hairline border, transparent bg, `--color-text-secondary` text | Micro-meta (timestamps, "From £X", distance) |

## The locked specs

### `.bp-status-pill` (codelist-driven)

```css
.bp-status-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-family: var(--bp-font);
  font-size: 11px;        /* documented exception per TYPE-01 §5 */
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  line-height: 1;
  /* color + bg come from codelist meta — see consumption pattern below */
}
```

**Consumption pattern (SOLID — Liam, 2026-06-13, v1 parity):** the pill is
filled with `meta.color`; text + icon are white. Just mount the shared
`<app-status-pill>` — don't hand-roll the markup:

```html
<app-status-pill list="project_status" [code]="project.status" />
```

Internally: `background = metaColor(meta.color)` (solid), `color =
var(--bp-text-on-gradient)` (white). `meta.color_soft` is **no longer used
by the status pill** — it filled the background under the old soft style
(superseded 2026-06-13). Unknown codes fall back to a neutral solid
(`--color-text-muted`), never blank.

### `.bp-tag-chip` (decorative)

```css
.bp-tag-chip {
  display: inline-flex; align-items: center;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  font-family: var(--bp-font);
  font-size: var(--text-base);  /* 13px */
  font-weight: 400;
  background: var(--theme-soft);
  color: var(--theme-text);
  line-height: 1.4;
}
```

Used for static labels — category chips on item cards ("Warehouse /
Industrial"), brand overlays on project cards ("Nike"), persona labels.
Not interactive.

### `.bp-count-badge`

```css
.bp-count-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--theme-accent);
  color: var(--bp-text-on-gradient);
  font-family: var(--bp-font);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}
.bp-count-badge--overlay {
  /* Position at top-right of parent (e.g. card image, tile, icon) */
  position: absolute;
  top: -4px;
  right: -4px;
}
```

Two contexts: **inline** (next to a label, e.g. "Inbox 3") or **overlay**
(top-right of a parent, e.g. unread on a tile).

### `.bp-unread-dot`

```css
.bp-unread-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--theme-accent);
  flex-shrink: 0;
}
```

Minimal — binary signal that something is new / unread. Pairs with a row
that's otherwise visually neutral.

### `.bp-capsule` (micro-meta)

```css
.bp-capsule {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  font-family: var(--bp-font);
  font-size: 11px;
  font-weight: 400;
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-hairline);
  line-height: 1.4;
}
```

For tiny meta — timestamps ("3 days ago"), distance ("2.4 mi"), "From £X"
prefix, etc. Quieter than a tag chip; no themed background.

## Visual rhythm — what stays consistent across all pills

| Token | Default |
|---|---|
| Radius | `var(--radius-pill)` (universal) |
| Padding (small) | `2px 8px` (status, badge, capsule) |
| Padding (medium) | `2px 10px` (tag chip) |
| Font | `var(--bp-font)` always |
| Font size | 10–13px depending on archetype |
| Line-height | 1 (status pill) or 1.4 (tag, capsule) |
| Border | None (status, tag, badge, dot); hairline (capsule) |

**Inline gap convention** — when multiple pills sit in a row, use `gap:
6px` on the parent flex container.

## Where each surface uses pills today

| Surface | Pills used |
|---|---|
| Item card (future restyle per CARDS.md) | `.bp-tag-chip` (category subtitle) |
| Project card (future per CARDS.md) | `.bp-status-pill` (Draft / Active), `.bp-tag-chip` overlay (brand), `.bp-capsule` (relative time) |
| Supplier card | (none currently — meta lives as plain text) |
| Launcher tile | `.bp-count-badge--overlay` (top-right unread on Inbox tile, future) |
| Right rail item-preview | (no pills currently — future: `.bp-tag-chip` for category match) |
| `/settings/team` | `.bp-status-pill` (Active / Invited / Suspended — when membership_status codelist lands) |
| `/marketplace` filter chips | `.bp-chip` (interactive, see BUTTONS.md) |

## Risk patterns

- **RP-04 (open)** — hardcoded inline option arrays where a codelist would extend better. Status pills MUST consume `codelists.getMeta()` rather than inline colour arrays. Sweep when CODELISTS-02 ships.
- **RP-09 candidate** — pill colour hardcoded instead of codelist-driven. The temptation: `<span class="bp-status-pill" style="background: #d1fae5; color: #047857">Active</span>`. Failure mode: same pill in two places has two different greens because each component picked its own hex. Fix: never set `bp-status-pill` color inline; ALWAYS bind from `meta()`. Lint guard candidate.

## When to update this doc

- New pill archetype emerges → add row to The archetypes
- New codelist consumes the status pill primitive → update Where each surface uses pills
- Visual rhythm changes (padding, font size) → update Visual rhythm
- New risk pattern surfaces → log under Risk patterns

## Pairs with

- `docs/CODELISTS.md` — status pill is downstream of `meta.color` / `meta.icon` / `meta.is_terminal` data
- `docs/BUTTONS.md` — interactive chip toggle (`.bp-chip`) lives there, not here
- `docs/CARDS.md` — tag chips overlay on card images; count badges sit on tile corners
- `docs/DESIGN.md` §5 — 11px UPPERCASE is the documented typography exception that status pills rely on
- `docs/DIALOGS.md` (next) — confirmation dialogs frequently show a status pill at the top to anchor what's being acted on
