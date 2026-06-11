# pV2-04b — Launcher-only `/home` for agent (replaces pV2-04)

## Read first

1. `docs/CLAUDE.md`
2. `docs/DESIGN.md` (especially §12 Lucide standard — v2 uses ONE global `pick()` in `app.config.ts`)
3. `docs/ENGINEERING.md` (Rule 9 precedence + all hygiene rules)
4. `docs/PROGRESS.md` (orientation)
5. `prompts/backlog.md` — confirm pV2-04 row reads `Superseded` and this row reads `Ready`
6. **v1 reference (this is what we're porting):**
   - `client-angular/src/app/features/home/home.component.ts` — `HomeComponent`, the v1 launcher-only home
   - `client-angular/src/app/shared/components/home-launcher/home-launcher.component.ts` — the launcher MASTER
   - `prompts/p0019-launcher-grid-prompt.md` — tile set + Lucide icons
   - `prompts/p0023-hero-customisation-prompt.md` — title mode + subtitle + align fields
   - `prompts/p0032-hero-color-global-and-drawer-tabs-shipped.md` — drawer's General-tab structure
7. This prompt

## Context — why this prompt exists

pV2-04 shipped a port of v1's `/dashboard` (data-rich: stats + 5 section cards
+ launcher), not v1's `/home` (launcher-only). Wrong surface. pV2-04 was hard-
reverted; this prompt replaces it with the correct port.

v1 has two surfaces:

| v1 route | v1 component | What it shows |
|---|---|---|
| **`/home`** | `HomeComponent` | **Launcher only.** Centred title + centred subtitle + 5 tiles. No hero band. Hidden via `hideHero: true` route data — the launcher owns its own centred chrome. |
| **`/dashboard`** | `DashboardComponent` | Stats strip + 5 section cards + launcher. The data-rich view. **Not being ported.** v1 stays as the failure mode for the dashboard concept; v2 has launcher-only home. |

This prompt ports ONLY the `/home` (launcher-only) surface. No dashboard. No
stats. No section cards. No `/api/dashboard/*` endpoints. No `DashboardService`.

## Goal

After this lands, an agent (signed in, has org) at `/home`:

- Sees centred title + centred subtitle + 5-tile launcher
- No shell hero band — launcher owns the chrome
- Cog icon (top-right of the page or alongside the launcher — your call) opens the page-settings drawer
- Drawer has ONE tab (General — there's no Sections tab on the home surface)
- Drawer changes save to `org_type_config` and persist across reloads
- Two admins from the same org see the same settings

No supplier variant. Supplier home is pV2-05.

## What v1's `HomeComponent` actually does

```typescript
// v1.68w — the default landing. Resolves a per-persona config (title +
// subtitle + tiles) and hands it to the shared <app-home-launcher> MASTER,
// which owns the centred hero + tile layout. The old data dashboard lives
// on at /dashboard.
//
// Route data: { hideHero: true, tabs: [] }  ← shell hero band suppressed
```

The component is THIN. It reads:
- Title (per-page config — Greeting / Username / Org Name / Fixed)
- Subtitle (per-page config — free text)
- Align (per-page config — left / center, defaults center)
- Tiles (per-persona — agent gets 5; supplier gets a different 5)

Then renders `<app-home-launcher>` with those inputs. The launcher MASTER
component is the whole page — centred title, centred subtitle, centred tile
grid.

## v1 prompts describe WHAT — Angular 21 changes HOW

Per `docs/ENGINEERING.md` Rule 9 (precedence): if the referenced v1 prompts
contain v1-era patterns (`@Input`, `*ngIf`, `<p-sidebar>`, constructor
injection, raw color literals, per-component `LucideAngularModule.pick({})`),
implement the v2 equivalent and flag in your ship report under "Spec-hygiene
precedence deviations."

| v1 spec said | v2 implementation |
|---|---|
| `@Input() icon: string` | `readonly icon = input.required<string>()` |
| `@Output() clicked = new EventEmitter()` | `readonly clicked = output<void>()` |
| `constructor(private api: ApiService)` | `private api = inject(ApiService)` |
| `*ngIf` / `*ngFor` | `@if` / `@for` |
| `<p-sidebar styleClass="bp-drawer">` | `<p-drawer styleClass="bp-drawer">` |
| `<p-dropdown>` | `<p-select>` |
| `<p-tabView>` | `<p-tabs>` |
| Per-component `LucideAngularModule.pick({})` | ONE global `pick()` in `app.config.ts` per DESIGN.md §12 |
| BehaviorSubject + async pipe | Signals + `httpResource()` |
| `localStorage` page-settings cache | `org_type_config` DB-only via signal cascade |
| `<div class="bp-foo">` wrapping inside selector | `host: { class: 'bp-foo' }` |
| `text-slate-500` / `bg-white` | `text-secondary` / `bg-surface` (v2 build fails on raw) |

## Component decomposition

```
client-v2/src/app/pages/home/
├── home-agent.component.ts        ← <app-home-agent> — agent variant page
└── (no sections folder — no section cards in this prompt)

client-v2/src/app/shared/launcher/
├── home-launcher.component.ts     ← <app-home-launcher> MASTER — owns centred
│                                     title + subtitle + tile grid
├── launcher-tile.component.ts     ← <app-launcher-tile>
└── launcher-tile.types.ts         ← LauncherTile interface

client-v2/src/app/shell/page-settings-drawer/
├── page-settings-drawer.component.ts  ← <app-page-settings-drawer>
└── controls/
    ├── settings-select-row.component.ts  ← <app-settings-select-row>
    └── settings-input-row.component.ts   ← <app-settings-input-row>

client-v2/src/app/core/config/
├── page-config.service.ts         ← signal-backed PageConfigService
└── page-config.types.ts           ← typed payload (General fields only)

client-v2/src/app/pages/stub/
└── coming-soon.component.ts       ← <app-coming-soon> — placeholder for tile targets
```

All new files. No section card components. No dashboard service.

### `<app-home-agent>` — page component

```typescript
@Component({
  selector: 'app-home-agent',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeLauncherComponent, PageSettingsDrawerComponent],
  host: { 'class': 'bp-home-agent' },
  template: `
    <app-home-launcher
      [title]="resolvedTitle()"
      [subtitle]="resolvedSubtitle()"
      [align]="resolvedAlign()"
      [tiles]="agentTiles" />

    @if (canEditSettings()) {
      <button class="bp-home-agent__cog" (click)="openSettings()" aria-label="Page settings">
        <lucide-icon name="settings" [size]="20" />
      </button>
    }

    <app-page-settings-drawer
      [visible]="settingsOpen()"
      (visibleChange)="settingsOpen.set($event)" />
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      padding: 24px;
    }
    .bp-home-agent__cog {
      position: absolute;
      top: 80px;     /* clear the shell header */
      right: 24px;
      width: 36px; height: 36px;
      border-radius: 18px;
      background: transparent;
      border: 1px solid var(--color-border-hairline);
      color: var(--color-text-secondary);
      cursor: pointer;
    }
    .bp-home-agent__cog:hover {
      background: var(--color-fill);
    }
  `]
})
export class HomeAgentComponent {
  private readonly auth = inject(AuthService);
  private readonly pageConfig = inject(PageConfigService);

  protected readonly settingsOpen = signal(false);
  protected readonly canEditSettings = computed(() => this.auth.user()?.isAdmin === true);

  protected readonly resolvedTitle = computed(() => {
    const u = this.auth.user();
    const c = this.pageConfig.config();
    switch (c?.heroTitleMode ?? 'greeting') {
      case 'username':  return u?.displayName ?? '';
      case 'orgName':   return u?.activeOrgName ?? '';
      case 'fixed':     return c?.heroTitleFixed ?? '';
      case 'greeting':
      default:          return `Welcome back, ${this.firstName(u?.displayName)}`;
    }
  });

  protected readonly resolvedSubtitle = computed(() =>
    this.pageConfig.config()?.heroSubtitle ?? 'What opportunities are we working on today?'
  );

  protected readonly resolvedAlign = computed<'left' | 'center'>(() =>
    this.pageConfig.config()?.heroAlign ?? 'center'
  );

  protected readonly agentTiles: LauncherTile[] = [
    { icon: 'folder-plus',  label: '+ Add project',      href: '/projects',        primary: true },
    { icon: 'folder-open',  label: 'View {events}',      href: '/projects',        primary: false },
    { icon: 'inbox',        label: 'Inbox',              href: '/inbox',           primary: false },
    { icon: 'store',        label: 'Marketplace',        href: '/marketplace',     primary: false },
    { icon: 'circle-user',  label: 'Profile',            href: '/settings/profile', primary: false },
  ];

  protected openSettings(): void {
    this.settingsOpen.set(true);
  }

  private firstName(displayName: string | null | undefined): string {
    if (!displayName) return '';
    const first = displayName.split(/\s+/)[0];
    return first || displayName;
  }
}
```

The cog button is positioned absolutely top-right of the page. Only renders
when `auth.user().isAdmin` (non-admins cannot edit page settings).

### `<app-home-launcher>` — the master, owns centred chrome

```typescript
@Component({
  selector: 'app-home-launcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LauncherTileComponent],
  host: { 'class': 'bp-home-launcher' },
  template: `
    <div class="bp-home-launcher__chrome"
         [class.bp-home-launcher__chrome--align-left]="align() === 'left'">
      <h1 class="bp-home-launcher__title">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="bp-home-launcher__subtitle">{{ subtitle() }}</p>
      }
    </div>

    <div class="bp-home-launcher__grid">
      @for (tile of tiles(); track tile.href) {
        <app-launcher-tile
          [icon]="tile.icon"
          [label]="tile.label"
          [href]="tile.href"
          [primary]="tile.primary ?? false" />
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 48px 24px 24px;
    }
    .bp-home-launcher__chrome {
      text-align: center;
      max-width: 720px;
    }
    .bp-home-launcher__chrome--align-left {
      text-align: left;
      align-self: flex-start;
      padding-left: 24px;
    }
    .bp-home-launcher__title {
      font-family: var(--font-display);
      font-size: 36px;
      font-weight: 400;
      color: var(--color-text);
      margin: 0 0 8px;
    }
    .bp-home-launcher__subtitle {
      font-size: 15px;
      color: var(--color-text-secondary);
      margin: 0;
    }
    .bp-home-launcher__grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(140px, 180px));
      gap: 16px;
      max-width: 960px;
    }
    @media (max-width: 768px) {
      .bp-home-launcher__grid {
        grid-template-columns: repeat(2, minmax(140px, 1fr));
      }
    }
  `]
})
export class HomeLauncherComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly align = input<'left' | 'center'>('center');
  readonly tiles = input.required<LauncherTile[]>();
}
```

NO `<app-page-hero>` band above this — the page is just `<app-home-agent>`
which contains `<app-home-launcher>` directly. The shell's transparent header
sits above. That's the whole page.

### `<app-launcher-tile>`

Per p0019 + the visual one-pager. First tile (`primary: true`) uses the vivid
gradient + white text per DESIGN.md §13.

```typescript
@Component({
  selector: 'app-launcher-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink],
  host: {
    'class': 'bp-launcher-tile',
    '[class.bp-launcher-tile--primary]': 'primary()',
    '[attr.role]': '"link"',
  },
  template: `
    <a [routerLink]="href()" class="bp-launcher-tile__link">
      <span class="bp-launcher-tile__icon">
        <lucide-icon [name]="icon()" [size]="20" [strokeWidth]="1.5" />
      </span>
      <span class="bp-launcher-tile__label">{{ label() }}</span>
    </a>
  `,
  styles: [`/* token-only — no raw colors */`],
})
export class LauncherTileComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly href = input.required<string>();
  readonly primary = input<boolean>(false);
}
```

### `<app-page-settings-drawer>` — single tab, General only

```typescript
@Component({
  selector: 'app-page-settings-drawer',
  /* p-drawer wrapping; single tab body, NOT p-tabs (one tab = no tab UI needed) */
  template: `
    <p-drawer [(visible)]="visibleProxy" position="right" styleClass="bp-drawer" [style]="{width:'420px'}">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">PAGE SETTINGS</span>
            <div class="bp-drawer-title">Customise your home</div>
          </div>
          <button class="bp-icon-btn" (click)="close()">
            <lucide-icon name="x" [size]="16" />
          </button>
        </div>
      </ng-template>

      <div class="bp-drawer-body">
        <app-settings-select-row
          label="Title"
          [options]="titleOptions"
          [value]="config()?.heroTitleMode ?? 'greeting'"
          (valueChange)="updateTitleMode($event)" />

        @if ((config()?.heroTitleMode ?? 'greeting') === 'fixed') {
          <app-settings-input-row
            label="Title text"
            [value]="config()?.heroTitleFixed ?? ''"
            (valueChange)="updateField('heroTitleFixed', $event)" />
        }

        <app-settings-input-row
          label="Subtitle"
          [value]="config()?.heroSubtitle ?? ''"
          (valueChange)="updateField('heroSubtitle', $event)" />

        <app-settings-select-row
          label="Position"
          [options]="alignOptions"
          [value]="config()?.heroAlign ?? 'center'"
          (valueChange)="updateField('heroAlign', $event)" />
      </div>
    </p-drawer>
  `,
})
```

Save-on-change. Every change → `pageConfig.update(patch)` → optimistic local
signal → server `PUT /api/config/:orgType` → rollback on 5xx (per Rule 5).

### `PageConfigService`

Slimmer than pV2-04's version. ONLY the General-tab fields:

```typescript
export interface PageConfigPayload {
  // Matches v1's /home page-settings drawer scope.
  heroTitleMode?:  'greeting' | 'username' | 'orgName' | 'fixed';
  heroTitleFixed?: string;        // only when heroTitleMode === 'fixed'
  heroSubtitle?:   string;
  heroAlign?:      'left' | 'center';

  // NOTE: no section visibility flags. No heroColor (we have no hero band).
  // Org-vocabulary labels (creditLabel / eventLabel / clientLabel) stay in
  // v1's ballpark-settings — out of v2 scope until a dedicated Org settings
  // prompt lands. Sections come back if/when /dashboard is ported (possibly
  // never — v1 stays as the failure mode).
}
```

Loaded at bootstrap AFTER `AuthService.loadSession()`. If user is orgless
(activeOrgId null), service returns early — orgless users are on /onboarding,
not /home.

### Stub routes

Five stub routes for the launcher tile targets, each rendering
`<app-coming-soon>`:

| Route | Coming-soon label |
|---|---|
| `/projects` | "Projects — coming soon" |
| `/inbox` | "Inbox — coming soon" |
| `/marketplace` | "Marketplace — coming soon" |
| `/settings/profile` | "Profile — coming soon" |

`/settings/team` already exists from pV2-03.

## Schema — make sure `org_type_config` exists

pV2-04 added the `org_type_config` table to `migrate-schemas.js` (closing a
gap from v1's p0021 that was never run against the shared DB). The hard
revert in this prompt removed those commits — **re-add the table** to
`migrate-schemas.js` per the same shape pV2-04 had. (Idempotent —
`CREATE TABLE IF NOT EXISTS`; mirror to public/preview/master.)

```sql
CREATE TABLE IF NOT EXISTS ${schema}.org_type_config (
  org_type   TEXT PRIMARY KEY CHECK (org_type IN ('agency', 'supplier', 'ballpark')),
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

INSERT INTO ${schema}.org_type_config (org_type, payload) VALUES
  ('agency',   '{}'::jsonb),
  ('supplier', '{}'::jsonb),
  ('ballpark', '{}'::jsonb)
ON CONFLICT (org_type) DO NOTHING;
```

Run `audit.add_audit_columns(schema, 'org_type_config')` for the universal
audit trigger.

Liam runs `cd server && npm run db:migrate:schemas` AFTER this prompt ships.

## Server endpoints

| Endpoint | Status |
|---|---|
| `GET /api/config/:orgType` | EXISTS — reuse. Gate via v2 router (`requireActiveMembership`). |
| `PUT /api/config/:orgType` | EXISTS — reuse. Same gating. Requires `org.invite_member` perm (admin-only). |

NO `/api/dashboard/*` endpoints — those were pV2-04 territory and are gone.

The PUT handler validates the payload via a Zod schema. Walk the API audit
checklist in your ship report.

## Routes update

```typescript
{
  path: '',
  canActivate: [requiresOrgGuard],
  component: AppShellComponent,
  children: [
    {
      path: 'home',
      loadComponent: () => import('./pages/home/home-agent.component').then(m => m.HomeAgentComponent),
    },
    // settings/team exists from pV2-03
    // stub routes
    { path: 'projects',         loadComponent: () => import('./pages/stub/coming-soon.component').then(m => m.ComingSoonComponent), data: { feature: 'Projects' } },
    { path: 'inbox',            loadComponent: () => import('./pages/stub/coming-soon.component').then(m => m.ComingSoonComponent), data: { feature: 'Inbox' } },
    { path: 'marketplace',      loadComponent: () => import('./pages/stub/coming-soon.component').then(m => m.ComingSoonComponent), data: { feature: 'Marketplace' } },
    { path: 'settings/profile', loadComponent: () => import('./pages/stub/coming-soon.component').then(m => m.ComingSoonComponent), data: { feature: 'Profile' } },
  ],
}
```

## Acceptance criteria

### Layout
1. `/home` renders `<app-home-agent>` after Google sign-in for an agency admin
2. **NO `<app-page-hero>` band** — the launcher is the whole page (matching v1's `hideHero: true`). Page background uses the standard page bg — no fill, no accent wash, no theme-soft tint.
3. Centred title + centred subtitle + 5-tile grid in the launcher
4. First tile (Add project) renders with the vivid gradient + white text
5. Other 4 tiles render with surface + secondary text
6. Click each tile → navigates to corresponding stub or `/settings/profile`
7. Mobile (< 768px): tiles stack to 2-column

### Page-settings drawer
8. Cog icon visible top-right ONLY for admins (`auth.user().isAdmin === true`)
9. Click cog → `<p-drawer>` opens from right
10. Drawer has NO tabs (single body — there's no Sections tab on home)
11. Drawer body has 3 rows + 1 conditional: **Title** (dropdown), **Title text** (conditional, only when mode=Fixed), **Subtitle** (input), **Position** (dropdown). NO label vocabulary fields (those stay in v1's ballpark-settings).
12. Every change auto-saves (`PUT /api/config/:orgType`); UI reflects instantly via signal
13. Reload the page after toggling: state restored from DB (proves persistence)
14. Two admins from same org see the same config (cross-admin sync)
15. Non-admin (agency_member) does NOT see the cog
16. Member trying PUT directly → 403

### v2 hygiene compliance (auto-fail criteria)
17. Zero `*ngIf` / `*ngFor` / NgModules / `any` types
18. Zero raw Tailwind color utilities (build fails on them; verify)
19. Every new component uses `host: { class: 'bp-...' }` — no inner wrapper
20. Lucide icons used in this prompt are registered in the global `pick()` in `app.config.ts` (per DESIGN.md §12), not per-component
21. PUT `/api/config/:orgType` walks the API audit checklist (recorded in ship report)
22. PageConfigPayload validation uses a Zod schema on the server

### Smoke
23. Old `client-angular/` on port 4200 still works unchanged
24. Switching dev users on `/home` updates greeting + cog visibility + drawer-loaded config
25. v1 `/home` still works (loads v1's `HomeComponent` launcher) — confirm by visiting `http://localhost:4200/home`

## Out of scope

- Supplier variant — pV2-05
- Stats strip, section cards (Upcoming, Quick Actions, Recent Activity, Credits, Saved Suppliers) — deferred, possibly never (v1 stays as the failure)
- `/api/dashboard/*` endpoints — deferred / possibly never
- v1's `/dashboard` route doesn't get ported
- Real launcher tile targets beyond stubs
- Marketing copy
- Drag-to-reorder tiles
- Per-user dashboard config (overrides above org_type_config)
- Hero color (we have no hero band)
- Section visibility flags

## Concerns not in spec

Per ENGINEERING.md §"Concerns not in spec" — mandatory in your ship report.
Items I'd want to know:

- Anything you spot in the v1 `home.component.ts` or `home-launcher.component.ts`
  reference that's stale or misaligned with v2 patterns
- Cog button placement — if absolute-positioned doesn't feel right alongside
  the centred launcher, propose alternative (e.g., a small icon-button row in
  the page top-right between header and launcher)
- API audit checklist walk for the PUT endpoint (reused — but you still walk it since you touched the route mount config to use `requireActiveMembership` if it wasn't)
- Migration script changes (re-adding `org_type_config` after the revert)

## Bump + ship

1. Version chip `[Dev v2] v2.09c` (next after the revert; v2.09a was pV2-04, reverted at v2.09b)
2. Commits (one branch):
   - `feat(v2.09c-pt1): re-add org_type_config to migrate-schemas + PageConfigService + drawer chrome`
   - `feat(v2.09c-pt2): home-launcher + launcher-tile + stub coming-soon route`
   - `feat(v2.09c-pt3): home-agent at /home, cog button, drawer integration`
   - `feat(v2.09c): wire it all together + ship report`
3. Ship report `prompts/pV2-04b-launcher-home-shipped.md` with mandatory
   "Concerns not in spec" + API audit checklist walk for the PUT endpoint
4. Flip backlog row to `Shipped`; await audit-before-shipped pass

## Reply with

- Commit SHAs
- 25/25 acceptance verified
- API audit checklist walk for the PUT endpoint
- Concerns not in spec
- Confirmation v1 on 4200 unchanged AND v1's `/home` still renders the v1 launcher
- Note about whether you needed the migration to run before verifying 12-14 (you do)
