# Shipped — p0024 — `/projects` landing page + Projects nav button

**Version:** v1.66e
**Shipped:** see commit log
**Prompt:** `p0024-projects-landing-page-prompt.md`

## What changed
The `View Projects` launcher tile (p0019) now lands on a real `/projects`
page, and a `Projects` button in the top-nav reaches it directly.

## 1. `/projects` page (new `ProjectsListComponent`)
- New `features/projects/projects-list.component.ts` — standalone, OnPush.
- Two sections, vertical stack: **Active** (expanded) / **Completed**
  (collapsed), accordion headers with `folder-open` icon + count badge +
  chevron. (Shipped as Active/Inactive/Past; v1.66f renamed Inactive →
  Completed and dropped the duplicate Past carousel per Liam.)
- Projects pulled from `ProjectService`, bucketed via `projectStatus()`
  (codelist-driven, same logic the dashboard used).
- Hero pushed via `ShellContextService` (`heroColor` + `heroSub` from
  `homePageLabel`) so the p0023 drawer customisation (Title / Subtitle /
  Hero color) applies — title computed by the AppShell from
  `heroTitleMode`.
- Route registered in `app.routes.ts` as an AppShell child — **no
  `AuthGuard`** (the prompt suggested one, but no route here uses a
  per-route guard; auth is handled at the shell level, so I matched the
  codebase).

### Reuse (the important part)
The project-card markup + handlers were **deleted** from the dashboard in
p0019 §2 — they lived only in git history at `v1.65hP`. Recovered from
there into the new component:
- Card markup (`<p-card>`, status pill, client chip, ref chip, cost,
  overflow menu, image-upload panel).
- Handlers: `projectStatus`, `toggleMenu`, `onDocumentClick`,
  `onMenuAction`, `duplicateProject`, `confirmDelete`, `onImagesUpdated`,
  `extractYear`, `openNewProject`.
- Infra re-imported: ProjectService, CodelistService, EstimateDrawerService,
  CreateProjectService, ImageUploadPanelComponent, CardModule,
  ConfirmDialog/Toast modules + Confirmation/Message services, EventDate /
  CompactCurrency pipes.
- **Extract-before-duplicate:** the pre-p0019 dashboard duplicated the
  ~80-line card across the Active + Inactive grids; recovered **once** as
  a single `<ng-template #cardTpl>` reused by both via `*ngTemplateOutlet`.
- Section-header `folder-open` (per spec) avoids the unregistered
  `folder-minus` / `archive` icons the old dashboard used.

## 2. Projects top-nav button
- `top-nav.component.ts`: new `<a routerLink="/projects">`, `folder-open`
  icon, label `{{ projectLabel }}s` (Events / Shows / …), between Home and
  Agent, `routerLinkActive`. Added `projectLabel` field synced from
  `config$`. Universal (top-nav isn't persona-gating these links;
  per-persona deferred to p0020).

## Dashboard cleanup (closes `TODO(p0020)`)
Deleted the now-truly-dead project-card CSS the dashboard had retained
since p0019 (`.bp-project-card*` / `.bp-card-*` / `.bp-past-*` /
`.bp-section-new-btn` / `.bp-section-count` / `.bp-section-chev` /
`.bp-section-header--toggle` / `.bp-dash-card--collapsible`). Kept the
shared `.bp-section-header` / `.bp-section-title` / `.bp-section-icon` /
`.bp-empty` primitives — the left column still uses them.

## Diff
Net dominated by the new ~530-line `ProjectsListComponent` (markup +
handlers + CSS recovered from `v1.65hP`), offset by ~230 lines of dead CSS
removed from the dashboard. `ng build` clean.

## Verify (per prompt spec)
Build-verified. Visual QC for Liam:
- ☐ `View Projects` launcher tile (home) → lands on `/projects`.
- ☐ `Projects` (`Events`) top-nav button → same; highlights on `/projects`.
- ☐ Three sections: Active (cards visible) / Inactive (chevron, collapsed) / Past (chevron, collapsed). Expand/collapse works.
- ☐ Cards identical to the pre-p0019 dashboard — status pill colour, client chip, ref chip, cost, overflow menu (Estimate / Edit image / Copy / Delete).
- ☐ Hero honours the drawer Hero customisation (Title mode / Subtitle / Hero color).
- ☐ Theme switch recolours the page.
- ☐ No regression on `/home`, `/agent`, or the launcher grid.

p0024 → `Done` in `prompts/backlog.md`.
