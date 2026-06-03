# Shipped — p0019 — Launcher grid (action-tile + home centre column + agent page)

**Version:** v1.65hP / hQ / hR (three atomic commits)
**Shipped:** see commit log
**Prompt:** `p0019-launcher-grid-prompt.md`

## What changed
The home centre column and the agent page are now a shared **launcher** —
a grid of action tiles routing to the app's main surfaces. The events
grid (Active / Inactive / Past) left the dashboard; it returns on the
dedicated `/projects` page (p0020).

## §1 — Extract `<app-action-tile>` (v1.65hP)
- New `shared/components/action-tile/action-tile.component.ts`. Selector
  `<app-action-tile>`, standalone, OnPush. Inputs `icon` / `title` /
  `subtitle?` / `ariaLabel?`; Output `(action)`. Presentational only —
  routing is wired by the parent.
- Card chrome lifted verbatim from the agent page (`.bp-agent-card*` →
  `.bp-action-tile*`): 20px radius, `--shadow-md`, 40px themed-soft icon
  square, focus-visible accent outline. Now the canonical tile shape.
- Bare `LucideAngularModule` in the tile (renders a runtime icon name;
  resolves from the global `LUCIDE_ICONS` provider). Consumers register
  the names they pass.
- `agent.component.ts` rebuilt to mount the tile (same folder card) —
  pixel-identical; dropped the inline markup, `.bp-agent-card*` styles,
  and the now-unused `LucideAngularModule` import.

## §2 — Home centre column → launcher grid (v1.65hQ)
- Centre column is `<div class="bp-launcher-grid">` of 5 `<app-action-tile>`:
  Add `{projectLabel}` / View `{projectLabel}`s / Inbox / Marketplace /
  Profile. Always visible; `auto-fit minmax(220px,1fr)`.
- Nav: `openNewProject()` → `CreateProjectService.open()`;
  `goToInbox` → `/messages`, `goToMarketplace` → `/suppliers` (registered).
  **`goToProjects` → `/projects`** (no list route yet — wildcard sends it
  home until p0020; wired to the real path now).
  **`goToProfile` → `/settings`** (no `/profile` route exists; Settings is
  the account surface — deviates from the prompt's suggested `/profile`,
  per "use what's actually registered").
- Removed the project-card machinery that left with the centre column:
  the `...` menu (`toggleMenu` / `onDocumentClick` / `onMenuAction` /
  `duplicateProject` / `confirmDelete`), image-upload + `onImagesUpdated`
  + `openUploadPanel`, `extractYear`, and the
  `openMenuProjectId` / `uploadPanelProjectId` / `inactiveOpen` /
  `pastOpen` / `uploadSupplierPanelId` state. `activeProjects` /
  `completedProjects` / `loadProjects()` / `projectStatus()` stay (stats
  bar + Upcoming + mobile list still read them).
- Dropped now-unused imports/providers: CardModule, ConfirmDialogModule,
  ToastModule, ImageUploadPanelComponent, ConfirmationService,
  MessageService, EstimateDrawerService, HostListener. Added
  ActionTileComponent.
- Trimmed Quick Actions: dropped Browse Marketplace; kept Browse
  Suppliers + Invite Member.
- Project-card CSS retained with a `TODO(p0020)` (comes back with
  `/projects`; not deleting styles about to be reused, per spec).
- Registered `FolderPlus` + `CircleUser` in `core/icons.ts`.

## §3 — Agent page (v1.65hR)
- Single tile replaced with the same 5-tile set as home (identical
  icons / titles / subtitles / wiring). Injected `Router` + the four nav
  handlers. Existing centred `repeat(auto-fit, minmax(280px,350px))` grid
  holds 3-on-top / 2-below.

## showActiveProjects cleanup (p0018 dead flag)
Removed from `PlatformConfig`, `ConfigService` (default + getter), the
drawer (the "Active {projectLabel}s" SECTIONS checkbox + draft/mirror/
save), and the dashboard `pageCfg` + `bodyGridColumns` (centre is now
always present). No migration (defaults true, single-user).

## Diff
- hP: +145 / -106 (extract). hQ: +99 / -365 (home — big net removal).
  hR: agent 5-card set. Three clean `ng build`s.

## Verify (per prompt spec)
Build-verified. Visual QC for Liam:
- ☐ `<app-action-tile>` shared; agent rebuilt to use it (commit 1) was pixel-identical.
- ☐ Home centre column: 5 tiles — Add {Event} / View {Event}s / Inbox / Marketplace / Profile. Labels interpolate `projectLabel`.
- ☐ Add {Event} opens the create-project modal; Inbox → /messages, Marketplace → /suppliers navigate.
- ☐ **View {Event}s → /projects bounces to home today** (no page until p0020) — expected.
- ☐ **Profile → /settings** (decision: no /profile route; confirm that's the intended target).
- ☐ Active / Inactive / Past gone from home; stats bar still shows the active count.
- ☐ Quick Actions shows Browse Suppliers + Invite Member only.
- ☐ Agent page renders the same 5 tiles, centred.
- ☐ Theme switch propagates to tile chrome (soft icon bg / accent glyph / accent focus outline).
- ☐ Left + right dashboard columns unchanged.

**Two routing calls to confirm:** View {Event}s → `/projects` (placeholder
until p0020) and Profile → `/settings` (no `/profile` route). Both one-line
repoints if you want them elsewhere.

p0019 → `Done` in `prompts/backlog.md`. Hard-refresh — chip reads `[Dev] v1.65hR`.
