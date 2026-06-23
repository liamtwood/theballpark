# pV2-04d — Profile rebuild: the v2 edit-form standard (v1 foot buttons, locked §10)

> Number provisional — chat-driven arc (Liam's QC screenshots → chat's locked
> proposal, no prompt file). Renumber if chat assigns one. Backfilled the day
> of ship when the shipped-file contract was locked.

**Shipped:** 2026-06-11, chip `[Dev v2] v2.11c`
**Commits:** `60c88f9` feat(v2.11c): edit-form standard — v1 foot buttons + .bp-edit-section-title + §8 button chrome

## What landed
- `<app-edit-section>` rewritten to the v1 standard: hover-pencil + tick/cross
  replaced by a bottom-left foot row — view: "Edit" `.bp-btn-outline` pill
  (square-pen 16); editing: "Cancel" outline + "Save changes" `.bp-btn-grad`
  (check 16, both disabled while saving). `editLabel`/`saveLabel` inputs added.
  Snapshot/restore/persist lifecycle unchanged — Profile consumed the new
  chrome with zero changes.
- `.bp-btn-outline` + `.bp-btn-grad` in styles.css, verbatim from the DESIGN.md
  §8 locked spec (glow via `--bp-gradient-shadow-rgb`, hover lift, focus rings,
  `.bp-card--drawer` density variant). First real consumer of the brand
  gradient CTA.
- New tokens: `--radius-pill: 999px`, `--bp-gradient-shadow-rgb: 214, 51, 132`,
  `--text-3xl: 28px`; new type class `.bp-edit-section-title` (3xl/400/tight);
  `3xl` added to the Tailwind token-mapped fontSize scale.
- DESIGN.md: §5 token list + table row; §8 usage now includes edit-form Save
  changes, tokens marked shipped; §10 single-record section replaced with the
  locked edit-form card standard (Profile is the reference; hover-pencil
  retired).

## Files touched
| File | Lines (Δ) | SHA | Notes |
|---|---|---|---|
| client-v2/src/app/shared/edit-section/edit-section.component.ts | +33 / −72 | 60c88f9 | template + button-row rewrite; local icon-button CSS deleted |
| client-v2/src/styles.css | +84 / −0 | 60c88f9 | §8 button chrome, 3 tokens, `.bp-edit-section-title` |
| client-v2/tailwind.config.js | +1 / −0 | 60c88f9 | `3xl` in fontSize map |
| docs/DESIGN.md | +37 / −19 | 60c88f9 | §5 / §8 / §10 updates |
| client-v2/src/environments/environment.ts | +1 / −1 | 60c88f9 | chip v2.11c |

## Acceptance — 8 / 8 verified
- Profile matches the v1 screenshots (size, weight, button chrome, layout);
  family through `--bp-font` — ✓ computed-style audit on 4201: gradient
  `135deg #d63384→#16a34a`, white text, 999px pills, 12×24 padding, 14px,
  §8 shadow stack; title 28px/400/tight
- `.bp-edit-section-title` in styles.css + role table — ✓ (as `--text-3xl`
  token, see Concerns)
- `.bp-btn-grad` + `.bp-btn-outline` in styles.css per §8 — ✓ verbatim
- `--radius-pill` token — ✓
- `<app-edit-section>` renders both states; lifecycle unchanged — ✓ clicked
  through Edit → 6 editable fields → Cancel → view restored
- Style guard + build green — ✓ (also lint clean, 57/57 vitest)
- DESIGN.md §5 + §8 + §10 reflect what shipped — ✓
- v1 on 4200 untouched — ✓ no v1 files in any diff

## Concerns not in spec
### Spec deviations (both flagged to Liam in-chat at ship time)
- Chip: spec said `v2.10e` (stale — drafted before v2.11a/b shipped); landed
  as v2.11c.
- "Size 28px" implemented as Layer-1 token `--text-3xl` composed by the class,
  not a literal — the TYPE-01 grammar has every table class riding tokens.
- `.bp-btn-outline` colors map to tokens (`--color-surface` /
  `--color-border-hairline` / `--shadow-xs`), not v1's `#fff`/`#E5E7EB`
  literals — token law; visually identical.

### `.bp-field-value` (13px) unconsumed by edit-field
**Where:** client-v2/src/styles.css (type table) vs edit-field's `.bp-fld` (14px)
**What:** `<app-edit-field>` values render via structural `.bp-fld` at
`--text-md` (zero-shift requirement); the table's `.bp-field-value` (base/13)
has no consumer on Profile. Divergence reported to Liam — awaiting his
converge call (either `.bp-fld` → 13 or table row → 14).
**Severity:** LOW

## QC notes
**2026-06-11 (Liam, via CC chat — recorded verbatim):** "qc hero looks
great, back is great, profile page qc accepted, we have our standard page
hero, and standard page editable section. let this be the standard going
forward."
QC ACCEPTED through iteration v2.11h. Locked as the v2 page standard —
DESIGN.md §7 (page composition) + §10 (edit-form card) carry the lock;
Profile is the living reference.

## Chat audit
**Audit pass: 2026-06-11, chat** — verified across v2.11c-g (5 chips, 8 commits).

### Verified ✓

- **Tokens landed correctly in `client-v2/src/styles.css`:**
  - `--color-text-strong: #374151` (line 30) — new middle shade
  - `--radius-pill: 999px` (line 95) — net new
  - `--bp-gradient-shadow-rgb: 214, 51, 132` (line 99) — net new, used in `.bp-btn-grad` glow
  - `--text-3xl` retired cleanly from styles.css + Tailwind map; only orphan ref was DESIGN.md §10 (fixed in this audit, see below)
- **Role classes match the locked spec:**
  - `.bp-page-subtitle` — `--text-xl` (18) / 400 / normal / `--color-text-secondary` ✓
  - `.bp-edit-section-title` — `--text-2xl` (22) / 400 / snug / `--color-text-strong` ✓
  - `.bp-field-value` — `--text-md` (14) / 400 / normal / `--color-text-strong` ✓
  - `.bp-page-title` rides `--text-hero` token bumped to 40px
- **`.bp-btn-outline` + `.bp-btn-grad` per §8 spec** — shared chrome block, glow via `rgba(var(--bp-gradient-shadow-rgb), 0.2)` at rest + 0.28 on hover, `:focus-visible` outline at full opacity, `.bp-card--drawer` density variant present
- **Edit-form lifecycle** — `<app-edit-section>` foot row with Edit / Cancel / Save changes, hover-pencil retired; Profile consumes with zero local changes
- **5-rank size + 3-shade color ramp** — CC's computed-style verification on :4201 confirms the table maps end-to-end
- **DESIGN.md §4 ramp updated** with `--color-text-strong` between secondary + primary text
- **DESIGN.md §5 token list + table** — `--text-3xl` removed, `.bp-edit-section-title` reflects 2xl/snug/strong, `.bp-page-subtitle` reflects xl, `.bp-field-value` reflects md/strong
- **DESIGN.md §8 buttons** — chrome verbatim from the locked spec
- **DESIGN.md §10 edit-form card standard** — Profile cited as reference, lifecycle + chrome documented

### Fixed in this audit

- **DESIGN.md §10 line 549** was stale — said `.bp-edit-section-title (3xl/400/tight)` (pre-v2.11g spec). Updated to `2xl/400/snug/strong`. One-line edit. Chip not bumped; cosmetic doc fix.

### Concerns / flags

- **`tailwind.config.js` line 52 comment** mentions `text-3xl/4xl…` as "don't map" sizes — this comment is technically still correct (3xl/4xl are no longer mapped because 3xl was retired) but reads ambiguously. Not blocking; consider rewording on the next Tailwind config touch.
- **Hero subtitle at 18 vs Home greeting subtitle at 18** — same size, but the home greeting subtitle is part of a different surface rhythm (60→18 vs 40→18). CC flagged convergence in the v2.11d iteration note; not a defect, just an observation worth keeping an eye on as more page heroes land.
- **`.bp-field-value` class has no current consumer** — edit-field renders values via the structural `.bp-fld` class which pulls from `--text-md` + `--color-text-strong` independently. Both resolve to the same metrics, so no visual divergence. Worth keeping the `.bp-field-value` class around for read-only display contexts (audit logs, public profile views) where edit-field's chrome isn't appropriate.

### Files re-audited in ledger after this ship

- `client-v2/src/styles.css` — refreshed entry to v2.11g state
- `client-v2/src/app/shared/edit-section/edit-section.component.ts` — was unaudited, now ✓ clean post-rewrite
- `client-v2/src/app/shared/edit-field/edit-field.component.ts` — was at warning (208 lines); v2.11g touch added 3-line value-color pin → check if still in warning band
- `client-v2/src/app/pages/settings/profile/profile.component.ts` — was ○ unaudited / canEdit-blocked; the canEdit gate is still ballpark_admin-blocked pending the in-flight matrix change, but typography + structure now match the locked v2 edit-form standard
- `client-v2/src/app/shell/page-hero/page-hero.component.ts` — separator removed in v2.11d; refresh ledger
- `client-v2/src/app/shell/app-shell.component.ts` — sticky/opaque header in v2.11d; refresh ledger
- `docs/DESIGN.md` — §4, §5, §8, §10 all touched

### Verdict

**Done.** Backlog row flips Shipped → Done. The edit-form pattern is now the
locked v2 standard — Profile is the canonical reference; every future edit
surface inherits via `<app-edit-section>` + `<app-edit-field>` without
touching typography or chrome. The shipped-file contract (this file) worked
exactly as designed — audit took 15 minutes vs ~hour previously.

## Iteration — v2.11d (2026-06-11)
**Triggered by QC:** "increase the size of the font for Title and Subtitle of
the page hero and remove the separator, also this scrolls into the header —
the header should always be on top."
**Commit:** `ab95da4`
**Files:** styles.css (`--text-hero` 36→40, `.bp-page-subtitle` base→lg 16);
page-hero.component.ts (border-bottom separator removed);
app-shell.component.ts (header `bg-transparent` → `bg-bg` — fixed z-40 header
now occludes scrolling content); DESIGN.md §5 table + token list; chip.
Note: landing h1 rides the same `--text-hero` token (now 40px). Hero subtitle
(16) sits below home subtitle (18) — flagged for possible convergence.

## Iteration — v2.11e (2026-06-11)
**Triggered by QC:** Profile card "Organisation" retitled "Company Information".
**Commit:** `31fd74e`
**Files:** profile.component.ts (title input string); chip.

## Iteration — v2.11f (2026-06-11)
**Triggered by QC:** Liam's converge call on the flagged `.bp-field-value`
divergence — option (b): promote the table row to `--text-md` (14px),
matching `.bp-fld`'s chrome.
**Commit:** `8ad9035`
**Files:** styles.css (`.bp-field-value` base→md); DESIGN.md §5 table row
(+ convergence note); chip. Class has no consumers yet — doc/table truth fix;
verified 14px computed via injected element on 4201.

## Iteration — v2.11g (2026-06-11)
**Triggered by QC:** Liam's 5-rank / 3-shade hierarchy for the edit-form
pattern ("we will use the same pattern everywhere"), with CC's accepted
pushback flipping sub/section sizes: hero title 40 > section 22 > sub 18 >
value 14 > label 12.
**Commit:** `9ff2a02`
**Files:** styles.css (new --color-text-strong #374151 middle shade;
.bp-page-subtitle lg→xl; .bp-edit-section-title 3xl→2xl/snug/strong;
.bp-field-value→strong; --text-3xl retired); edit-field.component.ts
(3 value-color pins →strong incl. PrimeNG select/inputnumber);
tailwind.config.js (3xl removed, text-strong added); DESIGN.md §4 neutrals
ramp + §5 token list + table; chip.
Verified computed on 4201: 40/#111 · 18/#6b7280 · 22/#374151 · 12/#6b7280 ·
14/#374151. Container headings (card ≡ drawer ≡ edit-section) now converge
on the 2xl rank, differentiated by shade only.

## Iteration — v2.11h (2026-06-11)
**Triggered by QC:** back button missing from the hero; must sit ABOVE the
title (Liam's mockup: ← arrow + "Back").
**Commit:** `4a029c5`
**Files:** page-hero.component.ts (grid back row above text, both
breakpoints; chevron-left→arrow-left); styles.css (new §5 class
.bp-page-back base/500/secondary, baked in — structural CSS keeps layout
only); back={Back,/home} added to Profile, Team, Page settings, and the
coming-soon stubs; DESIGN.md §5 table row; chip.
Verified on 4201: ← Back renders above the title, left-aligned with it,
13px/500/#6b7280, routes /home.
