# CC Prompt — p0019 — Launcher grid (extract action-tile + home centre column + agent page)

The home page's centre column becomes a launcher — a grid of folder-style action tiles that route to the app's main surfaces. The Active Events grid is displaced to its own dedicated `/projects` page (that page is a separate prompt; **do not build it here**).

Three pieces of work, atomic commits in order:

1. **Extract `<app-action-tile>`** from `agent.component.ts` into a shared standalone component. Per WORKING_STANDARDS "Extract Before Duplicate" — the agent page already uses this card shape, home is about to use it, mandatory extraction first.
2. **Home centre column** — replace the Active Events panel with a 5-card launcher grid using the new tile component. Trim Quick Actions in the left column to remove the now-redundant Marketplace shortcut.
3. **Agent page** — extend the existing single-card grid to the same 5 cards so home and agent share their launcher set.

## 1. Extract `<app-action-tile>`

Create `client-angular/src/app/shared/components/action-tile/action-tile.component.ts`.

**Selector:** `<app-action-tile>`.
**Class:** `ActionTileComponent`.
**Standalone, OnPush.**

**Inputs:**

```typescript
@Input() icon!: string;        // Lucide icon name, e.g. 'folder-plus'
@Input() title!: string;       // Primary card label
@Input() subtitle?: string;    // Optional muted subline
@Input() ariaLabel?: string;   // Optional override for aria-label (default = title)
```

**Output:**

```typescript
@Output() action = new EventEmitter<void>();
```

Parent wires the action — open a modal, navigate via `router.navigate`, whatever. Don't bake routing into the tile.

**Template:** lift the existing `bp-agent-card` markup from `agent.component.ts` exactly as it is. The card is a `<button type="button">` so it's keyboard-focusable. Icon stacked above title (column flex, `align-items: flex-start`), gap 14px between icon and body. Title in `--font-display`, subtitle in `--font-body`.

**Styles:** move the existing `.bp-agent-card*` rules into the new component's styles, renamed to `.bp-action-tile*` (or whatever naming reads cleanly):

- `--color-surface` bg, `--border-hairline`, `border-radius: 20px`, `box-shadow: --shadow-md` (the agent-page deviations stay as the tile's chrome — they're the new canonical shape for action tiles)
- Hover: lift `-1px`, `box-shadow: --shadow-lg`
- Focus-visible: `outline: 2px solid var(--theme-accent)` with 2px offset
- Active: `transform: translateY(0)`
- 40px icon square, `border-radius: 14px`, `--theme-soft` bg, `--theme-accent` icon colour
- Min-height 200px, padding 26px

**Icon registration:** use `LucideAngularModule.pick({ /* icons */ })` per WORKING_STANDARDS. Since the tile takes the icon name as a runtime input, the component itself doesn't pick specific icons — it just renders `<lucide-icon [name]="icon" [size]="20">`. The CONSUMER pages pick the icons they pass in.

**Verify the extraction:** agent page rebuilt to consume `<app-action-tile>` looks pixel-identical to before. No visual regression on agent.

Delete the inline `.bp-agent-card*` styles + the `<button class="bp-agent-card">` markup from `agent.component.ts` — they live in the shared component now.

## 2. Home centre column — replace Active Events with the launcher grid

In `dashboard.component.ts`:

**Remove:**

- The entire Active Events panel (header + grid + `+ New Event` pill button + Inactive Events + Past Events accordions)
- Related state in the component class: `activeProjects`, `inactiveProjects`, `pastProjects` loaders, `openMenuProjectId`, the menu open/close handlers, `onMenuAction`, `createProject()` if it was only wired to the header pill
- `loadProjects()` if its only purpose was the centre column (verify first — the stats bar uses `activeProjects.length`, so the load may still be needed for that count)
- The associated CSS for `.bp-project-card*`, `.bp-card-header*`, `.bp-card-menu*`, etc., **only if no other surface uses them**. They'll come back when the `/projects` page is built (next prompt). Move to a shared SCSS or leave in `styles.css` if they're globally reachable. **Don't delete styles that are about to be reused.**

**Add** a centre-column launcher grid:

```html
<div class="bp-launcher-grid">
  <app-action-tile
    icon="folder-plus"
    title="Add {{ projectLabel }}"
    [subtitle]="'Start a new ' + projectLabel.toLowerCase()"
    (action)="openNewProject()">
  </app-action-tile>

  <app-action-tile
    icon="folder-open"
    title="View {{ projectLabel }}s"
    [subtitle]="'Browse all your ' + projectLabel.toLowerCase() + 's'"
    (action)="goToProjects()">
  </app-action-tile>

  <app-action-tile
    icon="inbox"
    title="Inbox"
    subtitle="Supplier replies and threads"
    (action)="goToInbox()">
  </app-action-tile>

  <app-action-tile
    icon="store"
    title="Marketplace"
    subtitle="Browse items and suppliers"
    (action)="goToMarketplace()">
  </app-action-tile>

  <app-action-tile
    icon="circle-user"
    title="Profile"
    subtitle="Your account and settings"
    (action)="goToProfile()">
  </app-action-tile>
</div>
```

Grid CSS — match the agent pattern but adapted for the narrower centre column:

```css
.bp-launcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
```

This wraps 2 per row at typical centre-column widths, 3 at wider viewports.

No surrounding panel — tiles are their own elevated surfaces (same as the agent page). Don't wrap in a `bp-dash-card`.

**Wire the navigation handlers** in the component class:

```typescript
goToProjects()    { this.router.navigate(['/projects']); }
goToInbox()       { this.router.navigate(['/messages']); }
goToMarketplace() { this.router.navigate(['/suppliers']); }
goToProfile()     { this.router.navigate(['/profile']); }
```

Confirm routes against `app.routes.ts` before wiring — use what's actually registered, not what's suggested above if there's drift.

`openNewProject()` uses the existing `CreateProjectService.open()` — same wiring as agent.

**Stats bar stays** — `Active {{ projectLabel }}s` count still meaningful even with the grid gone (it's the at-a-glance number). Just confirm the data still loads if you stripped the project list loader.

**Trim Quick Actions** in the left column. Today: Browse Marketplace / Browse Suppliers / Invite Member. After:

- **Drop** Browse Marketplace (redundant with the Marketplace tile)
- **Keep** Browse Suppliers (distinct enough — supplier list view, not the item browse)
- **Keep** Invite Member (settings shortcut)

If after trimming the Quick Actions panel feels thin, that's fine — it's still a useful slot for secondary nav.

## 3. Agent page — same 5-card set

In `agent.component.ts`, replace the single existing card with the same 5-card grid as home. Use the new `<app-action-tile>` component, identical icons + titles + subtitles, identical action wiring. The two pages literally share the same set of tiles.

This means the agent page now mirrors the home centre column. Conceptually: agent IS the launcher, home is the launcher + supporting content (stats, upcoming, etc.).

Update the agent page's grid CSS if needed so it accommodates 5 cards cleanly (the existing `repeat(auto-fit, minmax(280px, 350px))` with `justify-content: center` should work — 5 cards = 3-on-top + 2-centred-below at typical viewports).

## Cleanup of the dead `showActiveProjects` flag

p0018 (which ships alongside or before this prompt) adds a `showActiveProjects` flag to `ConfigService` that gates the Active Events panel. Since this prompt **removes** that panel from home, the flag becomes a dead flag after this prompt lands.

**As part of this prompt's implementation:**

- Remove the `showActiveProjects` field from the `Config` model + `ConfigService.config$` emit shape.
- Remove the "Active {{ projectLabel }}s" checkbox row from the SECTIONS group in `page-config-drawer.component.ts`.
- Search for any code that reads `config.showActiveProjects` and remove it (the *ngIf was wrapping the now-deleted Active Events panel, so the references should be in the same diff you're already touching).
- Don't bother with a config migration for users who may have toggled the flag off — defaults are `true`, the flag never had a chance to be persisted at scale, and we're single-user for now.

If p0018 hasn't shipped by the time you implement this, the flag never existed in the first place — just skip this cleanup section.

## What NOT to do

- **Don't build the `/projects` page.** That's the next prompt (p0020). The View Projects tile routes to whatever `/projects` resolves to today (probably an existing list page or a placeholder).
- **Don't merge home and agent into one route.** They stay as separate routes for now, sharing the tile set. Future consolidation is a product call, not this prompt.
- **Don't add new flags to ConfigService for the launcher tiles.** All 5 tiles are always visible on both pages.
- **Don't add per-persona tile sets.** Same 5 cards on both pages, no logic switching by persona.
- **Don't delete the project-card CSS without checking reuse.** It'll come back when `/projects` lands.

## Verify

- `<app-action-tile>` exists as a shared standalone component in `shared/components/action-tile/`. Agent page rebuilt to use it looks pixel-identical to its previous state.
- Home page centre column now hosts a 5-card grid: Add {Event}, View {Event}s, Inbox, Marketplace, Profile. Labels interpolate `projectLabel` live.
- Clicking Add {Event} opens the existing create-project modal. Clicking the other four navigates to their respective routes.
- Active Events / Inactive / Past panels are gone from home.
- Stats bar still shows the active count correctly.
- Quick Actions in the left column shows Browse Suppliers + Invite Member only.
- Agent page renders the same 5 cards in its existing centred grid.
- Theme switch propagates to tile chrome (themed-soft icon bg, themed-accent icon colour, themed-accent focus outline).
- No visual regression in the left or right columns of the dashboard.

When complete and verified, mark p0019 `Done` in `prompts/backlog.md` and write `p0019-launcher-grid-shipped.md` per the cc-onboarding ship-report convention.
