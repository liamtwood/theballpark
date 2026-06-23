# pV2-TYPE-01 — Typography standard: one family, one type scale, enforced

> **Ready** — Liam approved 2026-06-11. Five review rulings locked: eyebrow
> `--theme-text` (themable) is intentional; line-height assignments accepted
> with eyebrow-may-look-loose flagged for ship-report nit; `clamp()` greeting
> accepted; Tailwind text utilities mapped (not banned) — arbitrary
> `text-[Npx]` values still fail the guard; PrimeNG `var(--bp-font)` vs
> `--p-*` fallback path accepted, report which mechanism shipped.

## Why this prompt exists

v2 currently renders THREE font families at once:

1. `--bp-font` — the DB-driven family (`bp_brand_config.font_pair` →
   BrandConfigService → `:root` at bootstrap). Only body default, wordmark,
   avatar initials consume it. Currently the system-sans stack.
2. `--font-display` (Playfair) / `--font-body` (Libre Franklin) — added in
   pV2-04b per DESIGN.md §5, statically loaded from Google Fonts. Home title
   is Playfair; subtitles, tiles, edit-field labels are Libre Franklin.
3. PrimeNG's own font token — `BallparkPreset` never bridges `fontFamily`,
   so p-select values, p-button labels and drawer chrome use Aura's stack.

Visible symptoms (Liam's QC): the drawer mixes three families across
header / field labels / select values; home mixes Playfair (title) with
Libre Franklin (subtitle, tiles).

Decision: **one font family for every text node, selected by an admin via
the existing `bp_brand_config.font_pair` row.** Text differentiation comes
from a defined type SCALE (size / weight / case / color / line-height),
never from family. v1's family-token idea was right but incomplete (no size
scale, scattered literals, its own launcher hardcoding a different sans) —
this prompt is the finished version of that idea.

## Read first

1. `docs/CLAUDE.md`
2. `docs/DESIGN.md` §2 (brand tokens) + §5 (typography — this prompt REWRITES §5)
3. `docs/ENGINEERING.md` (Rule 2 enforcement precedent — the raw-color guard
   this prompt extends; Rule 9 precedence)
4. `client-v2/src/app/core/brand-config.service.ts` (the DB → token bridge)
5. `client-v2/src/app/app.config.ts` (BallparkPreset — where the PrimeNG
   fontFamily bridge lands)
6. This prompt

## Architecture — two layers

**Layer 1 — primitive tokens** (styles.css `:root`; the ONE definition of
every typographic value; nothing outside styles.css/the preset may declare
`font-family` or `font-size`):

```css
/* Family — DB-driven. The role aliases exist so a future return to a
   two-family pairing is a one-line flip, not a refactor. */
--bp-font: <from bp_brand_config.font_pair>;   /* set by BrandConfigService */
--font-display: var(--bp-font);
--font-body: var(--bp-font);

/* Size scale */
--text-2xs: 11px;
--text-sm: 12px;
--text-base: 13px;
--text-md: 14px;
--text-xl: 18px;
--text-2xl: 22px;
--text-hero: 36px;
--text-greeting: clamp(40px, 5vw, 60px);   /* responsive in the token, not per-consumer media queries */

/* Tracking (uppercase treatments) */
--tracking-wide: 0.05em;

/* Line heights */
--leading-tight: 1.15;   /* greeting / hero / titles */
--leading-snug: 1.3;     /* card + drawer titles */
--leading-normal: 1.45;  /* body, labels, help */
```

(Playfair/Libre Franklin Google-Fonts `<link>` in index.html is REMOVED —
the static pair is superseded. Runtime loading of an admin-picked webfont is
pV2-TYPE-02.)

**Layer 2 — the named class table** (styles.css, one block, each class a
one-line composition of Layer-1 tokens). Surface-keyed names: each surface
gets its own knob and can diverge later without refactors. Where two classes
coincide today (e.g. card-title ≡ drawer-title), that's deliberate
convergence of compositions, not duplication — the values live once, in
Layer 1.

| Layer | Class | Size | Weight | Case/Tracking | Line-height | Color | Where |
|---|---|---|---|---|---|---|---|
| Hero — home | `.bp-home-title` | `--text-greeting` | 400 | — | `--leading-tight` | `--color-text` | Home greeting only |
| | `.bp-home-subtitle` | `--text-xl` | 400 | — | `--leading-normal` | `--color-text-secondary` | Home greeting sub |
| Hero — page | `.bp-page-label` | `--text-2xs` | 600 | UPPER + `--tracking-wide` | `--leading-normal` | `--theme-text` ¹ | Eyebrow above page title |
| | `.bp-page-title` | `--text-hero` | 400 | — | `--leading-tight` | `--color-text` | Every non-home page |
| | `.bp-page-subtitle` | `--text-base` | 400 | — | `--leading-normal` | `--color-text-secondary` | Page sub |
| Section | `.bp-section-title` | `--text-xl` | 500 | — | `--leading-snug` | `--color-text` | Section heading in page/card |
| | `.bp-section-subtitle` | `--text-base` | 400 | — | `--leading-normal` | `--color-text-secondary` | Section sub |
| Card / tile | `.bp-card-title` | `--text-2xl` | 400 | — | `--leading-snug` | `--color-text` | Tile / card title |
| | `.bp-card-subtitle` | `--text-base` | 400 | — | `--leading-normal` | `--color-text-secondary` | Tile / card sub |
| Drawer | `.bp-drawer-label` | `--text-2xs` | 600 | UPPER + `--tracking-wide` | `--leading-normal` | `--theme-text` ¹ | Drawer eyebrow |
| | `.bp-drawer-title` | `--text-2xl` | 400 | — | `--leading-snug` | `--color-text` | Drawer header title |
| | `.bp-drawer-section-title` | `--text-md` | 500 | — | `--leading-snug` | `--color-text` | Section heading inside drawer |
| | `.bp-drawer-section-subtitle` | `--text-sm` | 400 | — | `--leading-normal` | `--color-text-secondary` | Section sub inside drawer |
| Field | `.bp-field-label` | `--text-sm` | 500 | — | `--leading-normal` | `--color-text-secondary` | Form field label |
| | `.bp-field-value` | `--text-base` | 400 | — | `--leading-normal` | `--color-text` | View-mode field value |
| | `.bp-field-help` | `--text-sm` | 400 | — | `--leading-normal` | `--color-text-muted` | Helper text below field |
| Body | `.bp-body` | `--text-md` | 400 | — | `--leading-normal` | `--color-text` | Paragraph |
| | `.bp-body-small` | `--text-base` | 400 | — | `--leading-normal` | `--color-text` | Small paragraph |
| | `.bp-caption` | `--text-sm` | 400 | — | `--leading-normal` | `--color-text-muted` | Caption / micro-meta |
| Inline | `.bp-status-pill` | `--text-2xs` | 600 | UPPER + `--tracking-wide` | 1 | per state (semantic tokens) | Status badge |
| | `.bp-meta` | `--text-2xs` | 400 | — | `--leading-normal` | `--color-text-muted` | Timestamps, IDs |
| Column | `.bp-table-column-header` | `--text-sm` | 600 | — | `--leading-normal` | `--color-text-secondary` | Table column header |

**Every class sets `font-family: var(--bp-font)`. Family never varies —
size, weight, case, color and line-height do.**

¹ Eyebrows (`.bp-page-label`, `.bp-drawer-label`) deliberately use the
THEMABLE `--theme-text` while titles use the fixed-neutral `--color-text`:
eyebrows re-colour with persona presets, titles don't. **Locked decision
(Liam, 2026-06-11)** — v1 behaviour deliberately ported. Do not "fix" it.

## What changes

### 1. styles.css
- Layer-1 tokens added; `--font-display`/`--font-body` re-pointed at
  `var(--bp-font)` (declarations referencing them keep working and collapse
  to one family).
- Layer-2 class block added (grouped, commented per the table).
- `html, body` keeps `font-family: var(--bp-font)` as the inherit baseline.

### 2. index.html
- Playfair/Libre Franklin Google-Fonts link removed.

### 3. PrimeNG bridge (app.config.ts)
- `BallparkPreset` sets the Aura `fontFamily` token from the same family so
  p-select / p-button / p-drawer text joins. PrimeNG's INTERNAL size scale
  stays PrimeNG's — we bridge family only, we don't fight per-control sizes.
- Note: PrimeNG reads the preset at bootstrap; BrandConfigService applies
  the DB font onto `--bp-font` at bootstrap too. The preset value must
  resolve the CSS var (set `fontFamily: 'var(--bp-font)'`) so a DB change
  reaches PrimeNG without preset rebuild — verify this resolves inside
  PrimeNG's generated CSS; if Aura inlines the literal instead, fall back to
  a `--p-*` font override documented as the ONE sanctioned post-bootstrap
  touch, with a comment.

### 4. Component migration (consume Layer 2, delete local typography)
Shared components bake their classes in — consumers never hand-type chrome
classes for surfaces a shared component owns:

| Component | Classes it applies internally |
|---|---|
| `home-launcher` | `.bp-home-title`, `.bp-home-subtitle` (deletes its local font-size/family rules) |
| `launcher-tile` | `.bp-card-title`, `.bp-card-subtitle` |
| `page-hero` | `.bp-page-label` (when back/eyebrow present), `.bp-page-title`, `.bp-page-subtitle` |
| `page-settings-drawer` | `.bp-drawer-label`, `.bp-drawer-title` |
| `edit-field` | `.bp-field-label`, `.bp-field-value` (its 34px field METRICS stay — this prompt owns type, not field chrome) |
| `coming-soon`, `landing`, `login`, `onboarding`, `team`, `user-menu`, `version-chip` | replace ad-hoc `text-…` size utilities on TITLES/labels with table classes where a row exists; leave purely layout-ish text utilities alone where no role fits, flag stragglers in the ship report |

Sweep-completeness rule applies: enumerate every component touched /
verified-unchanged / skipped-with-reason in the ship report.

### 5. The guard (what makes it law)
Extend `scripts/check-raw-colors.js` → rename to `scripts/check-style-guards.js`
(update the `npm run lint` chain): in addition to raw colors, FAIL on
`font-family:` or `font-size:` declarations in `src/app/**` component files.
Legal declaration sites: `src/styles.css` and the preset in `app.config.ts`
(exempt list). Tailwind arbitrary text sizes (`text-[13px]`) also fail;
table classes or the standard Tailwind size utilities mapped to tokens
replace them. *(If mapping Tailwind's `text-sm/base/…` scale to the Layer-1
tokens in `tailwind.config.js` `fontSize` is cleaner than banning them,
CC's call — flag the choice.)*

### 6. docs/DESIGN.md §5 rewrite
Replace the v1-era typography section with: the two-layer architecture, the
full class table above, the eyebrow `--theme-text` note, the two legal
declaration sites, and "family never varies" as the headline rule.

## Acceptance

1. Computed `font-family` is IDENTICAL on every visible text node across
   `/home`, the page-settings drawer (header + labels + select values),
   `/login`, `/settings/team`, a Coming-soon stub — one DevTools sweep,
   recorded in the ship report.
2. Changing `bp_brand_config.font_pair` in the DB + reload changes every
   text node including PrimeNG controls (verify with a obviously-different
   stack, e.g. monospace, then restore).
3. `--font-display` / `--font-body` resolve to `var(--bp-font)`; the Google
   Fonts link is gone; no Playfair/Libre Franklin renders anywhere.
4. All table classes exist in styles.css and resolve per the table (spot-
   check size/weight/color computed values for at least one class per layer).
5. home-launcher title/subtitle, launcher-tile title/subtitle, page-hero,
   drawer header, edit-field label/value consume table classes; their local
   font-family/font-size declarations are deleted.
6. The style guard fails the build on a planted `font-family:` in a
   component (drill: plant → fail → revert, recorded), and `npm run lint`
   is green on the real tree.
7. Zero raw color regressions (existing guard still green); 0 `any`; build
   + tests green.
8. v1 on 4200 unchanged.
9. Ship report includes the sweep-completeness enumeration + "Concerns not
   in spec".

## Out of scope

- Admin font-picker UI + runtime webfont loading (`pV2-TYPE-02` — DB value
  is the control surface for now)
- Per-persona font overrides
- PrimeNG per-control size tuning
- v1 (`client-angular/`) — untouched, retires at pV2-11
- Drawer section chrome (`.bp-drawer-section-*` classes are DEFINED now but
  first consumed when drawer sections land in pV2-04c)

## Concerns not in spec (CC: fill in ship report; known watch-items)

- Whether `fontFamily: 'var(--bp-font)'` survives Aura's preset processing
  (see §3 note) — report which mechanism shipped
- Any text node that fit NO table row (candidate for a new row, not an
  ad-hoc style)
- Tailwind text-size utilities: banned vs token-mapped — report the choice
  and why

## Bump + ship

1. Chip `[Dev v2] v2.10a`
2. Suggested commits:
   - `feat(v2.10a-pt1): type tokens + class table + PrimeNG fontFamily bridge`
   - `feat(v2.10a-pt2): migrate components onto the type classes; drop local typography`
   - `feat(v2.10a-pt3): style guard covers font-family/size; docs/DESIGN.md §5 rewrite`
3. Ship report `prompts/pV2-TYPE-01-typography-standard-shipped.md`
4. Flip backlog to `Shipped`; await audit pass for Done

## Reply with

- Commit SHAs
- 9/9 acceptance verified (incl. the DB font-change drill + the guard drill)
- The font-family DevTools sweep result
- Sweep-completeness enumeration
- Concerns not in spec
