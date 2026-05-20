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

One Railway PostgreSQL instance, four schemas:

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
