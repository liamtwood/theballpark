# Shipped — p0037 — inbox-v2 shared shell (hero only)

**Version:** v1.69e
**Shipped:** see commit log
**Prompt:** `p0037-inbox-v2-shared-shell-prompt.md`

## What changed
- **NEW** `client-angular/src/app/shared/components/messages-inbox-v2/messages-inbox-v2.component.ts` — shared, reusable standalone component `app-messages-inbox-v2` (OnPush). Renders only a padded wrapper `.bp-inbox-v2` (`24px` padding, `max-width:1400px`, centered) + `.bp-inbox-v2--compact` modifier. Hero is rendered globally by app-shell, so nothing local below the wrapper yet.
- **NEW** `client-angular/src/app/features/messages/inbox-v2.component.ts` — thin route wrapper `app-inbox-v2` (OnPush), mounts `<app-messages-inbox-v2 viewerRole="agency"/>`.
- **MODIFIED** `client-angular/src/app/app.routes.ts` — new `inbox-v2` route, lazy `loadComponent`, hero defaults via route data (`heroTitle: 'Inbox'`, `heroSub: 'Project conversations.'`, `back: '/home'`, `heroAlign: 'left'`).
- **MODIFIED** `client-angular/src/app/features/messages/inbox-v2.schematic.yaml` — status block: `built_so_far: [hero]`, `next_to_code: [search-row]`.
- **MODIFIED** `client-angular/src/environments/environment.ts` — version chip `[Dev] v1.69e`.

## Reusable contract (locked in, not yet gating)
- **Scope inputs:** `scopedToProjectId?`, `scopedToSupplierId?`, `scopedToItemId?`, `viewerRole: 'agency' | 'supplier' = 'agency'`.
- **Chrome inputs:** `showHero`, `showSearchRow`, `showFilterDrawer`, `showTreeRail` (all default `true`), `compact` (default `false`).
- **Events:** `threadSelected: EventEmitter<string>`, `messageSent: EventEmitter<any>`.
- Flags don't gate anything this prompt — the API surface is fixed so future embeds (project page, item card) compile against the final shape.

## Diff
Net: **+~90 / -0** — two new small standalone components + one route block; no existing code paths touched (v1 inbox untouched).

## Verify (per prompt spec)
- ✓ 1. `/inbox-v2` loads without errors (the only console errors were `ERR_CONNECTION_REFUSED` to global hydration endpoints `config/agency` / `feedback/categories` / `org` / `org/users` during the window the backend wasn't up; post-backend reload added zero new failures; inbox-v2 makes no HTTP calls).
- ✓ 2. Hero renders title **"Inbox"** + subtitle **"Project conversations."**
- ✓ 3. Back arrow present, wired to `/home` via `data.back`.
- ✓ 4. Cog icon present in hero → page-settings drawer (global HeroSettingsService behavior).
- ✓ 5. Below the hero: empty padded `.bp-inbox-v2` (`padding:24px`, `max-width:1400px`, 0 children).
- ✓ 6. No template warnings; clean `ng build`.
- ✓ 7. `<app-messages-inbox-v2>` is a self-contained standalone component (defaults supplied) — mountable anywhere; renders the same empty padded div.

## Notes for QC / next prompt
- **`heroAlign: 'left'` in route data is not currently consumed by app-shell** — `updateFromRoute()` reads `heroTitle` / `heroSub` / `back` from route data but not `heroAlign` (alignment comes from page-settings / config default). Included per the prompt's route block and the schematic (`align.source: route.data.heroAlign`); wiring app-shell to read it is a separate change (out of scope for "hero only"). `/inbox-v2` therefore defaults to centre align until a page-setting overrides it — flag if you want the route-data default wired.

p0037 flipped to `Done` in `prompts/backlog.md`; schematic `built_so_far: [hero]`. Hard-refresh — chip reads `[Dev] v1.69e`.
