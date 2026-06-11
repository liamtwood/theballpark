# pV2-04 — Agent home + page-settings drawer

## Read first

1. `docs/CLAUDE.md` (workflow + ship-report process — when migrated; until
   then `WORKING_STANDARDS.md` + `prompts/cc-onboarding.md`)
2. `docs/DESIGN.md` (token-only styling, component selectors, drawer chrome —
   until migrated, use the equivalent sections in `WORKING_STANDARDS.md`)
3. `docs/ENGINEERING.md` (Rule 1–10 — especially Rule 9 precedence; v2 component
   standards; The Test)
4. `prompts/home-dashboard-plan.md` — section taxonomy and component decomposition
5. `prompts/home-dashboard-one-pager.html` — visual reference (open in browser)
6. **v1 prompts as design references — read for WHAT, not HOW:**
   - `prompts/p0014-agent-home-mockup.html` — layout shape (parchment / panels)
   - `prompts/p0017-page-config-drawer-migration-prompt.md` — drawer structure
   - `prompts/p0018-dashboard-section-toggles-prompt.md` — flag names + effects
   - `prompts/p0019-launcher-grid-prompt.md` — tile set + Lucide icons
   - `prompts/p0023-hero-customisation-prompt.md` — hero customisation fields
   - `prompts/p0032-hero-color-global-and-drawer-tabs-shipped.md` — two-tab drawer organisation (Dashboard / General)
7. `prompts/pV2-AUDIT-03-api-audit-checklist-shipped.md` — for the per-endpoint walk
8. This prompt

## Goal

Port v1's agent home + page-settings drawer to v2, rebuilt in v2 patterns.
Single prompt; one branch; ship the agent variant complete before the supplier
variant (pV2-05) starts.

After this lands, an agent signed into `/home` sees:

- Hero (title + subtitle wired to configured mode; cog icon opens drawer)
- Stats strip (4 cells, real data)
- Three-column body: left panel sections + centre launcher grid + right panel sections
- Cog → page-settings drawer with two tabs (Dashboard / General), section
  visibility toggles, hero title-mode dropdown, hero color toggle, label fields
- All persisted to `org_type_config.payload` per org type

No supplier code paths. No `<app-home-page>` role switch yet — `/home` is
agent-only for this prompt; pV2-05 introduces the role variant + supplier
components.

## v1 prompts describe WHAT — Angular 21 changes HOW

Per `docs/ENGINEERING.md` Rule 9 (precedence): if the referenced v1 prompts
contain code patterns that violate v2 hygiene — `@Input` / `@Output` /
`EventEmitter`, constructor injection, `*ngIf` / `*ngFor`, `<p-sidebar>`,
`localStorage` page-settings caching, raw color literals — implement the v2
equivalent and flag the deviation in your ship report under "Spec-hygiene
precedence deviations." The v1 prompts settle WHAT to build (sections,
fields, flags, tiles, drawer organisation). v2 standards settle HOW.

Concretely:

| v1 spec said | v2 implementation |
|---|---|
| `@Input() icon: string` | `readonly icon = input.required<string>()` |
| `@Output() clicked = new EventEmitter()` | `readonly clicked = output<void>()` |
| `constructor(private api: ApiService)` | `private api = inject(ApiService)` |
| `*ngIf="config.showQuickActions"` | `@if (config().showQuickActions) { ... }` |
| `*ngFor="let p of projects$ \| async"` | `@for (p of projects(); track p.id) { ... }` |
| `<p-sidebar styleClass="bp-drawer">` | `<p-drawer styleClass="bp-drawer">` |
| `<p-dropdown>` | `<p-select>` |
| `<p-inputSwitch>` | `<p-toggleSwitch>` |
| `<p-tabView>` | `<p-tabs>` |
| BehaviorSubject + async pipe | Signals + `httpResource()` / `resource()` |
| `localStorage` page-settings cache | `org_type_config` DB-only via signal cascade |
| `<div class="bp-foo">` inside selector | `host: { class: 'bp-foo' }` on the component |
| `text-slate-500` / `bg-white` | `text-secondary` / `bg-surface` (v2 build fails on raw) |

## Naming + folder structure

```
client-v2/src/app/pages/home/
├── home-agent.component.ts        ← <app-home-agent> — agent variant page
├── home-agent.routes.ts           ← agent route data (hero defaults, etc.)
└── sections/
    ├── stats-strip.component.ts          ← <app-stats-strip>
    ├── upcoming-card.component.ts        ← <app-upcoming-card>
    ├── quick-actions-card.component.ts   ← <app-quick-actions-card>
    ├── recent-activity-card.component.ts ← <app-recent-activity-card>
    ├── credits-card.component.ts         ← <app-credits-card>
    └── saved-suppliers-card.component.ts ← <app-saved-suppliers-card>

client-v2/src/app/shell/page-settings-drawer/
├── page-settings-drawer.component.ts     ← <app-page-settings-drawer>
└── controls/
    ├── settings-toggle-row.component.ts  ← <app-settings-toggle-row>
    └── settings-select-row.component.ts  ← <app-settings-select-row>

client-v2/src/app/shared/launcher/
├── launcher-grid.component.ts            ← <app-launcher-grid>
└── launcher-tile.component.ts            ← <app-launcher-tile>

client-v2/src/app/core/
├── config/
│   ├── page-config.service.ts            ← signal-backed PageConfigService
│   └── page-config.types.ts              ← typed payload shape
├── dashboard/
│   └── dashboard.service.ts              ← /api/dashboard/* HTTP wrapper
└── projects/
    └── project-summary.service.ts        ← upcoming + active project reads
```

All new files. Don't touch `client-angular/` (v1 stays untouched per
plan-of-record).

## Component decomposition

### `<app-home-agent>` — page component

- Mounted at `/home` (route restructure: replace the current hello page mount
  with this component)
- Host class `bp-home-agent`
- Reads `auth.user()` + `pageConfig.config()` signals
- Renders:
  - `<app-page-hero>` with title + subtitle computed from configured title mode
  - Cog button in `hero-actions` slot opens the page-settings drawer
  - `<app-stats-strip>` (gated by `config().showStats`)
  - Three-column body (`.bp-home-agent__body`):
    - Left: `<app-upcoming-card>` (gated), `<app-quick-actions-card>` (gated), `<app-recent-activity-card>` (gated)
    - Centre: `<app-launcher-grid variant="agent">`
    - Right: `<app-credits-card>` (gated), `<app-saved-suppliers-card>` (gated)
  - `<app-page-settings-drawer>` mounted at host level, visibility driven by
    a signal

### `<app-page-hero>` integration

Existing component (pV2-01c). For this prompt the hero needs to accept
hero-actions slot content for the cog. Already supports it. The cog click
flips the page-settings drawer `visible` signal.

### Section card primitive

All section cards share the same chrome — eyebrow row (icon + small caps
label) + body. Extract `<app-section-card>` if not already in `shell/` or
`shared/` from another prompt. Otherwise keep inline per card; CC's call.
Per ENGINEERING.md "Extract Before Duplicate", three pages with the same
chrome triggers extraction.

Each card:
- Standalone, OnPush, `host: { class: 'bp-section-card' }`
- Fetches its own data via `httpResource()`
- Renders eyebrow with Lucide icon + label
- Renders body that handles three states (loading / empty / data) via
  `@if (resource.isLoading()) ... @else if (...).length === 0 ...`
- Three states per ENGINEERING.md Rule 5 — error path warns to console for 5xx, silent for 401/404

### `<app-launcher-grid variant="agent">`

5 tiles per the v1 set (p0019):

| Tile | Icon (Lucide) | Action |
|---|---|---|
| + Add project | `folder-plus` | Opens create-project modal (stub for this prompt — opens an alert with TODO message) |
| View {Events} | `folder-open` | router → `/projects` (stub route — show empty page if route doesn't exist) |
| Inbox | `inbox` | router → `/inbox` (stub) |
| Marketplace | `store` | router → `/marketplace` (stub) |
| Profile | `circle-user` | router → `/settings/profile` (stub) |

Stubs route to placeholder components that render "Coming soon" so the
navigation works. Real pages land in pV2-05/06/07/08.

First tile (primary CTA) uses `class="bp-launcher-tile--primary"` — vivid
gradient (`--bp-gradient` + `--bp-text-on-gradient`). Other tiles use surface
+ secondary text per DESIGN.md token taxonomy.

`<app-launcher-tile>`:
- `input.required<string>()` for `icon`, `label`, `href`
- Optional `input<boolean>('primary')` defaults `false`
- `host: { class: 'bp-launcher-tile' }` + variant modifier when primary
- Click → `router.navigate([href()])`

### `<app-page-settings-drawer>` — the heart

PrimeNG `<p-drawer styleClass="bp-drawer" position="right" [(visible)]="open">`.
Header: eyebrow "PAGE SETTINGS" + title "Customise your home". Body:
two-tab structure via `<p-tabs>`:

**Tab 1 — Dashboard** (per p0032):
- Hero title — `<app-settings-select-row label="Title">` with options:
  - Greeting (default — "Welcome back, {firstName}")
  - Username — "{displayName}"
  - Org name — "{activeOrgName}"
  - Fixed text — opens an inline `<input pInputText>` for free text
- Hero subtitle — `<app-settings-select-row label="Subtitle">` typed text input
- Sections — `<app-settings-toggle-row>` per section (5 toggles):
  - Stats strip
  - Upcoming events
  - Quick Actions
  - Recent Activity
  - Credits
  - Saved Suppliers

**Tab 2 — General** (per p0023 + p0032):
- Hero color — `<app-settings-select-row>` with options:
  - Theme (default — `--theme-soft` wash)
  - None (transparent)
- Hero align — Left / Center
- Labels — text inputs for:
  - `creditLabel` ("Balls" default)
  - `eventLabel` ("Project" default)
  - `clientLabel` ("Client" default)

Save-on-change (no Cancel / Save buttons in this drawer per p0017's pattern).
Every change → `pageConfig.update(payload)` → POST to
`/api/config/:orgType` → signal updates → UI reflects instantly.

`<app-settings-toggle-row>`: label left + `<p-toggleSwitch>` right; `host: { class: 'bp-settings-row' }`.
`<app-settings-select-row>`: label left + `<p-select>` or input right; same chrome.

### `PageConfigService`

Signal-backed:

```typescript
@Injectable({ providedIn: 'root' })
export class PageConfigService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly _config = signal<PageConfigPayload | null>(null);

  readonly config = this._config.asReadonly();

  // Computed individual flags (linkedSignal for derived UI state, optional)
  readonly showStats          = computed(() => this._config()?.showStats          ?? true);
  readonly showUpcoming       = computed(() => this._config()?.showUpcoming       ?? true);
  readonly showQuickActions   = computed(() => this._config()?.showQuickActions   ?? true);
  readonly showRecentActivity = computed(() => this._config()?.showRecentActivity ?? true);
  readonly showCredits        = computed(() => this._config()?.showCredits        ?? true);
  readonly showSavedSuppliers = computed(() => this._config()?.showSavedSuppliers ?? true);

  async load(): Promise<void> {
    const u = this.auth.user();
    if (!u?.activeOrgType) return;
    const cfg = await firstValueFrom(this.api.get<PageConfigPayload>(`/api/config/${u.activeOrgType}`));
    this._config.set(cfg ?? {});
  }

  async update(patch: Partial<PageConfigPayload>): Promise<void> {
    const next = { ...(this._config() ?? {}), ...patch };
    this._config.set(next);   // optimistic
    try {
      await firstValueFrom(this.api.put<void>(`/api/config/${this.auth.user()!.activeOrgType}`, next));
    } catch (err) {
      // Roll back optimistic update on save failure.
      // See ENGINEERING.md §"Catch blocks justify themselves" — 5xx logged, signal reverted.
      console.warn('[PageConfig] save failed; reverting', err);
      // Reload from server to recover ground truth.
      await this.load();
    }
  }
}
```

`load()` called from `main.ts` initializer chain AFTER `AuthService.loadSession()` —
config depends on knowing `activeOrgType`.

If `auth.user()?.activeOrgId` is null (orgless), don't call — return early.
The orgless user is on `/onboarding` not `/home`.

## Server endpoints needed

### Existing — reuse

| Endpoint | Status |
|---|---|
| `GET /api/config/:orgType` | Exists (from v1 p0021). Returns the org_type_config payload. Gate via v2 router (`requireActiveMembership`) for v2 callers; v1 still reaches it via its own auth. |
| `PUT /api/config/:orgType` | Exists. Same gating. Requires `org.invite_member` perm (admin-only — same gate as Settings → Team). |

If the existing endpoint isn't already in the v2 router stack, mount it there
for v2 calls. If gating differs (v1's old `requirePlatformAdmin` vs v2's
`can(orgType, isAdmin, 'org.invite_member')`), add the v2 gate as a
middleware applied in v2 router's mount path.

### New — for section data

```
GET /api/dashboard/stats
  → returns { active, openBriefs, awaiting, credits }
  → orgScoped by req.user.org_id
  → MUST walk the AUDIT-03 API checklist

GET /api/dashboard/upcoming?limit=3
  → returns upcoming projects (next 3) with id / name / clientName / dateLabel
  → orgScoped

GET /api/dashboard/activity?limit=10
  → returns recent activity events with id / actorName / action / timeRelative
  → orgScoped

GET /api/credits/balance
  → returns { balance, currency }
  → orgScoped (already a v1 endpoint likely — REUSE; verify path)

GET /api/suppliers/saved?limit=4
  → returns saved supplier orgs with id / name / logoUrl
  → orgScoped (v1 endpoint exists for favourites; verify path / shape)
```

Each new endpoint:
- Zod schema for any query params (e.g. `limit` bounded 1-50)
- Walks the API audit checklist
- Uses pool.js read (no transactions needed)
- 200 on success, 401 if no membership (via `requireActiveMembership`)

For endpoints where v1 already has equivalents, **REUSE the v1 implementation
through the v2 router** rather than duplicating. Both apps query the same
schema; the data shape is consistent.

If v1's endpoint returns a different shape than this prompt expects, add a
small projection in the route handler (one column rename, one date format
change) rather than duplicating the underlying service.

## Page-settings payload shape

`org_type_config.payload` JSONB — extend the v2 surface:

```typescript
export interface PageConfigPayload {
  // Hero
  heroTitleMode?:  'greeting' | 'username' | 'orgName' | 'fixed';
  heroTitleFixed?: string;        // when heroTitleMode === 'fixed'
  heroSubtitle?:   string;
  heroColor?:      'theme' | 'none';
  heroAlign?:      'left' | 'center';

  // Section toggles
  showStats?:           boolean;
  showUpcoming?:        boolean;
  showQuickActions?:    boolean;
  showRecentActivity?:  boolean;
  showCredits?:         boolean;
  showSavedSuppliers?:  boolean;

  // Labels
  creditLabel?: string;
  eventLabel?:  string;
  clientLabel?: string;
}
```

All fields optional with sensible defaults via `??` in computeds — partial
payloads are valid. New users see defaults; admin's choices overlay.

## Routes update

`/home` now mounts `<app-home-agent>` (replaces the current hello page). The
shell parent (with `requiresOrgGuard` from pV2-02b) continues to wrap the
shell child routes. Hello stays mounted somewhere if you want a debug page;
otherwise retire it.

```typescript
{
  path: '',
  canActivate: [requiresOrgGuard],
  component: AppShellComponent,
  children: [
    {
      path: 'home',
      loadComponent: () =>
        import('./pages/home/home-agent.component').then(m => m.HomeAgentComponent),
      data: { /* hero default fallbacks */ }
    },
    // existing children: settings/team, etc.
    // stub routes for launcher tile targets (each renders "Coming soon")
    { path: 'projects',           loadComponent: () => import('./pages/stub/coming-soon.component').then(m => m.ComingSoonComponent), data: { feature: 'Projects' } },
    { path: 'inbox',              loadComponent: () => import('./pages/stub/coming-soon.component').then(m => m.ComingSoonComponent), data: { feature: 'Inbox' } },
    { path: 'marketplace',        loadComponent: () => import('./pages/stub/coming-soon.component').then(m => m.ComingSoonComponent), data: { feature: 'Marketplace' } },
    { path: 'settings/profile',   loadComponent: () => import('./pages/stub/coming-soon.component').then(m => m.ComingSoonComponent), data: { feature: 'Profile' } },
  ],
},
```

`<app-coming-soon>` renders the page hero with the feature name as title and
"Coming soon — pV2-XX" as subtitle. ~30 LOC.

## Tests (per Rule 8)

Pure functions in this prompt's scope:
- Hero title derivation (mode + user → string) — input: `('greeting', 'Liam')` → output: `'Welcome back, Liam'`
- Greeting selector by current local hour (if implemented) — boundary tests
- `PageConfigPayload` partial-merge logic
- Section visibility flag fallback (undefined → default)

Add to `client-v2/test/`. Aim for ~15 specs total in this prompt.

## Acceptance criteria

### Layout
1. `/home` renders `<app-home-agent>` after Google sign-in for an agency admin
2. Hero shows the configured title (defaults to "Welcome back, {firstName}") + subtitle
3. Cog icon visible in hero-actions slot; click toggles drawer
4. Three-column body responsive at desktop; stacks to single column under 768px
5. Section eyebrows render with Lucide icons matching the section's role

### Sections
6. Each section card fetches its data via `httpResource()` — verifiable by
   stopping the server and observing the card switches to error state (not
   silent blank)
7. Each section has three states: loading / empty / data — all reachable in QC
8. Section visibility toggles in the drawer cause the section to mount/unmount
   immediately (signal-driven)

### Launcher
9. Five tiles render in centre column — first tile uses gradient (vivid pink+green)
10. Click each tile → routes to corresponding stub route (or modal stub for
    Add project)
11. Stub routes render "Coming soon" with the feature name

### Page-settings drawer
12. Cog opens `<p-drawer>` from the right, 480px wide
13. Drawer body has two tabs (`<p-tabs>`): Dashboard / General
14. Dashboard tab: hero title mode dropdown + subtitle input + 6 section toggles
15. General tab: hero color toggle + hero align toggle + 3 label inputs
16. Every change auto-saves (PUT `/api/config/:orgType`); UI reflects instantly
17. Reload the page after toggling: state restored from DB (proves persistence)
18. Two admins from same org see the same config (cross-admin sync)

### Permissions
19. Non-admin (agency_member) does NOT see the cog icon; trying to call PUT
    directly returns 403
20. `/api/dashboard/*` endpoints walk the API audit checklist (recorded in
    ship report)

### v2 hygiene compliance (auto-fail criteria)
21. Zero `*ngIf` / `*ngFor` / NgModules / `any` types
22. Zero raw color Tailwind utilities (build fails on them; verify)
23. Every new component uses `host: { class: 'bp-...' }` — no inner wrapper
24. Every new HTTP read uses `httpResource()` or `resource()` — zero raw `.subscribe()` in new code
25. Every catch block in new code has a comment justifying silence OR logs
26. Permissions matrix parity test still green (`/test/permissions.parity.spec.ts`)
27. All new pure functions have unit tests (Rule 8)

### Smoke
28. Old `client-angular/` on port 4200 still works unchanged
29. Switching dev users on `/home` updates greeting + org name + visible sections
30. Suspending an admin (via `/settings/team`) takes effect on their next request
    to `/api/config/:orgType` (returns 403)

## Out of scope

- Supplier variant of home — pV2-05
- Real launcher tile targets beyond stubs — pV2-05/06/07
- Marketing copy refinement
- Per-user dashboard config (overrides above org_type_config) — separate prompt
- Drag-to-reorder sections
- AI insights / suggestions
- Mobile-specific layouts beyond the responsive stack
- Migrating any v1 component verbatim (rebuild fresh, don't copy)

## Concerns not in spec

Per ENGINEERING.md §"Concerns not in spec" — mandatory section in your ship
report. Items I'd particularly want to know:

- Anything you spotted while reading the v1 reference prompts that's stale
  (out-of-date examples, naming drift, etc.)
- Whether `org_type_config` payload shape needs any schema-level adjustment
  for the new v2 fields (or if extending the JSONB is fine)
- Whether existing v1 endpoints for `/api/credits/balance` etc. need any
  shape projection or are safe to reuse directly
- The walk through the API audit checklist for any new endpoints
- Any sweep-completeness concerns — sections you classified as "verified
  inheritance" vs "explicitly skipped"

## Bump + ship

1. Version chip `[Dev v2] v2.09a` (next after AUDIT-03's v2.08a)
2. Suggested commits (one branch, multiple commits):
   - `feat(v2.09a-pt1): PageConfigService + drawer chrome + ToggleRow/SelectRow primitives`
   - `feat(v2.09a-pt2): launcher tile + grid + stub routes`
   - `feat(v2.09a-pt3): home-agent layout + 6 section cards`
   - `feat(v2.09a-pt4): /api/dashboard/* endpoints + Zod schemas + tests`
   - `feat(v2.09a): wire it all together + auto-save + ship report`
3. Ship report `prompts/pV2-04-agent-home-shipped.md` with mandatory
   "Concerns not in spec" section + per-endpoint API audit checklist walk for
   every new server route
4. Flip backlog row to `Shipped`; await audit-before-shipped pass for Done

## Reply with

- Commit SHAs (one per logical chunk)
- 30/30 acceptance verified per the criteria
- API audit checklist walk for every new endpoint
- Concerns not in spec
- Confirmation v1 on 4200 unchanged
