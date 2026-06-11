# pV2-TYPE-01 — Typography standard · SHIPPED

**Version:** v2.10a
**Prompt:** `pV2-TYPE-01-typography-standard-prompt.md`
**Status:** Shipped (awaiting chat audit pass before Done)

## Commits

| SHA | What |
|---|---|
| `b1c8083` | pt1 — Layer-1 tokens (scale + tracking + leading + `--font-mono`; aliases collapsed onto `--bp-font`), Layer-2 21-class table + `.bp-wordmark` in styles.css, Tailwind `fontSize` token-mapped, Google-Fonts link removed |
| `e57d9c6` | pt2 — every component migrated onto the classes; Tailwind utilities bulk-renamed size-preserving across 10 files; wordmark/version-chip onto legal tokens |
| (pt3) | guard renamed `check-style-guards.js` + font rules; root mobile `--text-hero` override; `--text-xs`/`--text-lg` absorbed from Liam's interim §5; DESIGN.md §5 rewritten; chip v2.10a |

## Acceptance — 9/9

1. ✓ **Font sweep:** TreeWalker over every visible text node on `/home` + open drawer → **exactly ONE computed font-family** (`--bp-font`). Dev version-chip's `--font-mono` is the sanctioned non-brand exception.
2. ✓ **DB drill:** `font_pair` → monospace + reload flipped home title, tile titles, drawer title, field labels **and the PrimeNG select value** in one go; restored after.
3. ✓ Aliases resolve to `var(--bp-font)`; Google-Fonts link gone; no Playfair/Libre Franklin anywhere.
4. ✓ All 21 table classes + `.bp-wordmark` live; spot-checked greeting (60px desktop via clamp), card-title 22/400, drawer-label `--theme-text` (#1f2937).
5. ✓ home-launcher / launcher-tile / page-hero / drawer header / edit-field consume table classes; local font declarations deleted (structural classes keep spacing only).
6. ✓ **Guard drill:** planted `font-size: 13px` → lint fails with `[literal font-size]`; reverted; clean tree green. (First run also caught a real regex backtracking bug — see concerns.)
7. ✓ Raw-color guard still green; build + 51 specs green.
8. ✓ v1 on 4200: 200, untouched.
9. ✓ This report.

## Sweep-completeness enumeration

**Changed:** styles.css, index.html, tailwind.config.js, app.config.ts (none — no preset change needed, see below), home-launcher, launcher-tile, page-hero, page-settings-drawer, edit-field, wordmark, version-chip, + bulk utility renames in landing, login, onboarding, team, team-member-row, coming-soon, hero-demo, public-header, user-menu, page-settings-drawer.
**Verified unchanged:** user-avatar (token-ref font-family + sanctioned dynamic size binding), auth-callback (no type declarations), guards/services (no UI).
**Explicitly skipped:** v1 `client-angular/` (retires pV2-11); PrimeNG internal sizes (family-only convergence by design).

## Locked-rulings status

- Eyebrow `--theme-text`: shipped as locked, documented in styles.css + DESIGN §5.
- Tailwind mapped-not-banned: shipped (`text-xs…text-greeting` → tokens); arbitrary `text-[Npx]` fails the guard.
- clamp() greeting: shipped; the 32px mobile media override in home-launcher deleted as redundant.
- PrimeNG mechanism (the ruling asked which shipped): **NEITHER** — empirically, PrimeNG 21 Aura sets no font-family (`--p-font-family` unset; the drawer select had been inheriting Libre Franklin from `.bp-fld`). Convergence is pure inheritance. No preset change, no `--p-*` override.
- Line-heights: shipped per table; eyebrow looseness flagged below.

## Concerns not in spec

### Spec-hygiene precedence deviations
None — but one guard-rule refinement: the spec says components may not
"declare font-size"; the shipped guard bans **literal** sizes and allows
`font-size: var(--text-*)` refs (back links, the `.bp-fld` input metric).
Strict-literal banning would force a table row for every interactive
fragment; token refs preserve the one-definition guarantee. Flagging as the
intended reading.

### Findings

1. **DESIGN.md §5 had been interim-edited Liam-side** with a role→token table
   diverging from the locked prompt (60px non-clamp greeting, `--text-xs` 10
   / `--text-lg` 16, root mobile overrides, "font_family DB column"). Kept
   the locked class table, **absorbed the compatible additions** (xs/lg
   tokens, root-level `--text-hero: 28px` mobile override — page-hero's local
   media rule deleted in its favour), corrected the DB reference to the real
   mechanism (`bp_brand_config` key/value, key `font_pair`).
2. **Guard regex bug caught by its own drill:** the first font-family rule
   used a negative lookahead after `\s*`, which backtracks and false-flags
   legitimate `var(--bp-font)` refs. Rewritten as capture-then-check. The
   drill exists for exactly this.
3. **Visual deltas to QC** (all standard-driven, deliberate): page titles
   28px/700 → 36/400 (the title2 standard — Team page is the visible case);
   edit-field labels muted → secondary; tile titles inherit `--bp-font`
   (were Libre Franklin); home greeting 44px → clamp (60px desktop).
4. **`.bp-status-pill` / `.bp-meta` / `.bp-table-column-header` / section +
   drawer-section classes are defined but unconsumed** — first consumers are
   pV2-04c (drawer sections, page density) and the future table surfaces.
   Defined now so those prompts are born on the standard.
5. **`--text-xs` (10px) has no current consumer** — absorbed from the interim
   §5 for the capsule-caption role it names. Watch it doesn't become a
   dumping ground for "slightly smaller please".
6. **pV2-TYPE-02 dependency:** with the static font link gone, any DB
   `font_pair` value naming a non-system webfont won't load until TYPE-02's
   runtime loader exists. Current value is the system stack, so nothing is
   broken today — but the admin picker MUST ship with the loader.
