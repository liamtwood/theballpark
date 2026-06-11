# Ballpark — Working Standards & Laws

## How We Build

### The Workflow
```
1. Design + prototype in Claude chat (claude.ai)
   Visualise every component before touching code
   Agree on design before any implementation
   Never skip this step

2. Produce complete .ts files in Claude chat
   Download from chat outputs
   Save manually to the correct path in the project
   File is complete — no partial edits

3. Tell Claude Code:
   "[filename] manually updated.
    ng build, commit: [message]"
   Claude Code only verifies build + commits
   Claude Code does NOT design UI

4. Claude Code handles:
   Backend logic and services
   Build verification
   Git commits and pushes
   Database migrations
   Never UI design or component structure
```

### The Rule
> Design here (Claude chat) → Build there (Claude Code)
> If it's visual, prototype it first. Always.

### Feature Logging Rule
> Every significant feature built must have a corresponding
> entry in shared.feedback (namespace=feedback, type=prompt,
> area= relevant area, status=done when shipped).

**When to add a new feedback entry:**

Add a new Prompt entry when:
- A new shared component is created (app-markdown-editor, app-avatar etc)
- A new page or route is added
- A new backend service is created
- A significant DB schema change (new table, major ALTER)
- A new third-party integration (Stripe, Resend, Unsplash, Google SSO)
- A new design system pattern or CSS variable group
- A feature that changes how users interact with the product
- A reusable behaviour used in 2+ places

Do NOT add an entry for:
- Bug fixes
- Minor styling tweaks
- Dependency updates
- Config changes
- Refactors that don't change user-facing behaviour
- Single-line fixes

**When to update an existing entry:**

Update status → done when the feature ships:
  status: 'done'
  version: actual shipped version (e.g. 'v1.8')
  shipped_date: actual date

Update notes when the feature evolves significantly:
  e.g. markdown editor gains a new toolbar button
  e.g. image upload gains a new tab

**Feature Note Standard:**

Every feedback entry note must follow this structure:

```
## [Feature Name]

[2-3 sentence plain English description. What it does
and why it exists. Written for a non-technical reader.]

### Object
[Primary data object or UI component]

### Attributes
[attribute]: [type] — [description]
[attribute]: [type] — [description]

### Actions
- **[action]** — [what it does]
- **[action]** — [what it does]
copy: [yes / no + detail]
move: [yes / no + detail]

### Special behaviours
- [notable behaviour or constraint]
- [notable behaviour or constraint]

### Used in
- [page or component] — [why / how]
- [page or component] — [why / how]

### Technical
Component:  [selector or service name]
Path:       [file path]
Depends on: [libraries or services]
```

**CC responsibility — after every significant commit:**
1. Check if the feature warrants a new feedback entry
2. If yes — insert into shared.feedback with full note
3. If updating — PATCH existing entry with new status/version
4. Always run log-commit.js regardless

**Example — app-markdown-editor entry:**

```
## Rich Text Editor

A shared editor component for composing and formatting structured
content throughout Ballpark. Provides a familiar toolbar-driven
writing experience without requiring knowledge of markdown syntax.
Content is stored as markdown and rendered as formatted HTML in
preview mode.

### Object
Reusable Angular component — app-markdown-editor

### Attributes
value:       string  — the markdown content (two-way bound)
placeholder: string  — hint text shown when empty
rows:        number  — minimum visible rows (default 10)
label:       string  — optional field label shown above toolbar
showLabel:   boolean — whether to show the label (default true)

### Actions
- **Edit** — compose content using toolbar or raw markdown
- **Preview** — render formatted HTML from markdown source
- **Insert formatting** — toolbar inserts markdown syntax at
  cursor without overwriting selection
copy: n/a — content bound via [(value)]
move: n/a

### Special behaviours
- Toolbar inserts at cursor, wraps selected text
- Tab key inserts 2 spaces (prevents focus loss)
- Keyboard shortcuts: Cmd+B (bold), Cmd+I (italic), Cmd+K (code)
- Tables render with parchment amber headers (design system)
- Checkboxes interactive in edit, read-only in preview
- Grows to fill available flex container height
- Preview rendered via marked library
- All preview styles in styles.css — not component CSS

### Toolbar
B  I  S  |  H1  H2  H3  |  • list  1. list  ☐ todo  |
❝ quote  { } code  —  |  ⊞ table

### Used in
- Feedback drawer — notes field for bugs, enhancements, specs
- Item drawer — description field for catalogue items
- Meeting notes — agenda item detail (future)
- Project brief — event description (future)

### Technical
Component:  app-markdown-editor
Path:       client-angular/src/app/shared/components/markdown-editor/
Depends on: marked (npm), DomSanitizer (@angular/platform-browser)
```

---

## Tech Stack

```
Frontend:  Angular 17 (standalone components)
Backend:   Node.js + Express (service layer architecture)
Database:  Supabase (PostgreSQL)
Storage:   Supabase Storage (6 buckets, 3 environments)
Styling:   PrimeNG + Tailwind + CSS variables
Fonts:     Playfair Display (headings) + Libre Franklin (body)
Repo:      github.com/liamtwood/theballpark
Branches:  dev → preview → master
Deploy:    Vercel (frontend) + Railway (backend)
```

### Version label bumping — CRITICAL

The version label rendered bottom-right of the app (e.g. `[Dev] v1.36`)
comes from a **different env file per build target**. Bumping only
`environment.ts` is a silent failure — preview/master keep reporting
the OLD version even though new code has shipped, which makes it
impossible to confirm a deploy landed.

| Build target  | Env file                          | angular.json config |
|---------------|-----------------------------------|---------------------|
| Dev (local)   | `environment.ts`                  | `development`       |
| Preview       | `environment.staging.ts`          | `preview`           |
| Master (prod) | `environment.prod.ts`             | `production`        |

**Rules**
- Every code commit on `dev` bumps `environment.ts` (`[Dev] vX.Y`).
- The commit that **merges dev → preview** must also bump
  `environment.staging.ts` to the same number (`[Preview] vX.Y`),
  ideally in the merge or in a dedicated `chore:` commit on dev
  immediately before the merge.
- The commit that **merges preview → master** must also bump
  `environment.prod.ts` (`[Master] vX.Y`).
- Never bump `environment.prod.ts` outside of a master release.
- Never bump `environment.staging.ts` outside of a preview promotion.

Quick sanity check after deploy: open the deployed URL, look at the
version label, confirm it matches what you just promoted. If it
still shows the old number, the env file for that target wasn't
bumped — fix that before assuming the deploy worked.

### Schema migrations — single source of truth

`server/src/db/migrate-schemas.js` is the **only** sanctioned way to
bring a schema (dev/preview/master) into the current shape. Running
it must be idempotent and complete in one pass — `IF NOT EXISTS`
everywhere, `ON CONFLICT DO NOTHING` on all seeds.

> ⚠️ `server/src/db/migrate.js` is the OLDER `public.`-only runner
> and is **deprecated**. Do not add new ALTERs there. It is kept in
> tree for historical reference only; touching it causes the exact
> drift this section warns about — changes get applied to dev but
> never reach preview/master because the canonical runner doesn't
> see them. (Caught in v1.65gG: `project_items.image_url` was added
> to `migrate.js` instead of `migrate-schemas.js`; preview Railway's
> listing endpoint 500'd for weeks until the dev → preview promote
> exposed it.)

**Rules — no exceptions**
- Every commit that adds/alters a column, table, index, codelist row,
  or seed entry on dev MUST update `migrate-schemas.js` in the same
  commit. Ad-hoc `ALTER TABLE` against the dev DB without recording
  it in the script causes silent drift that surfaces weeks later
  when preview/master is promoted (e.g. v1.36 → preview hit a
  20-version backlog of missing columns).
- The script targets `public.`, `preview.`, and `master.` explicitly
  in each statement. Don't write `ALTER TABLE items ...` — write
  three statements, one per schema.
- **Standalone `migrate-vX.Y.js` files are fine for incremental dev
  work but are NOT the source of truth.** The same SQL MUST be
  back-ported into `migrate-schemas.js` (all three schemas) in the
  same commit, OR in a follow-up commit before the next dev →
  preview promotion. The standalone file stays in tree as the
  documented history of when the change landed.
- Before merging dev → preview (or preview → master), run
  `node server/src/db/migrate-schemas.js`. It is idempotent and safe
  to run repeatedly.
- After every merge into preview or master, smoke-test the
  endpoints most likely to depend on new columns (e.g. project list,
  project items, messages list) before considering the promote done.
- Don't write inline backticks in SQL comments inside the JS
  template literal — they break the parser. Use plain quotes or
  unquoted names in `--` comments.
- New seed data (codelists, demo rows) goes in the same script under
  `ON CONFLICT DO NOTHING`. Don't lean on one-off `seed-vX.Y.js`
  scripts as canonical — they're history, not state.
- Prefer `gen_random_uuid()` over `uuid_generate_v4()` for new
  tables. `gen_random_uuid()` is built into PG13+ and works on any
  schema search_path; `uuid_generate_v4()` requires the `uuid-ossp`
  extension to be in scope, which breaks when the connection lands
  on a non-default schema (caught in v1.65gG migration of the
  message_item_decisions table).

---

## Authentication & Authorisation

### Overview
```
Provider:   Google OAuth 2.0 (SSO only — no username/password)
Token:      Stateless JWT, 1-hour expiry
Storage:    httpOnly cookie (not localStorage — XSS protection)
Refresh:    Refresh token stored in DB (auth_sessions table)
Middleware: authenticate() on all protected routes
            authorise(roles[]) for role-based access
```

### Auth Flow
```
1. User clicks "Sign in with Google"
2. Redirect to Google OAuth consent screen
3. Google redirects to GET /api/auth/google/callback
4. Backend exchanges code for Google profile
5. Find or create user record in DB
6. If new user → enrollment flow (create or join org)
7. Issue JWT + set httpOnly cookie
8. Redirect to Angular app
9. Angular reads GET /api/auth/me to hydrate auth state
```

### Enrollment Flow (new users)
```
1. Choose: Create new org OR Join existing org (via invite code)
2. If create: enter org name → choose type (agency/supplier)
   Note: type is a UI hint only — does not restrict features
3. If join: enter invite code → auto-assigned to that org
4. Redirect to dashboard
```

### JWT Payload
```json
{
  "sub":     "user-uuid",
  "org_id":  "org-uuid",
  "role":    "owner | admin | member",
  "is_platform_admin": false,
  "iat":     1234567890,
  "exp":     1234571490
}
```

### Middleware
```javascript
// authenticate() — required on all protected routes
// Verifies JWT from httpOnly cookie
// Attaches req.user = { id, org_id, role, is_platform_admin }

// authorise(roles) — optional role check
// Usage: router.delete('/:id', authenticate, authorise(['owner','admin']), handler)
// Roles hierarchy: platform_admin > owner > admin > member
```

### Role Definitions
```
platform_admin → full platform access, all orgs, all data
                 is_platform_admin flag on users table
                 not an org role — additional flag only

owner          → full org control, billing, transfer ownership
admin          → manage members and settings
                 cannot transfer ownership or delete org
member         → full functional access
                 cannot manage team or settings
```

### Role Permissions Matrix
```
Action                    platform_admin  owner   admin   member
─────────────────────── ─────────────── ─────── ─────── ───────
View org data                ✓             ✓       ✓       ✓
Create/edit projects         ✓             ✓       ✓       ✓
Send leads / spend Balls     ✓             ✓       ✓       ✓
Manage catalogue items       ✓             ✓       ✓       ✓
Invite members               ✓             ✓       ✓       ✗
Remove members               ✓             ✓       ✓       ✗
Edit org settings            ✓             ✓       ✓       ✗
Change member roles          ✓             ✓       ✗       ✗
Transfer ownership           ✓             ✓       ✗       ✗
Delete org                   ✓             ✓       ✗       ✗
Platform admin (all orgs)    ✓             ✗       ✗       ✗
Manage categories/config     ✓             ✗       ✗       ✗
```

### Auth Environment Variables
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://[railway-domain]/api/auth/google/callback
JWT_SECRET=          (long random string, never committed)
JWT_EXPIRY=1h
COOKIE_SECRET=       (for cookie signing)
COOKIE_DOMAIN=       (.theballpark.ai in production)
```

### Angular Auth
```
AuthService         → login(), logout(), getMe(), currentUser$
AuthGuard           → protects all authenticated routes
RoleGuard           → protects admin-only routes
auth.interceptor.ts → attaches credentials: 'include' on all requests
                      (required for httpOnly cookie to be sent)

Route protection:
  { path: '**', canActivate: [AuthGuard] }        → all routes
  { path: '/admin', canActivate: [RoleGuard],
    data: { roles: ['platform_admin'] } }          → admin only
```

---

## Service Architecture

### The Rule
```
Org service    → org_id is a required input parameter
                 Always scoped to one org
                 Multi-tenant by definition

Shared service → no org_id needed
                 Platform-wide data
                 Same data for all orgs
```

### Backend Services

#### Org-scoped (always require org_id)
```
server/src/services/
  org.service.js          → org identity + config only
                             getById(id), update(id, data), getAll()
                             getCurrentOrg() via JWT — not hardcoded

  user.service.js         → team management
                             getByOrg(org_id), create(), update(), softDelete()
                             Role assignment, invitation management

  subscription.service.js → plan + billing + Ball balance
                             getByOrg(org_id), updatePlan(), topUp()
                             Stripe integration

  project.service.js      → projects (any org type)
                             getByOrg(org_id), getById(), create(), update()

  catalogue.service.js    → items + leads (any org type)
                             getByOrg(org_id), create(), update()
                             Distinct from marketplace browse

  client.service.js       → clients (any org type)
                             getByOrg(org_id), create(), update()

  favourite.service.js    → saved items/suppliers
                             getByOrg(org_id), toggle()

  message.service.js      → comms threads
                             getByOrg(org_id), getByProject()

  balls.service.js        → transactions + balance
                             getByOrg(org_id), debit(), credit()
```

#### Shared (no org_id required)
```
server/src/services/
  category.service.js     → platform taxonomy
                             getAll(), getByNamespace(), getChildren()

  item.service.js         → marketplace browse (all orgs' items)
                             getAll(filters), getById()
                             Note: catalogue.service.js for org-scoped CRUD

  status.service.js       → status definitions
  ai.service.js           → Claude API calls
  feedback.service.js     → bugs, features, meeting notes
  storage.service.js      → file upload handling
  auth.service.js         → JWT, OAuth, session management
```

### Route URL Convention
```
Org-scoped routes:
  GET    /api/orgs/:id/users
  POST   /api/orgs/:id/users
  GET    /api/orgs/:id/projects
  POST   /api/orgs/:id/projects
  GET    /api/orgs/:id/catalogue
  POST   /api/orgs/:id/catalogue
  GET    /api/orgs/:id/clients
  GET    /api/orgs/:id/favourites
  GET    /api/orgs/:id/messages
  GET    /api/orgs/:id/balls
  GET    /api/orgs/:id/subscription

Shared routes (no org prefix):
  GET    /api/categories
  GET    /api/items           (marketplace browse)
  GET    /api/statuses
  GET    /api/feedback
  POST   /api/auth/google
  GET    /api/auth/me

Platform admin routes:
  GET    /api/admin/orgs
  GET    /api/admin/users
  GET    /api/admin/feedback
```

### Angular Services
```
client-angular/src/app/core/services/

Org-scoped:
  org.service.ts          → org identity only
  user.service.ts         → team management
  subscription.service.ts → plan + billing
  project.service.ts      → projects
  catalogue.service.ts    → org catalogue items
  client.service.ts       → clients
  favourite.service.ts    → favourites
  message.service.ts      → messages
  balls.service.ts        → ball transactions

Shared:
  auth.service.ts         → login, logout, currentUser$
  category.service.ts     → platform categories
  marketplace.service.ts  → item browse (replaces supplier.service.ts)
  feedback.service.ts     → bugs, features, meeting notes
  config.service.ts       → theme, platform settings
  ai.service.ts           → brief parsing
  api.service.ts          → base HTTP wrapper (add credentials: 'include')
```

### org_id Source of Truth
```
Backend:  req.user.org_id from JWT middleware
          Never trust org_id from request body or query params
          Middleware sets it, service uses it

Angular:  AuthService.currentUser$.org_id
          Never hardcode org_id
          Never use getCurrentAgency() pattern (removed)
```

---

## Styling Laws

### The Three-Layer Rule
```
PrimeNG    → UI components (buttons, inputs, dialogs, tables)
Tailwind   → Layout and spacing (flex, grid, padding, margin)
CSS vars   → Theme colours only
Custom CSS → ONLY for unique visuals that PrimeNG/Tailwind cannot do
             (hero banner, card gradients, project/supplier cards,
              colour swatches, mode selectors, pencil edit button)
```

### Never
- Write custom CSS for something PrimeNG already provides
- Hardcode hex colour values in component files
- Use inline styles for layout (use Tailwind)
- Create a new button style outside of styles.css
- Use different styling approaches in different components

### Inline styles — allowed exceptions
- Preview panel dynamic values: `[style.color]="previewAccent"` etc.
  These bind to runtime values from ConfigService and cannot use CSS vars.
- 0.5px borders: `style="border-bottom:0.5px solid var(--color-border)"`
  Tailwind does not support sub-pixel border widths.

---

## Naming & Vocabulary

Canonical **internal** vocabulary — use these exact names in routes,
components, types, and code comments. Customer-facing UI labels may differ
(they are config / persona overrides); the internal names below are fixed and
must not drift to match a label.

| Internal name | What it is | URL | Default label | Customer override |
|---|---|---|---|---|
| **storefront** | A supplier's public-facing presence — branding, company info, how they appear in the Marketplace | `/storefront` | "Storefront" | "Profile" |
| **store** | A supplier's catalogue management — their items/products | `/store` | "Store" | "Shop" |

**`storefront` vs `store`** is the canonical pair — keep them distinct:
- *storefront* = the shop window (presentation / profile).
- *store* = the stockroom (catalogue / items).

Do **not** reintroduce `shopfront` — it was renamed to `storefront` in v1.68c
for URL + vocabulary consistency, with **no legacy alias** (pre-launch, no
saved links to break — per the "no legacy aliases" cleanup rule). UI labels are
the ONLY place an alternative word may appear, and only via the
label-config / persona override mechanism — never hard-code a customer label
(e.g. "Profile", "Shop") as the internal route/type/component name.

---

## Standard Components

### PrimeNG Components (always use these)
```
p-button           → ALL buttons, no exceptions
p-inputText        → ALL text inputs
p-inputNumber      → Number inputs (VAT%, prices)
p-inputTextarea    → Multiline text
p-dropdown         → Select/dropdown
p-selectButton     → Toggle groups (list/grid, suppliers/items)
p-checkbox         → Checkboxes
p-toggleSwitch     → On/off toggles
p-tabView          → Tab navigation
p-dialog           → Modals (with styleClass="bp-modal")
p-sidebar          → Drawers (with styleClass="bp-drawer")
p-toast            → Notifications
p-table            → Data tables
p-progressSpinner  → Loading states
p-calendar         → Date picker
p-chips            → Tag input
```

### Search inputs (v1.68d)
Search-style inputs use `.bp-search-row` (a `bp-fld`-family control: transparent
fill, `var(--theme-border)`, `var(--radius-button)`, accent focus ring) with a
leading `.bp-search-icon` prefix. They share the **same 38px height + radius as
`bp-btn-grad`** so a search bar can sit inline with action pills (e.g. the
supplier store's `[ 🔍 Search ][+ Add][↑ Upload]` row). One definition in
`styles.css` — shared across every `catalogue-grid` surface; never re-style the
search box per surface.

### Shared Angular Components
```
app-modal               → p-dialog wrapper with parchment header
app-image-upload-panel  → Upload / Unsplash / Icon / Colour tabs
app-avatar              → Initials circle, theme accent background
app-stat-card           → Dashboard stat cell
app-loading             → Centred spinner
app-status-badge        → Coloured status pill (uppercase always)
app-feedback-dialog     → Floating feedback capture
app-markdown-editor     → Markdown editor with toolbar + preview
                           Inputs: value, placeholder, rows, label
                           Output: valueChange (two-way binding)
                           Toolbar: B I S | H1 H2 H3 | lists |
                                    blockquote code divider table
                           Preview tab renders via marked library
                           Table headers use parchment design system
                           Grows to fill flex container height
                           Used for: notes (feedback), description (items)
CatalogueGridComponent  → Reusable grid for all browse pages
```

---

## Design Tokens (CSS Variables)

### Theme (changes per marketplace config)
```css
--theme-accent    /* Primary colour — amber default: #D97706 */
--theme-bg        /* Parchment — #F5F0E8 */
--theme-text      /* Dark amber — #92400E */
--theme-border    /* Warm border — #E8D9C0 */
--theme-empty     /* Empty state — #EDD9A3 */
```

### Neutral (fixed)
```css
--color-border           /* #EBEBEB */
--color-surface          /* #FFFFFF */
--color-text-primary     /* #111111 */
--color-text-secondary   /* #888888 */
--color-text-muted       /* #BBBBBB */
--color-danger           /* #E11D48 */
--font-display           /* Playfair Display */
--font-body              /* Libre Franklin */
```

---

## Button Standards

All defined in `styles.css` — change there to change everywhere.

```
p-button              → Amber filled, white text. Hover: dark amber
p-button-outlined     → White bg, amber border + text. Hover: amber filled
p-button-text         → Transparent, amber text. Hover: parchment tint
p-button-danger       → White bg, red text. Hover: light red tint
.bp-btn-cancel        → Parchment bg (modal/drawer footer)
.bp-btn-save          → Parchment bg (modal/drawer footer). Both hover: amber
```

---

## Page Layout Standard

### Hero banner
```
Every authenticated page uses the hero banner pattern:
  Parchment background (--theme-bg)
  Org name — Playfair Display, 36px, centered
  Page label — uppercase, muted, letter-spaced (e.g. SETTINGS)
  Tab bar — centered, text labels only, NO icons
  Active tab — theme accent underline
  Single border-bottom: 0.5px solid var(--color-border) on tab bar only
  No border on hero container itself
```

### Page title
```
Every tab has a centered Playfair Display title below the hero:
  font-family: var(--font-display)
  font-size: 22px, font-weight: 400
  text-align: center, margin-bottom: 24px
  Use class: bp-page-title
```

### Content area
```
  max-width: 640px, margin: 0 auto — centres under hero tabs
  Appearance tab exception: 960px two-column grid
```

---

## Edit Patterns

### Single Record (settings, profile)
```
View mode:  Read-only text fields
            Hover section → pencil icon (square-pen, Lucide) appears
            Click pencil → fields switch to parchment inputs
            Tick (check) to save, X to cancel
When to use: Settings/Organisation, any single-record page
```

### Multiple Items (catalogue, team, categories)
```
Drawer pattern: p-sidebar, position="right", width 480px
  Parchment header (Playfair Display title + subtitle)
  Form fields using standard p-inputText
  Parchment footer: Cancel (bp-btn-cancel) + Save (bp-btn-save)
When to use: Catalogue items, team members, categories, send lead
```

---

## Drawer Standard

```html
<p-sidebar [(visible)]="drawerVisible"
           position="right"
           styleClass="bp-drawer"
           [style]="{width:'480px'}">
  <ng-template pTemplate="header">
    <div class="bp-drawer-header-row">
      <div class="bp-drawer-header">
        <span class="bp-drawer-label">SECTION LABEL</span>
        <div class="bp-drawer-title">{{ title }}</div>
      </div>
      <button class="bp-icon-btn" (click)="close()">
        <i class="pi pi-times"></i>
      </button>
    </div>
  </ng-template>
  <div class="bp-drawer-body"><!-- fields --></div>
  <ng-template pTemplate="footer">
    <p-button label="Cancel" styleClass="bp-btn-cancel" (onClick)="close()">
    </p-button>
    <p-button [label]="actionLabel" styleClass="bp-btn-save" (onClick)="save()">
    </p-button>
  </ng-template>
</p-sidebar>
```

### Section + field chrome inside drawers — use the shared standard

For a drawer's **editable attribute sections**, do NOT hand-roll `bp-section-h`
headers + `bp-input-edit` fields. Use the shared components at drawer density:
`<app-edit-section density="drawer">` (per-section Edit/Save/Cancel lifecycle) or
`[editable]="false"` for an always-edit form, with `<app-edit-field density="drawer">`
for the fields (same component as the page/card surfaces, scaled down — see the
edit-field/edit-section headers).

Adoption status:
- ✅ `event-drawer` — per-section lifecycle (`density="drawer"`); Status pill + the
  type/tier dropdowns kept bespoke.
- ✅ `supplier-drawer` — always-edit form (`[editable]="false"`); VAT toggle + image
  panel kept bespoke.
- ✅ `ballpark-settings/orgs` — add-org (always-edit) + view-details (read-only,
  `readonlyAlways`) drawers; org-type dropdown bespoke.
- ✅ `settings/team` — invite (always-edit) + member-details (view/edit lifecycle)
  drawers; role dropdown bespoke.
- ✅ `ballpark-settings/early-access` — content + settings editor fields (card
  density, always-edit); chips + per-group Save bespoke.
- ⛔ `item-drawer` **and** `feedback-drawer` — **intentionally left bespoke**
  (decision: 2026-06-07). Both are specialised editors dominated by NON-attribute
  controls: item-drawer is tabbed/3-mode with markdown, £-money, several dropdowns,
  tier pills, dimension chips, an 8-slot gallery, and an AI panel; feedback-drawer
  is a triage editor with ~6 dropdowns, a markdown notes editor, date/version
  datalists, and tag chips. In both, the *dropdowns are the substance*, so a clean
  conversion is blocked on the field component growing a **zero-shift `select`**
  (plus a money `prefix` for item-drawer). Forcing the standard now would fit poorly
  (don't force a misfit — see "One Definition, One Role" below). The unblock for
  BOTH is the same: build zero-shift `select`, then convert in a dedicated pass.

---

## One Definition, One Role, One Application

> **No token may have two definitions. No token may have two unrelated roles.
> No shared standard may be hand-applied at consumer sites.**
> When you see any of the three, **extract / unify / split** until it is one
> definition, one role, one application.

This is the umbrella law; "Extract Before Duplicate" (below) is its markup
instance. We have now fixed three instances of the same bug class — *shared
standard, multiple definitions or hand-applied at each site, drift inevitable*:

| Disguise | Symptom | Fix |
|---|---|---|
| **CSS classes** (the editable field) | `is-edit` hand-wired per field; one instance routed it to the wrong element on `p-inputNumber` | extracted `<app-edit-section>` + `<app-edit-field>` — the wiring lives in one component |
| **Storage shape** (page-settings) | catalogue-view keyed by surface, read by role — writer and reader assumed different shapes | role-scoped the storage key (Step 5a) |
| **Colour tokens** (the page ground) | `--theme-bg` defined in CSS *and* overwritten in JS; one token painting ground + hero + fills + rings | one literal `--color-ground-base`; role tokens (`--color-page-ground` / `--color-hero-bg` / `--color-fill` / `--color-focus-ring`); JS only sets the dark value (Cleanups 1 + 2) |

The three checks, concretely:
1. **One definition** — a value (colour, size, label, config) is declared in
   exactly one place. No CSS-token-shadowed-by-JS, no constant duplicated across
   files. Change it once, everything follows.
2. **One role** — a token/variable means exactly one thing. If `--x` paints both
   the page ground and decorative fills, split it the moment you notice — not
   when the two roles finally need to diverge under pressure.
3. **One application** — a shared standard (component, token, behaviour) is
   applied through one mechanism, not re-typed at each consumer. If every page
   hand-writes the same markup/binding, extract it; if a rule is an opt-in
   allow-list that pages can silently fall out of, make it the default.

When in doubt, ask: *"If this needs to change, how many places do I touch?"* The
answer must be **one**.

---

## Engineering hygiene — non-negotiable

Added by pV2-AUDIT-01 after the post-pV2-03 audit. Each rule cites the past
violation that motivated it. These bind CC **and** spec authors (see the
precedence rule at the end).

### Multi-statement DB writes are transactional — via the shared helper

Any service function that performs more than one INSERT, UPDATE, or DELETE
that must all-succeed-or-all-fail MUST wrap them in a single transaction
using the shared `withTransaction(fn)` helper in `server/src/db/`. Hand-rolled
`BEGIN`/`COMMIT`/`ROLLBACK` is FORBIDDEN — `pool.js`'s per-statement write
wrapper sets `app.current_user_id` (the audit attribution GUC) on each
statement individually, and a hand-rolled transaction with a dedicated client
silently loses that attribution unless it re-establishes the GUC itself. The
helper owns that interplay in one place (One Definition).

If a function intentionally does NOT wrap writes in a transaction (because
they're independent), the code MUST contain a comment explaining why.

Past violation: pV2-02's `upsertUserFromGoogle` step 3 ran three INSERTs
without a transaction, leaking orphan `orgs` rows on partial failure. The
fix (pV2-AUDIT-02) builds the `withTransaction(fn)` helper FIRST so the
violation fix doesn't itself recreate audit-attribution drift.

### Tokens only — enforced at compile time, with a complete semantic set

No hex codes, `rgb()`, `rgba()`, `hsl()`, OR Tailwind utility classes that
resolve to raw color values in component templates or styles.

This rule is enforced **at compile time**, not by grep policing: the
`tailwind.config.js` `theme.colors` block REPLACES Tailwind's default
palette (does not extend it) with the token-only set, so `text-slate-500`
literally does not compile. Default-on, not allow-list — the same principle
this section's "Shared security standards" rule applies, mapped to styling.

Use either:
- CSS custom properties: `color: var(--color-text-secondary)`
- Custom Tailwind config tokens: `text-secondary`, `border-hairline`,
  `bg-surface`, `text-success`, etc. — defined in `tailwind.config.js`
  against the `--*` tokens

**The token set MUST be complete enough that every visible UI state has a
compliant choice.** A rule that's unsatisfiable is a rule that gets broken.
Define the semantic state tokens (`--color-success`, `--color-warn`,
`--color-danger`, `--color-info`) in the same pass as the rule — status
dots, "pending invite" badges, "suspended" badges, danger trash hovers all
need semantic-state colors, and a rule with no compliant alternative is
worse than no rule.

v1 already drew the right distinction (theme colors recolour with the
admin preset; semantic colors don't). v2's token set carries it forward
without invention.

Past violation: pV2-03's team page used `border-black/10`, `text-slate-500`,
`bg-white` in 7 places. The spec itself (pV2-01b/01c templates) contained
similar raw colors — see the "precedence" rule below, which makes
spec-embedded violations CC's mandatory delta, not a liberty.

### Auth surfaces require rate limiting

Every server endpoint that creates, validates, or destroys an
authentication artifact (cookie, token, session) MUST have rate limiting
middleware via `express-rate-limit` or equivalent. Default budgets:
- Write endpoints (`POST /auth/*`, `POST /auth/dev/login`): 10 req/min per IP
- Read endpoints (`GET /auth/me`, `GET /api/dev/users`): 30 req/min per IP
- OAuth callbacks: 30 req/min per IP

This applies in development too — dev environments get attacked.

**Deploy precondition:** when the server runs behind a proxy (Railway,
load balancer, CDN), `app.set('trust proxy', ...)` MUST be configured
correctly. Otherwise `express-rate-limit` sees only the proxy's IP and
every user shares one bucket — a self-DoS waiting to happen. Set this
once in `index.js`, not per-route.

Past violation: pV2-02 shipped 5 auth-touching endpoints with no rate limiting.

### JWTs carry identity, not authority

JWTs MUST contain identity claims only:
- `sub` (user id)
- `email`
- `org_id` (ONLY if the user cannot switch orgs without re-authenticating —
  fine today since v1 has no org switcher; moves out of the JWT or forces
  re-auth when the multi-org switcher lands)

JWTs MUST NOT contain authority claims that can change without the user
re-authenticating:
- `role`
- `is_admin`
- `permissions`

Authority MUST be re-derived from the database on each protected request via
a live read of `user_orgs` and `orgs`. The performance cost (one indexed
query) is negligible compared to the cost of stale permissions surviving for
the JWT lifetime.

Past violation: pV2-02 put `role` and `is_admin` in the JWT with a 7-day
lifetime; demoting an admin doesn't take effect until they re-sign-in.

### Catch blocks justify themselves

Any `catch { }` block that does not log, rethrow, or notify the user MUST
have an inline comment explaining why the error is safely ignorable. If the
comment cannot be written truthfully, the catch must log or rethrow.

Distinguish "expected absence" (e.g., 404 / 401 on optional resource) from
"unexpected server failure" (5xx, network error). Silent on the former,
loud on the latter.

Past violation: pV2-02's `AuthService.loadSession()` silently swallowed all
errors including 5xx — masking server outages as "signed out".

### Shared security standards live as middleware, not per-route conventions

When a security-relevant check (authentication, authorization, audit
attribution, live-membership validation) is needed on more than one route,
it MUST live as middleware applied at the router or app level — NOT copied
into each route handler.

The allow-list pattern (opt-in per route) is forbidden for security checks
where the safe default is on. The default for "verify the requester is
still an active member with this permission" is ON, not OFF.

Past violation: pV2-03's `team.js` re-reads live `user_orgs` per request
to honour suspensions. `auth.js` re-derives via `buildSession`. No other
v2 endpoint inherits the check — every new endpoint must remember to copy
the pattern. Fix: extract `requireActiveMembership(perm?)` middleware,
mount at v2 router level, delete inline copies.

### Duplicate data across boundaries needs automated enforcement

When data must be duplicated across boundaries (client/server, code/DB
seed, two services, two schemas), the duplication MUST have an automated
enforcement mechanism:

- A test that imports both sides and asserts equivalence, OR
- A codegen step that produces one side from the other at build time, OR
- Serving the data from a single authoritative endpoint at runtime

A comment that says "keep in sync" is NOT an enforcement mechanism. Drift
is silent until production breaks.

Past violation: pV2-02 mirrored the permissions MATRIX in
`client-v2/src/app/core/auth/permissions.ts` and
`server/src/services/permissions.service.js` with a comment "keep in sync"
and no test. First uncoordinated edit silently desyncs them.

### Pure functions in security paths are tested

Pure functions in `core/auth/`, `services/permissions*`, security-relevant
utilities, and route guards MUST have unit tests before the next prompt
builds on them. Vitest is wired in `client-v2`; Node test runner or Jest is
adequate on the server. The cost is minimal; the regression catch is real.

Tests are not optional in these paths. They are not deferred to "when
things stabilise." Security primitives stabilise BY having tests.

Past violation: pV2-02 + pV2-03 shipped `can()`, `effectiveRole()`,
`normalizeOrgType()`, `deriveInitials()`, `auth.guard`, `admin.guard` with
zero specs. All pure. All in security paths.

### Hygiene rules outrank spec-embedded code

When a prompt's spec contains code, markup, or pseudocode that violates any
rule in this §"Engineering hygiene" section, CC MUST implement the
compliant version — NOT the literal spec — and MUST flag the deviation
explicitly in the ship report's "Concerns not in spec" section under the
heading "Spec-hygiene precedence deviations."

This rule REVERSES `cc-onboarding.md`'s general "visual decisions are
settled in the prompt; don't relitigate" guidance for the specific case of
hygiene violations. The general rule still holds for design choices
(colors, layouts, copy, component shapes). Hygiene rules are different:
they encode invariants that the spec author must also obey, and the spec
author benefits from CC's enforcement when they slip.

This rule also binds the spec author (chat / Liam / anyone drafting a
prompt). Prompts that contain `text-slate-500`, `border-black/10`, raw hex
codes, `EventEmitter`, `*ngIf`, `BEGIN`/`COMMIT` hand-rolled, or any other
hygiene violation are themselves non-compliant and CC's deviation in the
ship report is the correction trail. Spec drift in the OTHER direction
(spec demands a violation; CC implements the violation) is a compounded
failure, not a follow-through.

Past violation: pV2-01b and pV2-01c templates contained `text-slate-500`,
`bg-white/80`, `border-black/5`. CC extended the pattern into pV2-03's
team page because the existing cc-onboarding rule said "don't relitigate
visual decisions." She wasn't taking liberty — she was following the rule
that conflicted. This new rule resolves the conflict in favour of hygiene.

---

## Data Audit — Universal Audit Columns + Soft Delete

Enforced at the DB layer so no service can bypass it. See
`database/migration_universal_audit_columns.sql` + `SWEEP_soft_delete_audit.md`.

**The 6 columns.** Every business table has `created_at/created_by`,
`updated_at/updated_by`, `deleted_at/deleted_by`. A `BEFORE INSERT OR UPDATE`
trigger (`audit.stamp_audit_cols`, column-agnostic — one function for every
table) stamps them automatically: `created_*` immutable after insert,
`updated_*` on every write, `deleted_by` on the `deleted_at` transition. The
actor is `audit.current_user_id()` = a server-set per-request GUC
`app.current_user_id` (never raw client input) → `auth.uid()` → NULL. The trigger
PREFERS the resolved actor and falls back to any app-supplied value, so it never
regresses or clobbers a real value, and never blocks a write. **The backend must
`SET LOCAL app.current_user_id` per request** or who-touched-last attributes to
whatever the app passes / NULL.

**Soft delete.** Every business **entity** table has `deleted_at`. Hard deletes
are forbidden — a `BEFORE DELETE` trigger raises. The delete method is
`softDelete(id)` (stamps `deleted_at`), never `delete(id)`. `deleted_at` is the
one convention — the older `is_active=false` pattern converges to it per-table.
Default read scope is `WHERE deleted_at IS NULL`; surfaces that need deleted rows
pass an explicit `includeDeleted` / `_all` view.

**The dual-pattern — `is_active` (publish) + `deleted_at` (soft-delete) on the
same table. Reference: `items` (converged v1.68b).** When a table needs BOTH a
reversible "hide/unpublish" state AND a soft-delete, the two are *distinct
columns with distinct semantics* — do not overload one for both (the legacy
items bug: `delete` set `is_active=false`, so "hidden" and "deleted" were the
same state, with no way back). Canonical wiring, copy it for any future table
that needs both:
- `deleted_at` = **removed**. `softDelete` stamps `deleted_at = NOW()` (trigger
  fills `deleted_by`); excluded from **every** read, always.
- `is_active` = **publish/visibility toggle**, reversible. Flipped via the normal
  `update` path (whitelisted column). Excluded from PUBLIC / marketplace reads,
  but RELAXED for the owner's own management view (an explicit `includeHidden` /
  `include_hidden=true` param) so hidden rows render with a "Hidden" badge
  instead of vanishing — otherwise there's no UI to re-activate them.
- Read scope therefore reads as: marketplace = `WHERE is_active = true AND
  deleted_at IS NULL`; owner-own view = `WHERE deleted_at IS NULL` (is_active
  relaxed). Never relax `deleted_at`.
- **One-time backfill (v1.68b):** pre-existing `is_active=false` rows were
  recategorised to `deleted_at = NOW()`, since that was the ONLY operation that
  flipped the column before the hide-vs-delete split — so every legacy
  `is_active=false` row was really a delete. **This backfill must run exactly
  once per env** (`migrate-schemas.js`, guarded by a `shared.migration_flags`
  marker + a `deleted_at` column-exists check): a blind re-run would soft-delete
  legitimately-hidden items, because post-split a hidden row is *also*
  `is_active=false / deleted_at IS NULL`. Production rollout: master is empty
  today so the UPDATE is a no-op there, but it's encoded in the same script so
  it runs once at cutover for any future env that inherits the old convention.
  **The rule for any future is_active→deleted_at convergence: pair the service
  change with a marker-guarded one-time backfill — never an unguarded UPDATE.**

**Exemptions (do NOT force the standard — "don't force a misfit"):**
- **Junction / sync tables** maintained by delete-and-reinsert (`supplier_item_tag`,
  `project_item_suppliers`, `project_items`) keep hard delete (guard OFF) — soft-delete
  there accumulates dead rows on every sync. They still get the 6 columns + stamp.
- **Append-only ledgers** (`balls_transactions`) — guard ON (immutable).
- **Logs / transient** (`internal.project_log`, and any future session /
  reset-token / upload-metadata tables) — exempt entirely.

**Reporting under soft-delete — gate on the parent chain, not the child's own flag.**
Because soft-delete is a parent-only state flip and child tables don't cascade
(the DB-level `ON DELETE CASCADE` is unreachable under the soft-delete model;
no service issues hard DELETEs), child rows stay live in the DB and become
dormant — reachable only by joining through their parent. Reports and counts
MUST filter on the parent's liveness, not the child's own flag, or counts drift.

- *Wrong:* `COUNT(*) FROM project_items WHERE deleted_at IS NULL`
- *Right:* `COUNT(pi.*) FROM project_items pi JOIN projects p ON p.id = pi.project_id WHERE p.deleted_at IS NULL AND p.is_active = true`

The child's own flag will happily say "live" while its parent is gone. This is
the trade-off for cheap undelete (parent flip restores the whole subtree
intact, with all original relationships) — the discipline lives in the queries.
Same rule applies to every table that FKs to a soft-deletable parent:
`project_categories`, `project_items`, `project_item_suppliers`,
`estimate_items`, `messages`, and any future parent-child entity pair.

A backlog item exists to extract `_live` views (`project_items_live`,
`estimate_items_live`, etc.) that pre-join the parent liveness so reporting
queries can't forget. Until those land, every cross-entity report should
explicitly join through the parent chain.

**Coming in a follow-up commit this week:** the `audit.audit_log` table + an
entity-scoped audit trigger (full row-level history; junctions excluded). Until
then the 6 columns give who-touched-last from day 1. *(Row versioning is deferred
indefinitely — added surgically only if a customer need surfaces.)*

**New business table checklist:**
1. `SELECT audit.add_audit_columns('<schema>','<table>')` — pass `false` for a
   junction/sync table to keep it deletable.
2. Default repository scope excludes deleted rows (`deleted_at IS NULL`).
3. Delete method is `softDelete(id)` — never `delete(id)`.
4. Classify it in `SWEEP_soft_delete_audit.md`. **An unaccounted table is a violation.**

## Audit Checklist — Architectural Anti-Patterns

The "One Definition, One Role, One Application" law above states the principle.
This section is the **operational checklist** every substantive audit must run
through, not just answer its specific question.

**Why this exists:** every architectural drift bug we've found has been an
instance of the same meta-class — *shared standard, multiple definitions or
hand-applied at each consumer*. We were catching them retail, after they bit,
because audits were question-shaped ("is X consistent?") rather than
class-shaped ("what categories of inconsistency exist here?"). Naming the
classes turns reactive bug-hunting into proactive prevention.

### How to use this checklist

Every audit report (whether by a human, Claude, or any agent) must have
**two parts**:

1. **The specific finding** — answer to the question that triggered the audit.
2. **Standing-checklist scan** — explicit pass through the seven classes below,
   each either *"none found"* or a list of findings.

The second pass takes 5–10 extra minutes. It catches the next bug class before
it ships. Report template:

```
Audit: [question being asked]

Part 1 — Specific finding
[answer]

Part 2 — Standing checklist scan
- Duplicate source of truth: none found / [findings]
- Shared standard, hand-applied: none found / [findings]
- Overloaded token / key: none found / [findings]
- Behavioral drift across structural reuse: none found / [findings]
- Allow-list when default-on is correct: none found / [findings]
- Read/write key mismatch: none found / [findings]
- Container-coupled logic: none found / [findings]
```

### The seven anti-pattern classes

**1. Duplicate source of truth**

Same value or concept defined in more than one place. Synchronised by hand.
Drift is inevitable; the only question is when.

- *Examples we've hit:* `--theme-bg` defined in `styles.css` AND overwritten
  by `applyTheme()` in `config.service.ts`. A `DEFAULT_CONFIG` constant
  duplicated across client and server. Hardcoded fallback values inside
  `var(--token, fallback)` expressions that diverge from the canonical token.
  **Drawer / modal / live-save panels hand-rolling `bg-white` or `#ffffff`
  literals** while the shell inherits `var(--theme-bg)` — the local literal
  silently competes with the global token, so a colour sweep on the token
  doesn't fully propagate. Surface looks "missed" but the actual disease is
  two definitions for the same field's background.
- *How to spot it:* search for the same literal in more than one file. If a
  config value matters, it should be defined exactly once and imported
  everywhere else. For colour specifically, grep for any `bg-white`,
  `#ffffff`, `#fff`, or inline `style="background: ..."` outside the
  canonical token definition — every hit is a candidate disease site.
- *Fix:* delete every copy except one. Make the others import or reference
  it. For local literals competing with inheritance: delete the literal so
  the surface inherits naturally; if inheritance is wrong for that surface,
  use a *role-named* token (not another literal).

**2. Shared standard, hand-applied per consumer**

Pattern documented or convention established, but each consumer wires it
themselves rather than consuming a shared component or token. Every consumer
is a chance to drift.

- *Examples we've hit:* `bp-section` / `bp-field` markup hand-rolled per
  page (now `<app-edit-section>` + `<app-edit-field>`). `is-edit` class
  manually attached per field, one instance routed to the wrong DOM element
  on `p-inputNumber`. `bp-brief-*` parallel namespace invented from scratch
  for the project Event tab. **v1.67c** — the event form's bespoke Event
  type / Tier fields hand-rolled their *view-mode* input with
  `bp-field-readonly` (a `--theme-border` box) instead of the shared field's
  `.bp-fld` (transparent border); invisible on the drawer's parchment, it
  stood out as a stray border once the same form rendered on a white card.
- *How to spot it:* if two pages render the same chrome with hand-written
  markup, the chrome is hand-applied. If a CSS class appears as a literal
  string in N consumer templates, it's hand-applied.
- *Class-shaped, not question-shaped (the v1.67c lesson):* auditing a
  hand-rolled field by asking a yes/no question ("is `is-edit` routed
  through `styleClass`?") passes the field while missing a different state.
  Instead, for **every** field that deviates from the shared component,
  **diff its computed styles — BOTH view and edit — against a neighbouring
  `app-edit-field` on the SAME surface** (the white card, not the parchment
  drawer it was copied from). A hand-applied field is "compliant" only when
  it is pixel-indistinguishable from the shared component in *both* states.
  The v1.67c border slipped because the scan verified the edit path and
  assumed the view path was fine (it compiled and looked right on the
  surface it was lifted from). Beware two class names for one role
  (`bp-field-readonly` vs `.bp-fld` not-editing) — that is itself a
  duplicate-source-of-truth smell (#1) hiding inside a hand-applied field.
- *Fix:* extract to a shared component or directive; ban the underlying
  literal/class outside the extracted component's template.

**3. Overloaded token / key**

One name doing multiple unrelated jobs. Today the roles happen to want the
same value, so it's invisible. Tomorrow when they diverge, you can't separate
them without touching every consumer.

- *Examples we've hit:* `--theme-bg` painting the page ground, hero band,
  category circles, sidenav hover, and focus rings — five unrelated roles
  on one token. A `Config` object carrying mixed concerns (UI prefs +
  feature flags + role state).
- *How to spot it:* read the token's name out loud and list every place it's
  used. If the uses don't share a single sentence-length description, it's
  overloaded.
- *Fix:* split into role-named tokens (`--color-page-ground`,
  `--color-hero-bg`, `--color-fill`, `--color-focus-ring`). Do it before any
  divergence is needed, not after.

**4. Behavioral drift across structural reuse**

Same component used by N parents, but each parent's handlers do different
things. Structural audit ("are they using the same component?") says yes;
behavior diverges silently.

- *Examples we've hit:* `<app-catalogue-grid>` used by `/shop`,
  `/suppliers/:id`, `/projects/:id/marketplace`. Only `/shop`'s parent
  refilters entities on `categoryChanged`; the other two updated chip state
  only. User-visible bug: filters didn't work on two of three surfaces.
- *How to spot it:* when a shared component fires events, every parent
  handler must do the same conceptual work. If one parent's handler is
  longer or shorter than another's, that's the drift smell.
- *Fix:* move the behavior INTO the shared component where possible (so
  parents can't drift), or assert via test that all parents' handlers
  produce equivalent side effects.

**5. Allow-list when default-on is correct**

Opt-in configuration where the opt-out cases are rarer than the opt-in
cases. Inverts cleanly to default-on with explicit opt-outs.

- *Examples we've hit:* content-ground paint gated by
  `:has(catalogue-grid|messages-inbox|project-detail)` — settings,
  ballpark-settings, home, profile all silently fell through to bare white.
  A feature flag that's enabled for every customer (should just be a default).
  **Coordinated sweep across the app that hits the obvious surfaces but
  misses modals / drawers / live-save forms** — the sweep was structurally
  correct against the targets it knew about, but consumers outside the sweep
  scope silently opted themselves out. (Team's member-details drawer, the
  invite-member modal, ballpark-settings add-org / view-details drawers,
  early-access live-save form, feedback dialog — all surfaced in QC after a
  v1.66dn-style color sweep that was thought complete.)
- *How to spot it:* when adding a new page to an allow-list feels routine,
  the list is wrong. When the opt-outs are countable on one hand, default-on.
  For sweeps: any surface NOT enumerated in the sweep report (touched / verified /
  explicitly skipped) is a candidate miss — see the Sweep Completeness rule below.
- *Fix:* invert. Make the behavior the default; the rare opt-outs become an
  explicit exception list. For coordinated sweeps: enumerate every surface
  before the sweep runs, not after.

**6. Read/write key mismatch**

Write under one key, read under another. Code compiles, runtime returns
undefined or wrong values.

- *Examples we've hit:* drawer wrote page-settings keyed by `role='agent'`;
  consumer read keyed by `kind='agency'`. Migration wrote `org_type='platform'`;
  routes resolved by checking `org_type='admin'`.
- *How to spot it:* every place a config is *written* must use a key
  string identical to where it's *read*. Audit the storage shape end to end:
  write call site → storage key → read call site. If those three don't share
  a typed constant, drift is one rename away.
- *Fix:* centralize the key as a typed constant or enum, import everywhere.

**7. Container-coupled logic**

Behavior tied to drawer / modal / page rather than to the operation. When
you move the operation to a different container, the logic breaks.

- *Examples we've hit:* save handlers that only worked inside drawer
  chrome (relied on drawer lifecycle events). Validation tied to modal
  open/close rather than form submit.
- *How to spot it:* ask "if this operation moved from a drawer to a page,
  would the save/validation still work?" If no, the logic is
  container-coupled.
- *Fix:* extract the operation into a service or self-contained component;
  let containers mount it but not own it.

### Sweep Completeness — procedural rule for coordinated changes

When running a change that should affect "every editable surface" or
"every page" or any other app-wide claim, the report must explicitly
enumerate three categories before the commit lands:

1. **Surfaces changed** — every file/component the sweep modified.
2. **Surfaces verified unchanged** — every consumer of the affected token /
   class / pattern that was checked and confirmed to inherit the new
   behaviour without modification (the inheritance / default-on case).
3. **Surfaces explicitly skipped** — every consumer that was intentionally
   not touched, *with the reason* (e.g., "live-save form, no Edit/Save
   lifecycle so the new component shape doesn't apply").

**Anything not in those three categories is a candidate miss.** A surface
that's editable but doesn't appear in any list is by definition unverified —
the sweep author either forgot it exists or hand-waved past it.

The enumeration is done **before** the commit lands, not after the QC
catches the leftovers. Cost: ~10 minutes scrolling the codebase. Benefit:
the leftovers don't ship and don't accumulate.

How to build the enumeration:
- Start from a grep that targets the affected token / class / pattern.
  Every match is a candidate consumer.
- For each match, classify: change / verify-inheritance / skip-with-reason.
- The report's enumeration is that classified list. If a class is empty,
  state it: "Surfaces skipped: none."

Examples this rule would have caught:
- The v1.66dn `:has()`-removal commit should have enumerated every page in
  the app and classified each (the settings / ballpark-settings / home pages
  would have appeared as "verified inheritance" and the inheritance failure
  would have surfaced before the commit, not in QC two days later).
- The Tier 1 → Tier 2 component-adoption work should have enumerated every
  editable surface in the app (drawers, modals, live-save forms included)
  and classified the Tier 2 deferrals explicitly. Then the missed surfaces
  Liam flagged in QC (member details, invite member, add org, view details,
  early access, feedback) would have shown up as "Pass 2 — deferred,
  awaiting sign-off" rather than as silent leftovers.

This rule applies to:
- Any commit that touches a CSS token consumed across the app
- Any commit that introduces a shared component intended to replace
  hand-rolled markup
- Any commit framed as "apply X to every Y"
- Any commit whose name or description contains "sweep", "all", "every", or
  "global"

It does NOT apply to localised changes (one component, one bug, one feature).
The rule's value is in coordinated changes whose scope is implicit; making
the scope explicit is the whole point.

### Convert what can be automated into guards

Not every anti-pattern can be linted; the ones that can, should be.

| Pattern | Possible guard |
|---|---|
| #1 — Duplicate source of truth | Lint rule banning inline `style="background: ..."` in templates; require token usage |
| #2 — Hand-applied standard | Lint rule banning specific class literals (`bp-fld`, `is-edit`) outside the extracting component's template |
| #4 — Behavioral drift | Structural test: every parent of `<app-catalogue-grid>` must call a method that mutates the entities array in `onCategoryChanged` |
| #6 — Read/write key mismatch | Typed constants for storage keys; type-check on get/set |

The catch-net is not a substitute for the checklist. Patterns #3, #5, and #7
require human judgment. The checklist is the durable mechanism; automation
is the additional safety net where possible.

### Adding to this checklist

When a new bug class is discovered that doesn't fit one of the seven
patterns above, add it as a new line item with:
- Pattern name
- Example bug that revealed it
- How to spot it
- Fix shape

The list grows over time. Every architectural drift bug becomes a permanent
diagnostic line item so future audits catch it without anyone having to
remember to look.

## Extract Before Duplicate

When adding a UI block to a second page, if it would mean copying:

- more than ~30 lines of template, OR
- more than ~3 handler methods, OR
- any state that needs to sync via a service,

**stop and extract first.** Run
`ng generate component shared/components/<name>` (or hand-author the
standalone component) BEFORE the duplicate exists. Two or more of the
above criteria triggering means extraction is mandatory, not optional.

Symptom of skipping this rule: when you later need to change the shared
behaviour, you'll change it in one place and silently leave the other
broken. That's exactly the bug class v1.65hC/hD introduced — the
settings cog disappeared on home after agent's strip was copy-pasted
from dashboard, and the underlying ViewChild lifecycle issue (see
below) only bit once the duplication existed.

Resolved in p0016 (v1.65hG / v1.65hH) by extracting
`<app-page-config-strip>` as the single source of truth for the page
settings strip; dashboard + agent now mount it with a single tag.

### Page chrome — separate rule, same spirit

The Extract Before Duplicate rule above catches markup copy-paste. Page
chrome (title + subtitle blocks, section cards, edit-form scaffolding)
tends to be hand-rolled per page from scratch rather than copied, so
the headline rule silently skips it. Add this as a complementary check:

When introducing a new page or sub-page that has a title, subtitle, or
section-card structure: check `client-angular/src/app/shared/components/`
for an existing component before hand-rolling the markup.

Examples of page chrome that should be shared:
- Page header: large serif title + smaller muted subtitle on parchment
  → use `<app-page-header>` (when introduced)
- Summary card: titled card with label/value pairs + optional footer
  action → use `<app-section-card>` (when introduced)
- Edit-form section: colored eyebrow + edit pencil + form field grid
  → use `<app-edit-section>` (when introduced)

If a needed component doesn't exist yet and the chrome is non-trivial
(>20 lines of markup, multiple labels/states, or appears in a second
location), extract it as part of the prompt that introduces the page.

Page chrome that's hand-rolled in three or more pages becomes a
mandatory-extraction backlog item before the fourth surface is built.

### Marking debt with `<app-update-me>`

When you encounter hand-rolled page chrome on an existing page and
don't have time to refactor it in the current commit, mark it with
the `<app-update-me reason="...">` banner component (introduced in
p0035). The banner renders only in dev (never production) and shows
in the dev environment as a constant nag — `UPDATE ME — adopt
<app-page-header> when next refactoring this page`.

This makes the debt visible to whoever next opens the page, and
greppable via `grep -rn "<app-update-me" client-angular/src/app` for
a live list of remaining work. The banner is removed when the page
adopts the real shared component.

Use sparingly — the banner is a "saw it, leaving for next pass"
marker, not a "this should stay hand-rolled" comment.

---

## Angular Component Standards — client-v2

The v2 app (`client-v2/`) holds components to stricter standards than v1:
standalone only, `ChangeDetectionStrategy.OnPush` mandatory, strict TS / no
`any`, signals + `@if`/`@for`/`@switch` control flow, `inject()` over
constructor injection, Lucide via `.pick({})`. The rules below extend that set.

### Component is the element — no wrapping

A v2 standalone component's template MUST NOT begin with a wrapper element that
re-states what the component already is (e.g. an inner `<header>` inside an
`<app-page-hero>`, or a root `<div class="bp-foo">` inside an `<app-foo>`).

Instead, bind the root class and variant modifiers to the host element via
`host:` in the component decorator. The component instance IS the styled
element.

**Wrong** — wastes a DOM element, doubles styling targets:
```typescript
@Component({
  selector: 'app-page-hero',
  template: `<header class="bp-page-hero">...</header>`,
})
```

**Right** — `<app-page-hero>` is itself the band:
```typescript
@Component({
  selector: 'app-page-hero',
  host: {
    'class': 'bp-page-hero',
    '[class.bp-page-hero--align-center]': "align() === 'center'",
  },
  template: `...`,    // no outer wrapper
})
```

Apply to every v2 component in `client-v2/`. If a child component genuinely
needs ONE inner wrapper (rare — usually because of a semantic HTML requirement
like `<form>` or `<table>`), the wrapper does NOT carry the component's root
class; the host element does.

This rule applies ONLY to `client-v2/` going forward. Existing v1 components in
`client-angular/` are not retroactively refactored.

---

## Angular ViewChild

**`@ViewChild('ref', { static: true })` is forbidden when the target
lives inside any structural directive** — `*ngIf`, `*ngFor`,
`<ng-template>`, or a conditional `<ng-container *ngIf>`.

`static: true` resolves the query BEFORE the first change-detection
cycle, which is before structural directives have run. The query
returns `undefined` and any code in `ngOnInit` / `ngAfterViewInit`
that depends on it silently fails (no error, no warning — just a
no-op call with an undefined argument).

Default behaviour (`static: false`, resolves AFTER the first CD cycle)
is correct for these cases. Just omit the second argument:

```typescript
// ❌ Wrong — template is inside *ngIf="someFlag"
@ViewChild('tpl', { static: true }) tpl!: TemplateRef<any>;

// ✅ Correct — resolves after CD, when *ngIf has run
@ViewChild('tpl') tpl?: TemplateRef<any>;
```

`static: true` is appropriate ONLY when the target element is
unconditionally in the DOM at component creation (no structural
directive above it). In that narrow case, add a comment explaining
why static is safe.

This rule was added after the dashboard settings cog disappeared on
home (p0016): dashboard's `cfgStripTpl` was inside
`*ngIf="activeTab === 'projects'"` but queried with `static: true`,
so `setTemplate(undefined)` ran on every navigation back to home.

---

## Lucide Icons Standard

```
Always use LucideAngularModule.pick() — never bare LucideAngularModule
Register only the icons used in that component

Example:
  imports: [ LucideAngularModule.pick({ SquarePen, ChevronRight }) ]
  Template: <lucide-icon name="square-pen" [size]="16"></lucide-icon>

Standard icons:
  square-pen    → edit actions (always)
  chevron-right → row navigation
  chevron-left  → back navigation
  heart         → favourite toggle
  search        → search inputs
  layers        → catalogue / all
  building-2    → suppliers / orgs
  map-pin       → location
  check         → confirm (use pi pi-check in drawers)
  x             → cancel (use pi pi-times in drawers)
```

---

## Status Pill Standard

```
Component: app-status-badge
  <app-status-badge [status]="entity.status_name">
  </app-status-badge>

Design:  11px, font-weight 600, border-radius 20px, UPPERCASE
         0.5px border always (Option A)
         Coloured dot for project + lead statuses

Colours: ONLY in styles.css — never in components
  Project:  active (green), draft (yellow), costing (blue),
            closed/completed/cancelled (gray)
  Lead:     sent (purple), quoted (blue), confirmed (green),
            declined (red), pending (yellow), accepted (green)
  Roles:    owner (parchment), member (gray), admin (purple)

Never: Use p-tag for status badges
       Define pill colours in component files
```

---

## Backend Laws

```
Routes     → Thin controllers only
             Validate input → call service → return response
             Never write SQL in a route handler
             All protected routes use authenticate middleware
             Org-scoped routes use /api/orgs/:id/... pattern

Services   → All business logic and SQL
             One file per domain: server/src/services/
             Org services always accept org_id as parameter
             Never use getCurrentAgency() — use req.user.org_id

Auth       → authenticate() middleware on all protected routes
             req.user set by middleware — never trust body/params for org_id
             authorise(['owner','admin']) for role-restricted actions

Errors     → Always use next(err)
             Never res.status(500).json() in routes
             Centralised handler in index.js

Config     → dotenv called ONCE in index.js
             All env vars via process.env
             Never hardcode URLs, credentials or org IDs

CORS       → Driven by ALLOWED_ORIGINS env var
             credentials: true required for httpOnly cookie auth
SSL        → Conditional on NODE_ENV
```

---

## Database Schema Architecture

One Supabase PostgreSQL instance, four schemas:

```
public   → dev        Local development. Default schema.
preview  → preview    QA and stakeholder demos.
master   → production Production. Empty until launch.
shared   → all envs   Cross-environment tables:
                        shared.feedback            (bugs, features, meeting notes)
                        shared.feedback_categories (folder/issue/area types)
                        shared.feedback_links      (sprint/release/area references)
                        shared.backlog             (legacy — superseded by feedback)
                        shared.bugs                (legacy — superseded by feedback)
                        shared.feature_flags       (per-env feature toggles)
                        shared.auth_sessions       (refresh tokens)
```

### Auth tables (in each env schema)
```sql
users
  id, org_id, name, email, google_id, avatar_url
  role (owner/admin/member), is_platform_admin
  is_active, created_at, updated_at

auth_sessions (in shared schema)
  id, user_id, refresh_token (hashed), expires_at
  user_agent, ip_address, created_at
  Cleaned up by nightly job
```

### Schema switching
```
APP_SCHEMA env var controls which schema the server uses.
pool.js sets search_path on every connection automatically.
No table prefixes needed in service files.

Local .env:        APP_SCHEMA=public
Railway preview:   APP_SCHEMA=preview
Railway production: APP_SCHEMA=master
```

---

## Environment Variables

```
Local (.env):
  APP_SCHEMA=public
  DATABASE_URL=...
  SUPABASE_SERVICE_ROLE_KEY=...
  STORAGE_BUCKET_PROJECTS=dev-project-assets
  STORAGE_BUCKET_SUPPLIERS=dev-supplier-assets
  GOOGLE_CLIENT_ID=...
  GOOGLE_CLIENT_SECRET=...
  GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
  JWT_SECRET=...
  JWT_EXPIRY=1h
  COOKIE_SECRET=...
  ANTHROPIC_API_KEY=...
  UNSPLASH_ACCESS_KEY=...
  RESEND_API_KEY=...
  EMAIL_FROM=noreply@theballpark.ai

Railway preview:
  APP_SCHEMA=preview
  GOOGLE_CALLBACK_URL=https://[preview-railway-domain]/api/auth/google/callback
  COOKIE_DOMAIN=.theballpark.ai
  STORAGE_BUCKET_PROJECTS=preview-project-assets
  STORAGE_BUCKET_SUPPLIERS=preview-supplier-assets

Railway production:
  APP_SCHEMA=master
  STORAGE_BUCKET_PROJECTS=project-assets
  STORAGE_BUCKET_SUPPLIERS=supplier-assets
```

---

## File Locations

```
client-angular/src/
  app/
    core/
      services/     → Singleton services (one per domain)
      guards/       → AuthGuard, RoleGuard
      interceptors/ → auth.interceptor.ts (credentials: include)
      models/       → TypeScript interfaces (one file per entity)
    shared/
      components/   → Reusable presentational components
      services/     → Utility services (StorageService etc)
      pipes/        → GbpPipe
    layout/
      top-nav.component.ts
    features/
      auth/         → login, enrollment, callback
      dashboard/
      settings/
      projects/
      suppliers/
      catalogue/
      feedback/
      clients/
  styles.css        → SINGLE SOURCE OF TRUTH for all PrimeNG overrides

server/src/
  index.js          → Express entry, route mounting, CORS, error handler
  middleware/
    authenticate.js → JWT verification, sets req.user
    authorise.js    → Role-based access control
  routes/           → Thin controllers (one file per domain)
  services/         → Business logic + SQL (one file per domain)
  db/
    pool.js         → PostgreSQL connection (env-driven schema)
    migrate.js      → Dev schema creation
    migrate-schemas.js → Preview/master/shared schema creation
    log-commit.js   → Inserts commit to internal.project_log
```

---

## The Test

Before submitting any code or design, ask:

> "Would a senior Angular/Node developer look at this
>  and feel at home immediately?"

If no — redesign or restructure before committing.

> "Does every button, input, and modal look
>  identical to every other button, input, and modal?"

If no — use the standard components.

> "Does this route handler contain SQL or business logic?"

If yes — move it to the service layer.

> "Is org_id coming from the request body instead of req.user?"

If yes — security violation, fix immediately.

---

## Closing List — near-term standards work

Standing tracker for committed-to standards work that is scoped but not yet
landed. Distinct from the open-ended backlog: every item here has an agreed
shape and a **trigger** that says when it must be done by. Pull from the top.

### NEAR-TERM

**Zero-shift `<app-edit-field type="select">`.** Promote the deferred
select to a first-class, verified field type so dropdowns stop being
hand-rolled. Today `.bp-fld` / `.is-edit` only style `.p-inputtext`, so a
`p-dropdown` routed through the shared field picks up neither the view
(transparent-border, plain-text) nor the edit (grey-fill) treatment — which
is why status / event-type / tier are still bespoke (see the Drawer Standard
deferral note and `edit-field.component.ts` header).

- *Shape:* extend `styles.css` so `.bp-fld` / `.bp-fld.is-edit` cover
  `.p-dropdown` (label metrics + 38/34px height + transparent→grey-fill
  border) with zero view↔edit shift; then convert the bespoke
  status/event-type/tier dropdowns (and unblock item-drawer / feedback-drawer)
  to `app-edit-field type="select"`. App-wide blast radius — do it as a
  dedicated pass with the full Sweep Completeness enumeration.
- *Trigger:* **before any new surface adds a hand-rolled dropdown.** Each new
  bespoke `p-dropdown` is another hand-applied consumer (anti-pattern #2) and
  another v1.67c-class divergence waiting to happen. If a prompt would add
  one, land this first.

When an item lands, move it to Version History and delete it here.

---

## Version History

```
v1.0   Foundation — Express + Angular + Supabase + Railway + Vercel
v1.1   Design system — Option D, themes, dark mode, Lucide icons
v1.2   Architecture — service layer, PrimeNG migration, storage
v1.3   Settings — all 5 tabs, AppShell, ShellContext, multi-schema DB
v1.4   Dashboard + mobile — project cards, bottom nav, supplier browse,
       favourites, messages, build tab, item detail
v1.5   Hero + dark mode — CSS variables, standardised hero
v1.6   CatalogueGridComponent — unified grid, image treatments
v1.7   Feedback + categories — meeting notes, namespace hierarchy,
       taxonomy switcher, feedback capture
v1.8   Image upload — tabbed dialog, Unsplash, Lucide icon picker
v1.9   Welcome page — guestlist signup, Inter font, brand palette
v1.10  Welcome polish — SVG circles, colour matrix
v1.11  Feedback + markdown editor — priority + target_version,
       tabular feedback view, app-markdown-editor (reusable rich
       text editor with toolbar, preview, table support),
       working standards: feature note standard + feature
       logging rule
v2.0   Auth + service refactor — Google SSO, JWT, route conventions,
       org-scoped services, role-based access (next)
```
