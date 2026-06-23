# CC Prompt — p0023 — Hero customisation in the page-config drawer

Three small additions to the existing page-config drawer (p0017), all touching the hero area on dashboard + agent. One atomic commit. No new components, no architectural moves — just three new drawer controls + one config field per control + the bindings that read them in the AppShell hero.

## What changes

### 1. Title selector — new dropdown in GENERAL group

Add a `Title` dropdown to the GENERAL group of the drawer, between the existing Subtitle field (currently labelled "Page Label" — being renamed in §2) and the Credits field.

**Options** (three):

| Option | Renders | Source |
|---|---|---|
| Org Name | The active org's name (e.g. "Woodland Agency") | `OrgService.org.name` |
| Username | The active persona's full name (e.g. "Liam Wood") | `PersonaService.active.name` |
| Greeting | `Welcome back, {firstName}` (e.g. "Welcome back, Liam") | First word of `PersonaService.active.name`, fallback "there" |

**Default:** Greeting (matches current agent page behaviour).

**ConfigService:** add field `heroTitleMode: 'org' | 'user' | 'greeting'` to the Config model. Default `'greeting'`. Save on change (same pattern as the existing fields).

**Control:** `p-dropdown` with three options. Display labels match the table above.

### 2. Rename "PAGE LABEL" → "Subtitle"

In the drawer's GENERAL group, the existing text input currently labelled `PAGE LABEL` becomes `Subtitle`. **No underlying field change** — `ConfigService.config.homePageLabel` stays as the data field. Only the visible label in the drawer changes.

The reason: "Page label" was confusing (it sounded like the page title); "Subtitle" matches what it actually is — the small-caps eyebrow above the hero title.

### 3. Hero color toggle — new segmented control in APPEARANCE group

Add a `Hero color` segmented button to the APPEARANCE group, between Theme and Align.

**Options** (two):

| Option | Renders | Background |
|---|---|---|
| Theme | Calm themed wash on the hero strip | `--theme-soft` |
| None | No tint, hero matches page background | `--theme-bg` |

**Default:** Theme (the calm `--theme-soft` wash currently rendered on agent + dashboard).

**ConfigService:** add field `heroColor: 'theme' | 'none'`. Default `'theme'`. Save on change.

**Control:** `bp-cfg-seg` segmented button pair (`[Theme] [None]`), matches the existing Align / Nav controls' chrome.

## How the hero renders

The AppShell's hero binds to ConfigService:

- `heroTitleMode = 'org'` → `<h1>{{ org.name }}</h1>`
- `heroTitleMode = 'user'` → `<h1>{{ activePersona.name }}</h1>`
- `heroTitleMode = 'greeting'` → `<h1>Welcome back, {{ firstName }}</h1>`
- `heroColor = 'theme'` → hero strip uses `background: var(--theme-soft)`
- `heroColor = 'none'` → hero strip uses `background: var(--theme-bg)` (or transparent, same effective look)

The hero subtitle stays bound to `ConfigService.config.homePageLabel` (unchanged — just renamed in the drawer UI).

The existing `applyHero()` helpers in `agent.component.ts` and `dashboard.component.ts` that hardcode the "Welcome back" title can stay as a **fallback** for when the persona/org isn't loaded yet, but the canonical render path now reads from `config.heroTitleMode` + the appropriate data source. Audit the agent / dashboard ngOnInit hooks to make sure they're not clobbering the configured mode.

## Drawer layout after this prompt

```
GENERAL
  Subtitle      [Projects                  ]   ← renamed (was Page Label)
  Title         [Greeting              ▾   ]   ← NEW dropdown
  Credits       [Ball                      ]
  Events        [Event                     ]

APPEARANCE
  Theme         ◯ ◯ ◉ ◯ ◯
  Hero color    [Theme] [None]                  ← NEW segmented
  Align         [Left] [Centre]
  Nav           [Tabs] [Menu]

HERO
  ☑ User name
  ☑ Location

SECTIONS
  ☑ Upcoming
  ☑ Stats
  ... (per p0018)
```

## What NOT to do

- Don't remove the existing Light / Bold mode toggle if there's a separate one elsewhere — this prompt adds a new `heroColor` field, it doesn't subsume `data-mode`. (If they're conceptually overlapping, raise it in your reply and we'll resolve before commit.)
- Don't add per-persona scoping for these new fields — they're flat ConfigService flags for now, same as the other p0018 fields. Per-persona is p0020's lift.
- Don't change the underlying `homePageLabel` data field. Only the drawer label text changes.
- Don't add a "Reset to defaults" affordance. Defaults are set at config initialisation; user can re-pick the default option from the dropdown if they want it back.

## Verify

- Open the cog drawer on home or agent.
- GENERAL group shows: Subtitle (renamed) / Title dropdown / Credits / Events. Three rows above + the new dropdown.
- APPEARANCE group shows: Theme / Hero color (new) / Align / Nav.
- Select Title = Org Name → hero h1 updates live to the agency name.
- Select Title = Username → hero h1 updates to the active persona's full name.
- Select Title = Greeting → hero h1 reads "Welcome back, {firstName}".
- Toggle Hero color = None → hero strip background flips from `--theme-soft` to `--theme-bg` live (no reload).
- Toggle Hero color = Theme → wash returns.
- Subtitle input still saves on blur and updates the eyebrow above the title live.
- Switch persona via avatar dropdown → if Title = Greeting or Username, the displayed name updates to the newly active persona.
- Switch theme via the swatches → if Hero color = Theme, the wash recolours to the new theme's `--theme-soft`.

When complete and verified, mark p0023 `Done` in `prompts/backlog.md` and write `p0023-hero-customisation-shipped.md` per the cc-onboarding ship-report convention.
