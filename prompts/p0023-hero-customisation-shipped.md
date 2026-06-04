# Shipped — p0023 — Hero customisation in the page-config drawer

**Version:** v1.66a
**Shipped:** see commit log
**Prompt:** `p0023-hero-customisation-prompt.md`

## What changed
Three drawer controls + two ConfigService fields + the AppShell hero
bindings that read them. Scoped to the **home + agent** surfaces only.

## §1 — Title dropdown (GENERAL)
- New `p-dropdown` "Title" between Subtitle and Credits: Org Name /
  Username / Greeting. Writes `config.heroTitleMode` ('org' | 'user' |
  'greeting', default 'greeting'). Save on change.

## §2 — "Page label" → "Subtitle" (GENERAL)
- Display-label rename only. Still writes `homePageLabel` (the eyebrow
  field) — no data change.

## §3 — Hero color (APPEARANCE)
- New `bp-cfg-seg` segmented "Hero color" between Theme and Align:
  Theme / None. Writes `config.heroColor` ('theme' | 'none').
- **Reframed from the prompt** (which used `--theme-soft`, currently
  aliased to `--theme-bg` → a no-op). Now swaps the two existing hero
  treatments: **Theme** = `.bp-hero` accent fill, **None** =
  `.bp-hero--none` calm parchment (the stripped agent look).
  **Default `none`** (the calm agent screenshot), per Liam.

## Config (config.model.ts / config.service.ts)
- `PlatformConfig` gains `heroTitleMode?` + `heroColor?`. ConfigService
  defaults `greeting` / `none`; two getters added. update()/load()
  already spread — free migration.

## AppShell binding (the canonical render path)
- `ShellContext` gains `heroColor?`. Home + agent push it; its presence
  marks a "home surface". The AppShell:
  - `heroTitle` getter → when `ctx.heroColor` is set, computes from
    `heroTitleMode` (org name / persona name / "Welcome back, {first}")
    using its existing OrgService + PersonaService; otherwise the prior
    `ctx.heroTitle || org/platform` path (no change for other pages).
  - `heroIsNone` / `heroIsCalm` getters drive the hero-strip classes;
    when `ctx.heroColor` is set it overrides the route's heroVariant
    ('none' → parchment, 'theme' → accent).
  - ctx is kept alive when only `heroColor` is set (was heroTitle/back).
  - `heroTitleMode` synced in `syncFromConfig`.
- **dashboard** + **agent** push `heroColor: config.heroColor` and no
  longer push a hardcoded `heroTitle` (the AppShell computes it). Both
  re-push on config change so the drawer flips them live; persona switch
  updates the title via the AppShell's existing persona$ subscription.

## Scoping decision (flagged)
`heroTitleMode` is **not** wired globally — many pages (settings,
suppliers, messages, projects, favourites) rely on the org-name hero
fallback, so a global default of `greeting` would put "Welcome back" on
Settings etc. Scoping via `ctx.heroColor` presence keeps every non-home
page untouched.

## Behaviour note (flagged for QC)
Default `heroColor='none'` renders the dashboard hero with the existing
`--none` treatment, which also **hides the hero pill band + tab band**
(it's the stripped agent look). So by default the dashboard's Home/Inbox
hero-tabs + user/location pills tuck away; they return when `heroColor`
is set to `theme`. The p0018 User/Location pill toggles therefore only
have a visible effect under `heroColor='theme'`. This matches the
"calm agent screenshot as default" direction — confirm it's wanted.

## Verify (per prompt spec)
Build-verified (`ng build` clean). Visual QC for Liam:
- ☐ GENERAL: Subtitle (renamed) / Title dropdown / Credits / Events.
- ☐ APPEARANCE: Theme / Hero color (new) / Align / Nav.
- ☐ Title = Org Name → hero h1 = agency name (live).
- ☐ Title = Username → hero h1 = active persona name.
- ☐ Title = Greeting → "Welcome back, {firstName}".
- ☐ Hero color = Theme → accent-fill hero (pills + tabs reappear);
     None → calm parchment (stripped). Live, no reload.
- ☐ Subtitle input still saves on blur → eyebrow updates.
- ☐ Switch persona → Greeting/Username title updates.
- ☐ Switch theme swatch → Theme hero recolours to the new accent.
- ☐ Other pages (settings, suppliers, messages) hero unchanged.

p0023 → `Done` in `prompts/backlog.md`.
