# CC Prompt — p0031 — Projects page card refresh + layout polish

Four refinements to the `/projects` page that just shipped via p0024. All scoped to the projects-list component — no architectural changes, no new components, no model changes.

Same rules: existing v1.22 tokens only, Lucide icons only.

## What changes

### 1. Refresh the project card visual

The card stays roughly the same shape (cover image / title / status / cost) but gets a bigger and more confident treatment per the reference screenshot. Specifically:

- **Bigger.** Grid `minmax(220px, 1fr)` → `minmax(320px, 1fr)`. Cover image height roughly proportional (was ~140px, bump to ~200px).
- **Notification badge** on the cover image top-right. Lucide `message-circle` icon + count + " New" label. Pill shape, gradient pink → soft accent background (e.g., `linear-gradient(90deg, --color-action, --theme-soft)` or a flat `--color-action-soft`). Only render when the project has unread items (count > 0).
- **Title row:** unchanged — large bold project name, primary text.
- **Status pill row:** the existing status-pill stays (pulls from `project_status` codelist), but rendered on its own line below the title rather than overlaid on the cover. Light tint (`--color-action-soft` background, `--color-action` text — or whatever the codelist's color meta drives). Pill radius `--radius-pill`, padding `4px 12px`, font size 11px.
- **Stats row** below the status pill: two items justified between, left and right. Left: `{N} Suppliers`. Right: relative time (`3 Days Ago`, `Today`, `5 Months Ago`). Use date-fns or whatever the codebase uses for relative timestamps. Font 13px, muted (`--color-text-muted`).
- **Ballpark cost** at the bottom: BIG, attention-grabbing. Font 26-30px, weight 600, gradient text (`linear-gradient(90deg, --theme-accent, --color-action-soft)` clipped to text via `background-clip: text`). Format using existing `CompactCurrencyPipe`. Label `Ballpark` muted next to it, smaller.

### 2. Add REF chip above the name

Small pill above the project title showing the project's `ref` (e.g., `WA-016`). Same treatment as the inbox row's `Ref XX-NNN` from p0008 — `--radius-pill`, small caps eyebrow style, `--theme-soft` background, `--theme-accent` text, 10px, letter-spacing `0.06em`. If `ref` is null on a project, don't render the chip (no `—` fallback).

### 3. Hero tabs + remove "Active Projects" header, full-width no border

Add two tabs to the page hero via `ShellContextService`, mirroring the Home/Inbox tab pattern on the dashboard:

```typescript
this.shellCtx.set({
  heroSub: 'Manage active and completed ' + projectLabel.toLowerCase() + ' projects',
  heroColor: this.configService.heroColor,
  tabs: [
    { label: 'Active',    path: 'active' },
    { label: 'Completed', path: 'completed' },
  ],
  activeTabPath: this.activeProjectsTab,
  onTabClick: (t: any) => this.setProjectsTab(t.path),
});
```

Component-side: `activeProjectsTab: 'active' | 'completed' = 'active'` with a `setProjectsTab(tab)` setter that updates and re-pushes the shell context (same `pushShellContext` pattern the dashboard uses).

Rendering:
- `*ngIf="activeProjectsTab === 'active'"` wraps the Active project grid + the new `+ New` tile
- `*ngIf="activeProjectsTab === 'completed'"` wraps the Completed project grid

Past section becomes a collapsed accordion **below the Active tab content** — same chevron-expand pattern as today. Don't add Past as a third tab.

Drop the panel header for the Active section ("Active Projects" eyebrow). The hero tabs cover the labelling now. Container becomes full-width with no border, no panel chrome, no background tint.

Also: while you're in there, **confirm `navMode` defaults to `'tabs'`** so the hero tab band actually renders. If something in recent commits flipped the default to `'sidenav'`, fix that — the tabs are configured correctly but the hero only displays them when `navMode === 'tabs'`. If the user has flipped it manually, leave the user's preference alone; just fix the default.

### 4. Add "+ New" card after the last project

After the last project card in the Active grid, render a tile in the same dimensions as a project card. Treatment:

- Dashed border (`2px dashed var(--color-border)` or similar)
- `--theme-bg` or transparent background
- Centred content: Lucide `plus` icon (size 32-40px, `--color-text-muted` color), label below: `New {{ projectLabel }}` (e.g., `New Project` / `New Event`)
- Hover: border solidifies to `--theme-accent`, icon + text shift to `--theme-accent`
- Click: opens the existing `CreateProjectService` modal (same handler the launcher tile uses on home / agent)
- Aria-label: `Create new {{ projectLabel.toLowerCase() }}`

The tile sits as the **last item** in the Active grid only (don't render in COMPLETED or Past).

## Files in scope

- `client-angular/src/app/features/projects/projects-list.component.ts` — all template + style changes
- Possibly `client-angular/src/styles.css` — only if any new shared rules need to live there (e.g., gradient text helper); prefer component-scoped

## What NOT to do

- **Don't change the project model** or any backend route. The card pulls from whatever `ProjectService` returns today; if `4 New` notification count needs a new field, plumb it as a computed property in the component for now (`project.action_needed_count` or similar — pull from the existing data if available, default 0 otherwise).
- **Don't extract a `<app-project-card>` component.** Single-page reuse, no second consumer yet. Per WORKING_STANDARDS Extract Before Duplicate — not warranted until a second page hosts the same card.
- **Don't add per-section visibility flags** to ConfigService. The Active / COMPLETED / Past sections are intrinsic to `/projects`.
- **Don't redesign COMPLETED or Past cards** in this prompt. They use the same card markup as Active — just rendered inside collapsed accordion sections. The visual refresh applies to the card itself, so COMPLETED + Past inherit the new look automatically.
- **Don't touch the top-nav, dashboard, agent, or other surfaces.** Scoped to `/projects` only.

## Verify

- `/projects` Active section: cards bigger, REF chip above name, status pill below name, supplier count + relative time, big gradient `Ballpark` cost at the bottom.
- Notification badge appears top-right on cover image only when a project has `> 0` action-needed items.
- No "Active Projects" header. Container fills the page width.
- COMPLETED section still has its accordion header + chevron (collapsed by default, expands cleanly).
- Past section same.
- `+ New {projectLabel}` tile renders as the last item in the Active grid. Click opens the create-project modal.
- New tile doesn't appear in COMPLETED or Past.
- REF chip respects null gracefully (no chip rendered for projects without a ref).
- Theme switch via the drawer recolours the gradient text + status pill + notification badge appropriately.
- No regression on `/home`, `/agent`, top-nav.

When complete and verified, mark p0031 `Done` in `prompts/backlog.md` and write `p0031-projects-card-refresh-shipped.md` per the cc-onboarding ship-report convention.
