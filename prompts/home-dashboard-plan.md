# Home / Dashboard — Plan (Agent + Supplier)

Planning doc for the v2 home page rebuild. Mirrors v1's proven shape (3-column
layout, centre launcher grid, toggleable section cards, page-settings drawer)
with modern v2 patterns (signals, host:-binding, OnPush, `@if`/`@for`).

Companion to `prompts/inbox-v2-plan.md` and `prompts/auth-and-users-plan.md`.

## Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Ballpark                                            [SM] ▾             │  ← shell header
├─────────────────────────────────────────────────────────────────────────┤
│  Hello, Sarah Mitchell                                     [⚙]          │  ← <app-page-hero> + cog
│  Creative Agency Ltd                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  [Active: 12]   [Open Briefs: 4]   [Awaiting: 2]   [Credits: £8,200]    │  ← stats strip
├──────────────────┬─────────────────────────┬──────────────────────────┤
│  LEFT            │  CENTRE                 │  RIGHT                   │
│                  │  ┌──────┬──────┬─────┐ │                          │
│  ┌────────────┐  │  │ +    │ View │     │ │  ┌─────────────────────┐  │
│  │ Upcoming   │  │  │ Add  │ Evts │ Inb │ │  │ Credits             │  │
│  │ (3 cards)  │  │  ├──────┼──────┼─────┤ │  │ £8,200 available    │  │
│  └────────────┘  │  │ Mkt  │ Prof │     │ │  └─────────────────────┘  │
│                  │  └──────┴──────┴─────┘ │                          │
│  ┌────────────┐  │     launcher grid       │  ┌─────────────────────┐  │
│  │ Quick      │  │     (5 tiles)           │  │ Saved Suppliers     │  │
│  │ Actions    │  │                         │  │ (4 cards)           │  │
│  └────────────┘  │                         │  └─────────────────────┘  │
│                  │                         │                          │
│  ┌────────────┐  │                         │                          │
│  │ Recent     │  │                         │                          │
│  │ Activity   │  │                         │                          │
│  └────────────┘  │                         │                          │
└──────────────────┴─────────────────────────┴──────────────────────────┘
                                                          [Dev v2] v2.XXa  ← footer chip
```

Single column on mobile (left → centre → right stacked vertically).

## Section taxonomy

Each section is a self-contained card. Visibility controlled by a per-persona
config flag (stored in `org_type_config.payload` per v1's pattern).

### Agent home — sections

| Section | Card location | Data source | Flag |
|---|---|---|---|
| Stats strip | Top (above 3-col) | API: `/api/dashboard/stats?orgId=` | `showStats` |
| Upcoming events | Left column | API: `/api/projects?status=upcoming&limit=3` | `showUpcoming` |
| Quick Actions | Left column | Config: list of CTA tiles | `showQuickActions` |
| Recent Activity | Left column | API: `/api/activity?limit=10` | `showRecentActivity` |
| Credits | Right column | API: `/api/credits/balance` | `showCredits` |
| Saved Suppliers | Right column | API: `/api/suppliers/saved?limit=4` | `showSavedSuppliers` |

### Supplier home — sections

| Section | Card location | Data source | Flag |
|---|---|---|---|
| Stats strip | Top | API: `/api/dashboard/stats?orgId=` (supplier stats — open briefs, accepted, paid) | `showStats` |
| Incoming briefs | Left column | API: `/api/messages?status=needs_reply` | `showIncomingBriefs` |
| Quick Actions | Left column | Config: tile list | `showQuickActions` |
| Recent Activity | Left column | API: `/api/activity?orgId=` | `showRecentActivity` |
| Payouts / Earnings | Right column | API: `/api/payouts/summary` | `showPayouts` |
| Top Items | Right column | API: `/api/items/top?orgId=&limit=4` | `showTopItems` |

Supplier sections diverge from agent — different data, different priorities.

## Launcher grid (centre column)

Five tiles per persona. Each is a square-ish card with icon + label + click-through.

### Agent launcher
| Tile | Icon | Action |
|---|---|---|
| + Add project | `folder-plus` | Opens project create modal |
| View {Events} | `folder-open` | Navigates to `/projects` |
| Inbox | `inbox` | Navigates to `/inbox` |
| Marketplace | `store` | Navigates to `/marketplace` |
| Profile | `circle-user` | Navigates to `/settings/profile` |

### Supplier launcher
| Tile | Icon | Action |
|---|---|---|
| + Add item | `plus-circle` | Opens item create modal |
| View Catalogue | `package` | Navigates to `/catalogue` |
| Inbox | `inbox` | Navigates to `/inbox` |
| Front (storefront) | `storefront` | Navigates to `/front` |
| Profile | `circle-user` | Navigates to `/settings/profile` |

Tile component name: `<app-launcher-tile>`. Standalone, OnPush, host:-bound.

## Page-settings drawer

Cog icon on the hero (`hero-actions` slot) opens a right-side drawer. Modeled
after v1's p0017 / p0023 pattern but rebuilt fresh in v2.

### Drawer structure

Two tabs at the top (PrimeNG `<p-tabs>`):

#### Dashboard tab

- **Hero title** — dropdown: Greeting · Username · Org Name · Fixed Text
- **Hero subtitle** — text input
- **Hero accent** — toggle: theme wash / transparent
- **Hero align** — toggle: left / center
- **Sections** — checkbox list per persona:
  - Agent: Upcoming · Stats · Quick Actions · Credits · Saved Suppliers · Recent Activity
  - Supplier: Incoming Briefs · Stats · Quick Actions · Payouts · Top Items · Recent Activity

#### General tab

- **Theme swatches** — picks accent color preset
- **Labels** — Credits label · Events label · etc (configurable terminology)
- **Nav** — top-nav items toggleable

Save-on-change (no Cancel button needed — every toggle persists instantly).

### Storage

Settings persist per-`org_type` in the existing `org_type_config` table:

```sql
org_type_config:
  org_type: 'agency'   payload: { dashboardConfig: {...}, generalConfig: {...} }
  org_type: 'supplier' payload: { dashboardConfig: {...}, generalConfig: {...} }
  org_type: 'ballpark' payload: { dashboardConfig: {...}, generalConfig: {...} }
```

When the Ballpark admin edits page settings, the change applies to ALL users of
that org_type. (Per-user overrides deferred — that's a future feature.)

Server endpoint reuses the existing `GET /api/config/:orgType` and `PUT
/api/config/:orgType` from v1's p0021 — same shape, just consumed by v2's
new components.

## Component decomposition

```
client-v2/src/app/pages/home/
├── home-page.component.ts         ← route component; picks agent vs supplier variant by role
├── home-agent.component.ts        ← agent-specific layout (3-col + 6 sections + agent launcher)
├── home-supplier.component.ts     ← supplier-specific layout (3-col + 6 sections + supplier launcher)
└── shared/
    ├── stats-strip.component.ts          ← <app-stats-strip>
    ├── launcher-grid.component.ts        ← <app-launcher-grid>
    ├── launcher-tile.component.ts        ← <app-launcher-tile>
    ├── upcoming-card.component.ts        ← <app-upcoming-card>
    ├── quick-actions-card.component.ts   ← <app-quick-actions-card>
    ├── recent-activity-card.component.ts ← <app-recent-activity-card>
    ├── credits-card.component.ts         ← <app-credits-card>
    ├── saved-suppliers-card.component.ts ← <app-saved-suppliers-card>
    ├── incoming-briefs-card.component.ts ← <app-incoming-briefs-card> (supplier only)
    ├── payouts-card.component.ts         ← <app-payouts-card> (supplier only)
    └── top-items-card.component.ts       ← <app-top-items-card> (supplier only)

client-v2/src/app/shell/
└── page-settings-drawer/
    └── page-settings-drawer.component.ts ← <app-page-settings-drawer> (used on every page that opts in)
```

Each card is a standalone component reading its own data via `ApiService`.
Sections are NOT a single big component — keeps each independently
buildable / testable.

## Prompt sequencing

Each row = one prompt. Build small, ship often.

| Prompt | Scope |
|---|---|
| **pV2-04a** | Home route shell — `<app-home-page>` switches on role, renders empty 3-column layout. Both agent + supplier render the same empty grid. |
| **pV2-04b** | Stats strip + launcher grid + launcher tile primitive — agent variant. Real data via API. |
| **pV2-04c** | Agent left column sections (Upcoming, Quick Actions, Recent Activity) |
| **pV2-04d** | Agent right column sections (Credits, Saved Suppliers) |
| **pV2-04e** | Page-settings drawer + section visibility toggles + org_type_config wiring |
| **pV2-05a** | Supplier variant of pV2-04b (stats + launcher) |
| **pV2-05b** | Supplier left column (Incoming Briefs, Quick Actions, Recent Activity) |
| **pV2-05c** | Supplier right column (Payouts, Top Items) |

After pV2-05c the agent + supplier homes are feature-parity with v1's.

## What changes vs v1

| v1 | v2 |
|---|---|
| `*ngIf` per section | `@if (config.showUpcoming) { ... }` |
| Constructor-injected services | `inject()` |
| BehaviorSubject + async pipe | Signals + `computed()` |
| NgModules | Standalone only |
| Per-component `.p-*` overrides | Aura preset + token bridge |
| `localStorage` + `org_type_config` (cached) | `org_type_config` only (single source) |
| Custom shadow on cards | `--shadow-xs` token |
| `bp-dash-card` shared base | Stays — same global class |

## Tokens for cards (already exist)

```css
.bp-card {
  background: var(--color-surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-xs);
  padding: 20px;
  border: var(--border-hairline);
}
.bp-card__header { /* eyebrow row with icon + title */ }
.bp-card__body { /* content */ }
```

Use this primitive everywhere a card is rendered. Don't reinvent.

## Out of scope (in the home arc)

- Per-user dashboard customization (overrides above org_type_config)
- Drag-to-reorder sections
- New custom widgets beyond what v1 has
- Mobile-specific dashboard layout beyond responsive single-column
- Notifications panel / activity feed beyond Recent Activity
- AI-driven insights / suggestions
- Ballpark admin dashboard (cross-org metrics) — separate prompt
