# CC Prompt — p0024 — `/projects` landing page + Projects header button

Close the agent home loop. The `View Projects` launcher tile from p0019 currently dead-ends — this prompt makes it land somewhere meaningful, plus adds a `Projects` button to the top-nav for direct access.

Two-part, one commit:
1. New standalone `/projects` page reusing the project-card grid + accordion-collapse pattern preserved when p0019 stripped Active Events from the dashboard centre column.
2. New `Projects` button in the top-nav alongside Home / Admin / etc., routes to `/projects`.

Same rules: existing v1.22 tokens only, Lucide icons only, PrimeNG + Tailwind + CSS vars three-layer rule per WORKING_STANDARDS.

## 1. `/projects` page

### Files

- New: `client-angular/src/app/features/projects/projects-list.component.ts` (or whatever fits the existing `features/projects/` structure)
- Updated: `client-angular/src/app/app.routes.ts` — register the new route
- Updated: `client-angular/src/app/features/dashboard/dashboard.component.ts` — confirm the `goToProjects()` handler routes to `/projects` (if it doesn't already)
- Updated: `client-angular/src/app/features/agent/agent.component.ts` — same `goToProjects()` confirmation

### Component shape

Standalone Angular component, OnPush, follows the same chrome conventions as the dashboard:

- Page bg: `--theme-bg` (parchment)
- Wraps content in a panel pattern matching dashboard (`bp-page` outer, with hero strip + main grid)
- Hero strip uses the existing AppShell mechanism (ShellContextService push) — title from `ConfigService.heroTitleMode`, subtitle from `ConfigService.homePageLabel`, colour from `ConfigService.heroColor`. Same pattern as dashboard / agent so the hero customisation drawer applies here too.

### Content — three sections, accordion pattern

The pre-p0019 dashboard centre column had Active / Inactive / Past projects. Same three sections here, vertical stack:

- **Active** projects — expanded by default, project-card grid (the existing `.bp-project-card*` styles preserved from p0019)
- **Inactive** projects — collapsed by default, chevron header to expand
- **Past** projects — collapsed by default, same accordion treatment

Section header pattern matches the dashboard's "+ New Event" chrome:

- Calm panel header with Lucide `folder-open` icon + small-caps label
- Right side: count badge + chevron toggle (Active stays open by default, no chevron action needed on it — or include it for consistency)
- Inactive + Past collapse to header-only when toggled closed

Pull the project list from the existing `ProjectService` (same source as the dashboard used). Each project card is the existing project-card markup — image cover, status pill, client chip, name, date, cost estimate, overflow menu — preserved verbatim from p0019's "don't delete styles that are about to be reused" instruction.

### Routing

```typescript
// app.routes.ts addition
{
  path: 'projects',
  loadComponent: () =>
    import('./features/projects/projects-list.component')
      .then(m => m.ProjectsListComponent),
  canActivate: [AuthGuard],
},
```

Use the existing route pattern in `app.routes.ts` — if other routes use eager imports or different guard setups, match that.

### Wire the launcher tile

`goToProjects()` handlers on dashboard + agent should already route to `/projects`. Confirm they do; if they route to `/projects` already but it 404s (because the route doesn't exist yet), this prompt's route registration fixes that automatically.

## 2. Projects button in the top-nav

### Files

- Updated: `client-angular/src/app/layout/top-nav.component.ts`

### Placement

Add a `Projects` button to the top-nav alongside the existing entries (Home / Admin / Welcome / etc.). Match the existing nav button chrome — same font, same hover state, same active treatment.

- Position: between Home and Admin (or wherever feels most natural in the existing layout — defer to the visual hierarchy that's there)
- Lucide icon: `folder-open` (matches the View Projects launcher tile)
- Label: `Projects` (or whatever the configurable `projectLabel` setting resolves to — `Events`, `Shows`, etc.)
- Active state: when route is `/projects`, the button highlights using the same active treatment as the Home button

### Gating

If the top-nav is persona-aware (agent vs supplier vs admin sees different links), gate Projects to the agent persona only. If the top-nav doesn't differentiate today, just add the button universally — per-persona gating becomes a p0020 concern.

## What NOT to do

- **Don't build a new project-card component.** Reuse the existing `.bp-project-card*` markup + styles that p0019 explicitly preserved.
- **Don't add per-section visibility flags to ConfigService.** The Active / Inactive / Past accordion sections are intrinsic to `/projects`, not user-toggleable like the home dashboard's sections.
- **Don't redesign the project card.** Same cover image, same status pill, same client chip, same overflow menu. The card is shipping debt-free from p0014.
- **Don't pre-empt p0020.** No per-persona logic in this prompt beyond the top-nav gating (and that's optional if top-nav doesn't already differentiate).

## Verify

- Click `View Projects` launcher tile on home → lands on `/projects`
- Click `Projects` in the top-nav → same
- `/projects` page renders with three sections: Active (expanded, project cards visible), Inactive (collapsed, chevron header), Past (collapsed, chevron header)
- Expand Inactive → cards render. Collapse → header-only state. Same for Past.
- Hero on `/projects` honours the drawer's Hero customisation (Title mode, Subtitle, Hero color)
- Project cards on `/projects` look identical to how they looked on the pre-p0019 dashboard centre column
- Status pill colour, client chip, cost estimate, overflow menu all functional
- Theme switch via APPEARANCE recolours the page correctly
- Back button (browser) returns to the page that linked here
- No regression on `/home`, `/agent`, or the launcher grid itself

When complete, mark p0024 `Done` in `prompts/backlog.md` and write `p0024-projects-landing-page-shipped.md` per the cc-onboarding ship-report convention.
