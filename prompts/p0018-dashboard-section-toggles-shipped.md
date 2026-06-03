# Shipped — p0018 — Dashboard SECTIONS checkbox toggles

**Version:** v1.65hO
**Shipped:** see commit log
**Prompt:** `p0018-dashboard-section-toggles-prompt.md`

## What changed
- Five new flags on the `PlatformConfig` model + `ConfigService` (all default `true`):
  `showQuickActions`, `showActiveProjects`, `showCredits`, `showSavedSuppliers`, `showRecentActivity`.
- Drawer SECTIONS pill row replaced with a vertical `p-checkbox` list, now split into
  four top-level groups: **GENERAL / APPEARANCE / HERO / SECTIONS**.
- Each dashboard body section is wrapped in `*ngIf` against its flag; columns collapse
  cleanly (no empty grid track) when all their sections are hidden.

## Config (`config.model.ts`, `config.service.ts`)
- `PlatformConfig` gains the five optional booleans.
- `ConfigService` default config seeds all five `true`; five `!== false` getters added.
- No change needed to `update()` (spreads `Partial<PlatformConfig>`) or `load()`
  (spreads parsed over defaults) — existing localStorage configs missing the new keys
  read as `true` automatically. Migration is free.

## Drawer (`page-config-drawer.component.ts`)
- `CheckboxModule` added to imports.
- New **HERO** group: `User name` / `Location` (gate the AppShell hero meta chips,
  which already read `showUserName` / `showLocation`).
- **SECTIONS** group (7 rows, prompt order): Upcoming / Stats / Quick Actions /
  Active `{{ projectLabel }}`s / `{{ creditLabel }}`s card / Saved Suppliers /
  Recent Activity. Section labels interpolate the live config label tokens.
- Each row is a 32px `<label>` wrapping a binary `p-checkbox` + text, so the whole
  row is clickable. Accent fill on check comes from the global
  `--primary-color → --theme-accent` mapping in `styles.css` — no per-component
  checkbox override.
- Save-on-change via `(ngModelChange)="saveToggles()"`; no Save/Cancel.
- Deleted: `componentOptions` array, `isComponentActive()`, `toggleComponent()`,
  the `.bp-pcd-multi-wrap` + `.bp-cfg-seg--multi` + `.bp-pcd-help` styles.
- `saveToggles()` expanded to persist all 9 hero-meta + section flags.
- Draft mirror now defaults every section flag visible via `!== false`
  (was `showUpcoming === true`).

## Dashboard (`dashboard.component.ts`)
- `pageCfg` read-only mirror extended with the five new flags + populated `!== false`.
- New getters: `hasLeftColumn` (Upcoming ∨ Recent Activity ∨ Quick Actions),
  `hasRightColumn` (Credits ∨ Saved Suppliers), `bodyGridColumns` (builds
  `grid-template-columns` from only the present columns).
- `*ngIf` wraps: Upcoming card, Recent Activity card, Quick Actions card (left col);
  the whole events column on `showActiveProjects` (centre — Inactive/Past ride along);
  Credits card, Saved Suppliers card (right col). Stats bar was already gated.
- Left / centre / right column `<div>`s gate on `hasLeftColumn` /
  `showActiveProjects` / `hasRightColumn`.
- `.bp-body` binds `[style.grid-template-columns]="bodyGridColumns"` so a hidden
  column drops its track; `justify-content:center` balances the fixed 320px side
  columns when the greedy centre `1fr` is gone.
- Mobile tab panels left unchanged (out of scope — desktop body only).

## Diff
Code net (excl. prompt + this report): **+217 / -88**. Dominated by the drawer
(+191/-… — explicit 9-row checkbox template replacing the single pill loop) and the
dashboard (+85 — column-collapse getters + `*ngIf` wraps). Total commit incl. docs:
**+399 / -88** across 8 files.

## Verify (per prompt spec)
Build-verified (`ng build` clean). Visual QC items for Liam:
- ☐ Cog drawer on dashboard shows four groups: GENERAL / APPEARANCE / HERO / SECTIONS.
- ☐ All 9 checkboxes default ticked.
- ☐ Untick Quick Actions → panel gone from left col; reload → still hidden (persists).
- ☐ Untick Upcoming + Recent Activity + Quick Actions → left column collapses; centre + right fill.
- ☐ Untick Active Events → centre column empty; sides re-centre.
- ☐ Untick Credits + Saved Suppliers → right column collapses.
- ☐ Untick Stats → top stats bar gone.
- ☐ HERO User name / Location still gate the hero chips.
- ☐ Set creditLabel "Token" → SECTIONS row reads "Tokens card" live; projectLabel "Show" → "Active Shows".
- ☐ Re-tick everything → full default layout returns.
- ☐ Theme switch in APPEARANCE still works with the drawer open.

p0018 flipped to `Done` in `prompts/backlog.md`. Hard-refresh — chip reads `[Dev] v1.65hO`.
