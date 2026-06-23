# CC Prompt — p0032 — Hero color global + page-config drawer two-tab reorganization

Three changes in one commit. The architectural intent: settings that affect only the dashboard surface live in a Dashboard tab; settings that affect every hero in the app live in a General tab. Hero color is the one app-wide setting currently coupled to the dashboard surface — that's the bug.

Same rules: existing v1.22 tokens only, Lucide icons only, PrimeNG + Tailwind + CSS vars per WORKING_STANDARDS.

## 1. Hero color becomes a global ConfigService read

### Current bug

`AppShell.heroIsNone` reads from `ctx.heroColor` (line 453-454 of `app-shell.component.ts`). Only the dashboard + agent components push `ctx.heroColor`, so every other surface (Marketplace, `/projects`, `/inbox`, project pages) falls through to the legacy `heroVariant` system and ignores the user's `ConfigService.heroColor` setting entirely. Flipping Hero color in the drawer doesn't affect Marketplace, Projects, or anywhere else.

### Fix

- `AppShell.heroIsNone` reads `ConfigService.heroColor` directly (not from `ctx`).
- Drop the `heroColor` field from `ShellContext` entirely — it's a global setting, not a per-page push.
- Dashboard + agent stop pushing `ctx.heroColor`. Replace it with an explicit `ctx.useConfiguredTitle: boolean` that signals "this surface uses the configured title mode (org / username / greeting)". Marketplace, project pages, etc. don't push this flag and continue using their own object-name titles.
- Update the `heroTitle` getter: `if (this.ctx?.useConfiguredTitle) return this.configuredHeroTitle();` — same logic, cleaner intent.

### Effect

Flip Hero color → Theme in the drawer: every hero across the app shows the themed accent fill. Flip → None: every hero shows the calm parchment. Marketplace continues to show "BALLPARK" as its title regardless (because Marketplace doesn't push `useConfiguredTitle`). Dashboard continues to show "Welcome back, Sarah" because it pushes `useConfiguredTitle: true`. The two concerns (color treatment + title source) are no longer conflated.

### What NOT to touch

- The route-driven `heroVariant` ('calm' / 'default' / 'none') stays for surfaces that explicitly need a route-specific treatment (e.g., auth pages). It just no longer fights with `ConfigService.heroColor` for the theme/parchment decision.
- `showUserName` / `showLocation` are already global (lines 528, 706-707 read directly from `ConfigService.config`) — don't touch them.
- `navMode` is already global — don't touch.

## 2. Drawer gets two tabs at the top: Dashboard and General

Wrap the drawer body in a PrimeNG `<p-tabView>` (or matching segmented control if `p-tabView` chrome doesn't fit the drawer aesthetics — use `bp-cfg-seg` styled tabs as a fallback). Two tabs:

```
[Dashboard] [General]
```

Default tab on open: **Dashboard** (more frequently touched than General once the page is set up).

Active tab persists in component state — re-opening the drawer remembers which tab the user was on within the session.

### Implementation note

The drawer template body becomes:

```html
<div class="bp-drawer-body">
  <p-tabView [(activeIndex)]="activeDrawerTab">
    <p-tabPanel header="Dashboard">
      <!-- Dashboard-tab controls (§3 below) -->
    </p-tabPanel>
    <p-tabPanel header="General">
      <!-- General-tab controls (§3 below) -->
    </p-tabPanel>
  </p-tabView>
</div>
```

If `p-tabView` styling clashes with the drawer's calm aesthetic, fall back to a `bp-cfg-seg` two-button row at the top of the body + `*ngIf` switching between two sibling `<div>` panels below. Either is acceptable — match what reads cleanest.

## 3. Reorganize existing controls into the right tab

### Dashboard tab — settings that affect only the dashboard surface

| Control | Type | Notes |
|---|---|---|
| Title | dropdown | Org Name / Username / Greeting (from p0023's `heroTitleMode`) |
| Subtitle | text input | Currently labelled "Page Label" — display label stays as "Subtitle" per p0023's renaming |
| Sections | checkbox list | Upcoming · Stats · Quick Actions · {{ creditLabel }}s card · Saved Suppliers · Recent Activity (from p0018 + p0019) |

The Dashboard tab is where you customise this specific page — the title that greets you, the eyebrow subtitle, which body sections render.

### General tab — settings that affect every hero across the app

| Control | Type | Notes |
|---|---|---|
| Theme | colour swatches | Amber / Emerald / Pink / Ocean / Slate (existing) |
| Hero color | segmented | Theme / None (now globally applied per §1) |
| Hero align | segmented | Left / Centre |
| Nav | segmented | Tabs / Menu |
| User name | checkbox | Hero meta chip (was in p0018's HERO group) |
| Location | checkbox | Hero meta chip (was in p0018's HERO group) |
| Credits label | text input | What "Balls" becomes — e.g., "Tokens", "Credits" |
| Events label | text input | What "Events" becomes — e.g., "Projects", "Shows" |

The General tab is "site preferences" — settings that ripple through every page in the app.

### What gets deleted from the old drawer structure

- The four legacy groups (GENERAL, APPEARANCE, HERO, SECTIONS) and their `bp-drawer-label` sub-eyebrows. The two tabs replace the grouping mechanism entirely.
- The existing top-of-body grouping CSS for those four sub-eyebrows.

### What stays unchanged

- All existing field bindings (the controls all still write to the same `ConfigService` fields they do today).
- The `save-on-change` behaviour — no Save/Cancel buttons.
- The `X` close button in the header.
- The drawer's standard `bp-drawer` chrome (480px width, position right, etc.).
- The cog button + drawer visibility lifecycle in app-shell.

## What NOT to do

- Don't add per-surface heroColor pushing. The setting is now global; nothing should override it surface-by-surface.
- Don't add a third tab. Two tabs is the architectural split; more tabs invites mushrooming.
- Don't change the `ShellContext` shape beyond dropping `heroColor` and adding `useConfiguredTitle`. Other fields stay.
- Don't redesign individual control chrome (theme swatches, segmented buttons, checkboxes). Just move them between tabs.
- Don't add new ConfigService flags. The reorganization uses existing fields.

## Verify

- **Hero color global propagation:**
  - On `/home`: flip Hero color → Theme. Hero strip becomes themed accent fill. Flip → None. Hero strip becomes calm parchment.
  - Navigate to `/marketplace`: hero respects the same setting. Theme → accent fill, None → parchment.
  - Same on `/projects`, `/inbox`, `/projects/:id`, any project sub-tab — every hero responds.
  - Marketplace title still reads "BALLPARK" (or whatever's been configured for that page). Dashboard title still shows the configured org/user/greeting.
- **Drawer two-tab structure:**
  - Open drawer on dashboard. Default tab: Dashboard.
  - Dashboard tab shows: Title dropdown, Subtitle input, Sections checkbox list.
  - General tab shows: Theme swatches, Hero color segmented, Hero align segmented, Nav segmented, User name + Location checkboxes, Credits label, Events label.
  - Click General → tab switches. Close drawer. Reopen → still on General (within session).
- **Existing behaviour preserved:**
  - All controls still save on change (no Save/Cancel).
  - Theme switch still recolours the app.
  - Section visibility toggles still hide/show dashboard sections.
  - Title mode / Subtitle still drive the dashboard hero.
  - User name / Location chips still gate the hero meta chips on every page (already global, just moved).

When complete and verified, mark p0032 `Done` in `prompts/backlog.md` and write `p0032-hero-color-global-and-drawer-tabs-shipped.md` per the cc-onboarding ship-report convention.
