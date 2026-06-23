# pV2-04b1-qc — Home visual polish + `<app-edit-field>` foundation · SHIPPED

**Status:** Shipped (awaiting chat audit pass before Done)
**Version chip:** `[Dev v2] v2.09d`
**Branch:** dev — five commits.

## Commits

| SHA | What |
|---|---|
| `5c37ab5` | `<app-edit-field>` primitive — drawer density, text + select, zero-shift metrics (34px field / 12px muted label / fill+border only when editing), the v1 PrimeNG styleClass gotcha carried over |
| `2d66641` | `ShellContextService` registry + shell-header cog + shell-owned drawer instance; home-agent just registers `{ pageKey: 'v2Home', label: 'Customise your home' }` |
| `bcc8546` | Launcher at v1 proportions: 3×minmax(280,340) grid wrapping 3+2, 64px soft-pastel icon blocks, 17px titles + v1 subtitle copy, gradient-primary white subtitle, `← Back` (Location.back, shown at root per v1) |
| `2626133` | Drawer rebuilt on `<app-edit-field>` (4 fields); `<app-settings-select-row>` + `<app-settings-input-row>` deleted, zero orphans |
| (ship) | Chip v2.09d + this report + backlog flips (pV2-04b → Done per Liam's QC verdict; this row → Shipped) |

## Acceptance — 21/21

1–2 ✓ 3+2 wrap at desktop (computed: `340px 340px 340px`, rows 2, 3-per-row), tiles 340×174 (≥280×150)
3 ✓ icon block (soft pastel bg + accent icon) + title + subtitle on every tile
4 ✓ primary keeps gradient + white title/subtitle
5 ✓ `← Back` top-left of the launcher stack, wired to `location.back()`, rendered at root
6–9 ✓ cog in the shell header (page-absolute one gone from the DOM), renders only with a registration + `org.invite_member`, opens the SINGLE shell-mounted drawer; registry verified by the drawer title reading the registration's label
10–12 ✓ drawer body = `<app-edit-field>` only (0 `app-settings-*-row` elements in DOM, files deleted), labelled rows with v1 rhythm, Title + conditional Title-text + Subtitle + Position
13 ✓ save-on-change persists against the migrated table — typed a subtitle through the edit-field, launcher updated live AND the server returned it on a fresh GET (test value reset afterwards)
14–18 ✓ hygiene greps zero; raw-color guard green; edit-field host-bound signal component; `arrow-left` in the global pick; row components deleted with zero orphan references
19 ✓ v1 on 4200 untouched (no v1 files in the diff)
20 ✓ dev-user switch updates greeting + cog visibility (admin gate unchanged from pV2-04b)
21 ✓ persistence (see 13 — migration already run)

Suites: 51 client + 24 server; build + lint + raw-color guard clean.

*Screenshot: the preview screenshot tool timed out (flaky all session — the page itself is responsive); eyeball `localhost:4201/home` directly for the side-by-side with v1.*

## Concerns not in spec

### Spec-hygiene precedence deviations (Rule 9)

1. **v1 edit-field ported faithfully except**: `@Input/@Output/booleanAttribute` → signal inputs/`output<T>()`; `*ngIf` chain → `@switch`; `display: contents` host dropped (no grid-span consumer at drawer density yet — pV2-04c adds `span2` when the page grid needs it); v1's six types reduced to the prompt's two.

### Findings + calls you should sanity-check

2. **The three label inputs (Credits/Events/Clients) left the drawer** — the rebuild sketch and acceptance 12 list only Title/Title-text/Subtitle/Position, so I followed them. The payload fields and service computeds REMAIN (tiles still interpolate eventLabel); they're just not editable from this drawer any more. If that was accidental spec-narrowing, restoring them is three `<app-edit-field>` lines.
3. **ShellContextService is new** (the spec offered "or extend an existing one" — there was none). Deliberately tiny: one registration signal + drawer visibility. The drawer reads the registration's `label` for its header, so Profile gets the right title for free.
4. **Drawer field set is still hard-wired to the home surface** — the registry carries `pageKey` but the drawer renders home's four fields regardless. Fine while home is the only registrant; pV2-04c must either switch on `pageKey` or (better) have pages project their own drawer content. Flagged so the Profile prompt budgets for it.
5. **Tile shadow drift**: v1 tiles use `--shadow-md` at rest; the QC sketch says `--shadow-xs` — shipped the sketch's xs (rest) with lg on hover. Visually close; flag if the rest-state feels flatter than v1.
6. **Back at root is a v1 quirk faithfully ported** — on a fresh tab, `location.back()` at `/home` is a no-op. v1 behaves identically; noting it's deliberate, not broken.
