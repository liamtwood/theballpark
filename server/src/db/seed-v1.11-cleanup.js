// v1.11 cleanup — reformat all feature-spec entries to WORKING_STANDARDS
// Feature Note Standard, backfill version + shipped_date for the four
// v1.11 shippers, and insert the Test Case + Acceptance Criteria specs.
//
// Idempotent: every UPDATE is keyed on title; INSERTs use ON CONFLICT-style
// "select first" to avoid duplicates.
//
// Run: NODE_PATH=…/server/node_modules node server/src/db/seed-v1.11-cleanup.js

const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const SHIP_DATE = '2026-04-30';

// ── 1. Version + shipped_date map (Task 3 — backfill) ─────────────────────
const SHIPPED_MAP = [
  ['Foundation — Angular + Node.js + Supabase Stack',     'v1.0',  '2026-03-17'],
  ['Design System — Theme, CSS Variables, Dark Mode',     'v1.1',  '2026-03-19'],
  ['AppShell — Hero Banner + Shell Context',              'v1.3',  '2026-03-22'],
  ['Settings — Organisation Tab',                          'v1.3',  '2026-03-22'],
  ['Settings — Team Tab',                                  'v1.3',  '2026-03-22'],
  ['Settings — Marketplace (Appearance) Tab',              'v1.3',  '2026-03-22'],
  ['Settings — Categories Tab',                            'v1.7',  '2026-04-13'],
  ['Settings — Subscription Tab',                          'v1.3',  '2026-03-22'],
  ['Settings — Ballpark Admin (Orgs + Marketplace)',       'v1.9',  '2026-04-27'],
  ['Dashboard — Project Cards + Supplier Panel',           'v1.4',  '2026-03-23'],
  ['Mobile — Bottom Navigation',                           'v1.4',  '2026-03-23'],
  ['Supplier — Browse + Detail + Quote Drawer',            'v1.6',  '2026-04-09'],
  ['Favourites — Suppliers + Items',                       'v1.4',  '2026-03-23'],
  ['Messages — Inbox + Thread View',                       'v1.4',  '2026-03-23'],
  ['Project — Detail Shell + Brief Tab + Build Tab',       'v1.4',  '2026-03-23'],
  ['Catalogue — Browse + Items + CatalogueGridComponent',  'v1.7',  '2026-04-13'],
  ['Image Upload — Tabbed Dialog (Upload/Search/Icon)',    'v1.8',  '2026-04-14'],
  ['Feedback - Capture + Grid + Issue/Folder/Note',        'v1.7',  '2026-04-13'],
  ['Meeting Notes - /meeting/:id Page',                    'v1.7',  '2026-04-13'],
  ['Welcome Page + Guestlist Signup',                      'v1.9',  '2026-04-27'],
  ['Technical — Storage, Health, Keep-Alive, Seed Guards', 'v1.8',  '2026-04-15'],
  ['Rich Text Editor — app-markdown-editor',               'v1.11', SHIP_DATE],
  ['Feedback - Edit Drawer',                               'v1.11', SHIP_DATE],
  ['Feedback - Table View',                                'v1.11', SHIP_DATE]
];

// ── 2. Reformatted notes for every feature-spec entry ─────────────────────
// Format follows WORKING_STANDARDS Feature Note Standard:
//   ## Title
//   [description]
//   ### Object | Attributes | Actions | Special behaviours | Used in | Technical
const NOTES = {
  'Foundation — Angular + Node.js + Supabase Stack':
`## Foundation

The platform infrastructure that hosts every feature in Ballpark. Angular
on the frontend, Node.js/Express on the backend and Supabase PostgreSQL for
storage. Vercel deploys the SPA, Railway runs the API.

### Object
Platform infrastructure stack

### Attributes
- **frontend**: framework — Angular 17 standalone components
- **backend**: framework — Node.js + Express service-layer
- **database**: engine — Supabase PostgreSQL
- **deploy**: targets — Vercel (frontend), Railway (backend)
- **branches**: strategy — dev → preview → master

### Actions
- **Run** — local dev via npm run dev (FE + BE)
- **Deploy** — push to dev/preview/master triggers Vercel + Railway
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Multi-schema database (public/preview/master/shared) for env isolation
- CORS allowlist tied to deployed origins
- Environment configs override per-build

### Used in
- **All features** — every product surface depends on this stack

### Technical
- **Component**: monorepo
- **Path**: client-angular/ + server/
- **Depends on**: Angular 17, Express, pg, Supabase`,

  'Design System — Theme, CSS Variables, Dark Mode':
`## Design System

The visual language of Ballpark — typography, theme colours, spacing,
components. Built on CSS variables so dark mode and theme presets switch
without refactor. Standardises status pills, field labels, icons.

### Object
Design system tokens + shared components

### Attributes
- **layout**: variant — Option D
- **themes**: presets — 5 selectable accent colours
- **mode**: toggle — dark / light
- **fonts**: pairing — Playfair Display + Libre Franklin
- **icons**: library — Lucide via LucideAngularModule.pick()

### Actions
- **Switch theme** — pick a preset in marketplace settings
- **Toggle mode** — switch dark/light from top nav
- **Copy** n/a
- **Move** n/a

### Special behaviours
- All colours are CSS variables, no hardcoded hex
- PrimeNG + Tailwind + CSS vars three-layer rule
- app-status-badge unified status pill component
- bp-field-label standard for view/edit fields
- GbpPipe formats currency consistently

### Used in
- **All pages** — applied globally via styles.css and provider

### Technical
- **Component**: shared design system
- **Path**: client-angular/src/styles.css + shared/components/
- **Depends on**: PrimeNG, Tailwind, lucide-angular`,

  'AppShell — Hero Banner + Shell Context':
`## AppShell

The single layout shell that wraps every authenticated page. Owns the
hero banner, navigation tabs and layout mode. Pages set their own hero
content via ShellContextService so the banner stays in sync with the route.

### Object
AppShellComponent + ShellContextService

### Attributes
- **hero_title**: string — top-line page identity
- **hero_subtitle**: string — secondary context label
- **pills**: array — small contextual chips beside the hero
- **tabs**: array — page-level tab definitions
- **nav_mode**: enum — tabs | sidenav
- **hero_align**: CSS var — controls horizontal alignment

### Actions
- **Set context** — pages call shell.setContext({ … }) on init
- **Switch tab** — clicks route through Angular Router
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Hero is fixed, content scrolls underneath
- Mobile hides nav-right + pills automatically
- Project pages own the hero via ShellContextService

### Used in
- **All authenticated routes** — applied via app-shell wrapper

### Technical
- **Component**: app-shell
- **Path**: client-angular/src/app/layout/
- **Depends on**: ShellContextService, RouterModule`,

  'Settings — Organisation Tab':
`## Organisation Settings

The tab where an org admin manages identity — name, contact details,
logo and cover image. Uses the global view/edit pattern so the same
inputs render in both modes with no layout shift.

### Object
Organisation (org row) editing surface

### Attributes
- **name**: string — public org name
- **city**: string
- **email**: string — primary contact
- **phone**: string
- **logo_url**: image — square logo
- **cover_image_url**: image — banner

### Actions
- **View** — readonly fields with always-visible pencil
- **Edit** — toggle to bp-input-edit, save via tick / discard via X
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Always-visible pencil prevents header height shift
- Readonly inputs match edit padding for zero layout shift
- Parchment background on edit fields

### Used in
- **Settings shell** — first tab on /settings

### Technical
- **Component**: app-organisation
- **Path**: client-angular/src/app/features/settings/organisation/
- **Depends on**: OrganisationService, ImageUploadPanelComponent`,

  'Settings — Team Tab':
`## Team Settings

The tab where org admins invite and manage team members. Lists members
with role + avatar, supports invite codes (single or multi-use) and the
standard list/card view toggle pattern.

### Object
Team Member (org user)

### Attributes
- **name**: string
- **email**: string
- **role**: enum — admin | member
- **avatar**: image
- **joined_at**: timestamp

### Actions
- **View** — list/card dataView
- **Add** — invite by email or code
- **Edit** — change role
- **Delete** — remove member
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Single-use and multi-use invite codes
- Filter sidebar + sort + search
- Row click opens drawer in view mode
- Pencil/tick/cross edit pattern matches Organisation tab

### Used in
- **Settings shell** — Team tab

### Technical
- **Component**: app-team
- **Path**: client-angular/src/app/features/settings/team/
- **Depends on**: TeamService, p-dataView`,

  'Settings — Marketplace (Appearance) Tab':
`## Marketplace Settings

Controls the brand presentation of the org's storefront — platform name,
catalogue label, theme + font pairing, logo and hero appearance. Shows a
live preview dialog so admins see the change before saving.

### Object
Marketplace / Appearance settings

### Attributes
- **platform_name**: string
- **catalogue_label**: string — terminology shown in nav
- **theme**: enum — preset accent
- **font_pairing**: enum — display + body combo
- **logo_url**: image
- **hero_*** controls — alignment, image, height

### Actions
- **View** — readonly with pencil
- **Edit** — bp-input-edit fields
- **Preview** — opens live preview dialog
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Live preview dialog renders sample storefront
- Logo upload via ImageUploadPanelComponent
- Catalogue label flows through nav and headings

### Used in
- **Settings shell** — Marketplace tab

### Technical
- **Component**: app-marketplace
- **Path**: client-angular/src/app/features/settings/marketplace/
- **Depends on**: MarketplaceService`,

  'Settings — Categories Tab':
`## Categories Settings

The admin surface for managing categories across both Catalogue and
Feedback namespaces. Uses CatalogueGridComponent for the list, drawer
for editing, ImageUploadPanelComponent for icons + cover images.

### Object
Category (admin row)

### Attributes
- **name**: string
- **namespace**: enum — catalogue | feedback | area
- **level**: integer — depth in hierarchy
- **parent_id**: uuid — null for top-level
- **org_id**: uuid — null for shared
- **tagline**: string
- **description**: text
- **tags**: text[]
- **cover_image_url**: image
- **icon_name**: string — Lucide name
- **icon_color**: CSS var
- **card_color**: CSS var
- **enabled**: boolean

### Actions
- **Add** — create new category
- **Edit** — drawer form
- **Delete** — soft (sets enabled=false)
- **Reorder** — drag to change sort_order
- **Copy** n/a
- **Move** yes — change parent_id

### Special behaviours
- Namespace circles isolate Catalogue vs Feedback
- Hierarchy supports parent/child via parent_id + level
- Image upload uses Upload / Search / Icon tabs
- Feedback category seed kept in sync via migration

### Used in
- **Ballpark settings** — Categories tab
- **Catalogue + Feedback** — circles read from this table

### Technical
- **Component**: app-categories
- **Path**: client-angular/src/app/features/ballpark-settings/categories/
- **Depends on**: CategoryService, CatalogueGridComponent, ImageUploadPanelComponent`,

  'Settings — Subscription Tab':
`## Subscription Settings

Shows the org's current plan, Ball balance and renewal date. Read-only in
the current build — Stripe integration and upgrade/downgrade is on the
v2.0 backlog.

### Object
Subscription summary card

### Attributes
- **plan**: enum — free | pro | enterprise
- **ball_allowance**: integer — monthly credits
- **renewal_date**: date
- **balance**: integer — current Ball balance

### Actions
- **View** — read-only plan card
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Ball balance also surfaced in nav
- Upgrade/downgrade pending Stripe integration

### Used in
- **Settings shell** — Subscription tab

### Technical
- **Component**: app-subscription
- **Path**: client-angular/src/app/features/settings/subscription/
- **Depends on**: SubscriptionService`,

  'Settings — Ballpark Admin (Orgs + Marketplace)':
`## Ballpark Admin

Cross-org platform admin shell. Lists every org, every category, the
shared marketplace settings and the early-access guestlist. Restricted
to platform admins.

### Object
Platform admin shell

### Attributes
- **orgs**: list — every org row
- **categories**: list — namespace-aware
- **marketplace_settings**: object — global defaults
- **guestlist**: list — early access signups

### Actions
- **View** — every tab
- **Add** — orgs, categories
- **Edit** — orgs, categories, marketplace settings
- **Delete** — orgs (soft), categories (soft)
- **Copy** n/a
- **Move** yes — categories support parent change

### Special behaviours
- Orgs tab uses CatalogueGridComponent
- Early access tab admin endpoints
- Restricted via is_admin() role check

### Used in
- **/ballpark-settings** — platform admin route

### Technical
- **Component**: app-ballpark-settings
- **Path**: client-angular/src/app/features/ballpark-settings/
- **Depends on**: CategoryService, OrgService, GuestlistService`,

  'Dashboard — Project Cards + Supplier Panel':
`## Dashboard

The home page after login. Three columns: project cards (centre),
supplier panel (right) and stats / Ball balance (left). Surfaces the
projects and suppliers most relevant to the user.

### Object
Dashboard view

### Attributes
- **active_projects**: list — project cards with venue + client logo
- **completed_projects**: list — archived
- **suppliers_panel**: list — recent / featured suppliers
- **balls_balance**: integer
- **stats**: object — credits, projects, quotes counts

### Actions
- **View** — read-only
- **Open project** — click card to navigate
- **Open image upload** — pencil on card edits cover image
- **Copy** n/a
- **Move** n/a

### Special behaviours
- 3-column layout, mobile collapses to tabs
- Cards show venue cover + overlaid client logo + status badge
- Supplier portfolio images on cards
- Dark-mode compliant via CSS vars

### Used in
- **/** — primary post-login route

### Technical
- **Component**: app-dashboard
- **Path**: client-angular/src/app/features/dashboard/
- **Depends on**: ProjectService, SupplierService`,

  'Mobile — Bottom Navigation':
`## Mobile Bottom Navigation

The mobile-only bottom tab bar. Switches between Home / Suppliers /
Favourites / Messages globally and Home / Project / Suppliers /
Favourites / Messages while inside a project. Includes a FAB.

### Object
Mobile nav component

### Attributes
- **default_items**: array — Home, Suppliers, Favourites, Messages
- **project_items**: array — Home, Project, Suppliers, Favourites, Messages
- **fab**: button — context-sensitive primary action

### Actions
- **Navigate** — taps route via Angular Router
- **Switch context** — auto-swaps items on project entry
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Detects project context via route param
- Hidden on desktop breakpoints
- Dark-mode compliant

### Used in
- **All authenticated mobile views** — bound to viewport

### Technical
- **Component**: app-bottom-nav
- **Path**: client-angular/src/app/layout/
- **Depends on**: RouterModule, ShellContextService`,

  'Supplier — Browse + Detail + Quote Drawer':
`## Suppliers

Browse, filter and inspect suppliers. The detail page surfaces the
supplier's catalogue plus a quote drawer that captures a project-scoped
brief. Reuses CatalogueGridComponent across browse and supplier shop.

### Object
Supplier (org with type='supplier')

### Attributes
- **name**: string
- **city**: string
- **cover_image_url**: image
- **logo_url**: image
- **image_display**: enum — cover | contain
- **description**: text
- **categories**: list

### Actions
- **View** — list + detail
- **Favourite** — heart toggle
- **Request quote** — opens drawer
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Two-slot cover/logo upload with auto-detect rendering
- Three-treatment image rendering (cover / logo / initials)
- Quote drawer collects project + categories + brief
- Category filter sidebar + search + list/grid toggle

### Used in
- **/suppliers** — browse + detail
- **Supplier shop front** — embedded CatalogueGridComponent

### Technical
- **Component**: app-supplier-list, app-supplier-detail
- **Path**: client-angular/src/app/features/suppliers/
- **Depends on**: SupplierService, CatalogueGridComponent`,

  'Favourites — Suppliers + Items':
`## Favourites

A user-level wishlist for suppliers and catalogue items. Hearts on every
card toggle membership; the Favourites page is the dedicated view with
Suppliers / Items sub-tabs.

### Object
Favourite (org_id, entity_type, entity_id)

### Attributes
- **org_id**: uuid — owner
- **entity_type**: enum — supplier | item
- **entity_id**: uuid

### Actions
- **Add** — heart toggle
- **Remove** — heart toggle
- **View** — Favourites page with sub-tabs
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Hearts on supplier cards, item cards, list rows
- Filled red when active

### Used in
- **/favourites** — dedicated page
- **Dashboard** — Favourites tab on mobile
- **Catalogue + Suppliers** — heart on every row/card

### Technical
- **Component**: app-favourites
- **Path**: client-angular/src/app/features/favourites/
- **Depends on**: FavouriteService (backend table + routes)`,

  'Messages — Inbox + Thread View':
`## Messages

The unified inbox for project-supplier conversations. Vendor-grouped
inbox view with category icons and status colour coding; thread view
with quote item cards that the user can accept inline.

### Object
Message + Quote item

### Attributes
- **project_id**: uuid
- **supplier_id**: uuid
- **category**: enum
- **status**: enum — action | waiting | quoted | booked
- **thread_items**: list — body + author + ts
- **quote_cards**: list — line items with Accept button

### Actions
- **View** — vendor-grouped inbox + thread
- **Send** — accept quote item
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Same component used as project tab and global inbox
- Status colour coding per pill
- Quote cards inline within thread view
- Auto-selects project from nav context

### Used in
- **/messages** — global inbox
- **Project messages tab** — project-scoped view

### Technical
- **Component**: app-messages
- **Path**: client-angular/src/app/features/messages/
- **Depends on**: MessageService, QuoteService`,

  'Project — Detail Shell + Brief Tab + Build Tab':
`## Project Detail

The project workspace — shell with Brief / Build / Estimate / Messages
tabs. Brief captures the event details; Build is where category briefs
turn into vendor selections and quote requests.

### Object
Project (with tab-scoped sub-objects)

### Attributes
- **name**: string
- **client_id**: uuid
- **event_date**: date
- **brief**: text
- **status**: enum
- **categories**: list — project_categories rows
- **estimate_summary**: object

### Actions
- **View** — all tabs
- **Edit** — Brief tab
- **Add category** — Build tab drawer
- **Request quote** — Build tab vendor selection
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Project context retained across nav
- Build tab: category brief → vendor selection → quote request
- Estimate summary with budget indicator
- Back arrow in hero on supplier detail

### Used in
- **/projects/:id** — primary route
- **Project tabs** — Brief, Build, Estimate, Messages

### Technical
- **Component**: app-project-detail (+ tabs)
- **Path**: client-angular/src/app/features/projects/pages/project-detail/
- **Depends on**: ProjectService, EstimateService, MessageService`,

  'Catalogue — Browse + Items + CatalogueGridComponent':
`## Catalogue

The unified item + supplier browse experience. Built around
CatalogueGridComponent so the same grid renders the public catalogue,
the per-supplier shop front and the org settings list.

### Object
Catalogue (categories + items + suppliers)

### Attributes
- **categories**: list — namespace='catalogue'
- **items**: list — items with supplier + tags
- **suppliers**: list — alternate axis
- **filters**: object — FORMAT + TYPE checkboxes
- **search**: string
- **view_mode**: enum — grid | list

### Actions
- **View** — list + detail panel
- **Filter** — FORMAT + TYPE checkbox sidebar
- **Search** — live filter
- **Favourite** — heart on every row/card
- **Edit image** — pencil on circles + cards
- **Copy** n/a
- **Move** yes — items reassigned to child categories

### Special behaviours
- CatalogueGridComponent reused across catalogue / supplier shop / org settings
- Two-layer hierarchy (parent + child circles) with scroll arrows
- Tagline + description header panel
- Suppliers/Items axis toggle
- Three-treatment image rendering
- Edit pencil on circles + cards

### Used in
- **/catalogue** — public browse
- **Supplier shop front** — embedded grid
- **Org settings → catalogue** — admin view

### Technical
- **Component**: app-catalogue-grid
- **Path**: client-angular/src/app/shared/components/catalogue-grid/
- **Depends on**: CategoryService, ItemService, ImageUploadPanelComponent`,

  'Image Upload — Tabbed Dialog (Upload/Search/Icon)':
`## Image Upload Panel

The shared image picker used by every entity. Three tabs: Upload (drag/
drop), Search (Unsplash), Icon (Lucide). Unifies cover_image_url,
logo_url and icon_name in one component.

### Object
ImageUploadPanelComponent (shared)

### Attributes
- **cover_image_url**: image
- **logo_url**: image
- **icon_name**: string — Lucide kebab-case
- **icon_color**: CSS var
- **card_color**: CSS var
- **image_display**: enum — cover | contain

### Actions
- **Upload** — drag/drop + cover/logo toggle
- **Search** — Unsplash auto-populated with entity name
- **Pick icon** — Lucide search by keyword + colour picker
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Single upload with cover/logo toggle
- Auto-populates Unsplash query with entity name
- Icon tab includes full Lucide library
- Works for all entity types — supplier / item / category / org

### Used in
- **Categories** — icon + cover upload
- **Suppliers / Items** — cover + logo upload
- **Orgs** — logo + cover upload

### Technical
- **Component**: app-image-upload-panel
- **Path**: client-angular/src/app/shared/components/image-upload-panel/
- **Depends on**: StorageService, Unsplash API, lucide-angular`,

  'Feedback - Capture + Grid + Issue/Folder/Note':
`## Feedback

Cross-environment feedback capture. The floating button logs bugs,
prompts and notes into shared.feedback. The Feedback page lists every
entry with filter circles, bulk actions and detail drawer.

### Object
Feedback entry — Issue / Folder / Note

### Attributes
- **title**: string
- **notes**: text — markdown
- **type**: enum — bug | enhancement | question | prompt | note | minutes | sprint | test_run
- **object_type**: enum — issue | folder | note
- **feedback_category_id**: uuid
- **owner**: string — initials
- **status**: enum — open | in_progress | done | wont_fix
- **tags**: text[]
- **page_url**: string
- **submitted_by**: string
- **due_date**: date
- **parent_id**: uuid — for hierarchy
- **event_date**: date — folders
- **agenda**: text[] — folders

### Actions
- **Add** — floating capture button + right-click quick menu
- **Edit** — drawer
- **Delete** — cascades to children
- **Assign owner** — bulk + per-row
- **Change status** — bulk + per-row
- **Copy** n/a
- **Move** yes — reassign to folder via parent_id

### Special behaviours
- Floating capture button on every page
- Right-click quick menu (Bug / Note / Question)
- Issue / Folder / Note object model
- Filter circles by type
- Bulk actions: mark done, assign, delete

### Used in
- **/ballpark-settings/feedback** — main grid
- **Floating button** — global capture

### Technical
- **Component**: app-feedback
- **Path**: client-angular/src/app/features/ballpark-settings/feedback/
- **Depends on**: FeedbackService, FeedbackDialogComponent, CatalogueGridComponent`,

  'Meeting Notes - /meeting/:id Page':
`## Meeting Notes

A focused two-column page for a single meeting/sprint/test-run. Left
column carries agenda + notes; right column carries action items, bugs
and enhancements. Cascades children on delete.

### Object
Folder (type=minutes/sprint/test_run/workshop)

### Attributes
- **title**: string
- **type**: enum — minutes | sprint | test_run | workshop
- **event_date**: date
- **agenda**: text[]
- **notes**: text — markdown
- **action_items**: list — child entries
- **bugs**: list — child entries
- **enhancements**: list — child entries

### Actions
- **Add** — inline per section
- **Edit** — click-to-open dialog
- **Delete** — cascade children
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Two-column layout, agenda + notes left, actions/bugs/enhancements right
- Owner initials selector (LW/BP/MG/JC)
- Agenda reorder via up/down arrows
- Inline title edit, saves on blur
- Notes autosave (debounce 1000ms)
- Opens in new tab from feedback nav
- Always creates fresh meeting on nav click

### Used in
- **/meeting/:id** — dedicated route
- **Feedback grid** — opens via folder click

### Technical
- **Component**: app-meeting-detail
- **Path**: client-angular/src/app/features/meeting/
- **Depends on**: FeedbackService, MarkdownEditorComponent`,

  'Welcome Page + Guestlist Signup':
`## Welcome Page

The public landing page on /welcome. Three slides describe Ballpark and
collect email signups for the guestlist. No auth required, sends a
notification via Resend.

### Object
Public marketing page

### Attributes
- **slides**: array — 3-slide layout
- **eyebrow**: string — branding tag
- **headline**: string
- **subtitle**: string
- **cta_label**: string
- **success_*** fields — post-signup messaging
- **guestlist**: list — admin view of signups

### Actions
- **View** — public, no auth
- **Signup** — email captured into marketing.guestlist_signup
- **Admin: view signups** — /ballpark-settings/early-access
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Inter typography (not Playfair — public page)
- v1.9 brand palette
- SVG circle blur design
- Resend email integration on signup
- Editable copy via marketing.welcome_content table
- Admin recipients configurable via marketing.welcome_settings

### Used in
- **/welcome** — public route
- **/ballpark-settings/early-access** — admin

### Technical
- **Component**: app-welcome
- **Path**: client-angular/src/app/features/welcome/
- **Depends on**: GuestlistService, MarketingService, Resend API`,

  'Technical — Storage, Health, Keep-Alive, Seed Guards':
`## Technical Foundation

Backend hardening — storage buckets, health endpoint, keep-alive
heartbeat, seed-preview guards and the log-commit script. Quiet
infrastructure that keeps the platform reliable.

### Object
Platform technical scripts + endpoints

### Attributes
- **storage_buckets**: list — Supabase per-env
- **health_endpoint**: GET /api/health
- **keep_alive**: heartbeat — prevents Supabase free-tier pause
- **seed_guards**: refusal — prevents prod overwrite
- **log_commit**: script — writes commits to internal.project_log

### Actions
- **Run** — server startup auto-creates buckets
- **Probe** — Railway uses /api/health
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Auto-create storage buckets on startup if missing
- Keep-alive prevents Supabase free-tier pause
- seed-preview refusal guard
- unorphan recovery script
- log-commit.js writes to internal.project_log

### Used in
- **All environments** — backend infrastructure

### Technical
- **Component**: server scripts
- **Path**: server/src/db/ + server/src/routes/health.js
- **Depends on**: pg, Supabase storage`,

  'Rich Text Editor — app-markdown-editor':
`## Rich Text Editor

A shared editor component for composing and formatting structured
content throughout Ballpark. Toolbar-driven so non-technical users do
not need markdown syntax. Stores markdown, renders HTML.

### Object
Shared component — app-markdown-editor

### Attributes
- **value**: string — markdown content (two-way bound)
- **placeholder**: string — hint text
- **rows**: number — minimum visible rows (default 10)
- **label**: string — optional field label
- **showLabel**: boolean — default true

### Actions
- **Edit** — compose via toolbar or raw markdown
- **Preview** — render formatted HTML from markdown
- **Insert formatting** — toolbar inserts at cursor without overwriting selection
- **Copy** n/a — content bound via [(value)]
- **Move** n/a

### Special behaviours
- Toolbar inserts at cursor, wraps selected text
- Tab key inserts 2 spaces (prevents focus loss)
- Cmd+B / Cmd+I / Cmd+K shortcuts
- Tables render with parchment amber headers
- Checkboxes interactive in edit, read-only in preview
- Grows to fill flex container
- Preview rendered via marked
- Preview styles in styles.css (not component CSS)

### Used in
- **Feedback drawer** — notes field for bugs, enhancements, specs
- **Item drawer** — description (future)
- **Meeting notes** — agenda detail (future)
- **Project brief** — event description (future)

### Technical
- **Component**: app-markdown-editor
- **Path**: client-angular/src/app/shared/components/markdown-editor/
- **Depends on**: marked, DomSanitizer`,

  'Feedback - Edit Drawer':
`## Feedback Edit Drawer

The 520px right-hand drawer that opens whenever a feedback entry is
clicked. Surfaces every editable attribute as inline pills + cells —
title, type, status, owner, priority, target version, area, pages,
notes, tags.

### Object
Feedback drawer (edit surface for shared.feedback)

### Attributes
- **title**: string — inline-editable in header
- **type**: enum — dropdown pill (bug/prompt/etc)
- **status**: enum — click-to-cycle pill
- **owner**: enum — click-to-cycle through team
- **priority**: integer 1-5 — click-to-cycle pill
- **target_version**: string — click-to-edit pill
- **area_category_id**: uuid — dropdown
- **pages**: text[] — list with add/remove
- **notes**: text — markdown, preview-first
- **tags**: text[] — optional chip field
- **due_date**: date — optional

### Actions
- **View** — opens on row click
- **Edit** — every attribute inline, saves on demand
- **Save** — explicit save button (only enabled when dirty)
- **Delete** — footer button with confirm
- **Add page** — type + enter
- **Add attribute** — Tags / Due date / Linked via "..." menu
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Title inline edit — click-to-edit, blur saves
- Status / owner / priority cycle on click
- Target version click-to-edit input
- Notes preview-first — click body switches to markdown editor
- Notes editor returns to preview on blur
- Eyebrow shows the entry type, not generic FEEDBACK
- 520px width prevents cramped layout

### Used in
- **Feedback grid** — every entry click opens this drawer
- **Test cases section** — appears below notes for issues

### Technical
- **Component**: app-feedback (drawer template)
- **Path**: client-angular/src/app/features/ballpark-settings/feedback/
- **Depends on**: FeedbackService, MarkdownEditorComponent, p-sidebar`,

  'Feedback - Table View':
`## Feedback Table View

The third view mode for the feedback grid (alongside grid + list).
Renders a sortable p-table with the columns Type | Area | Pages | Title
| Owner | Status | Version. Detail panel projects into the same
catalogue-grid layout as the grid/list views.

### Object
Feedback list (tabular projection)

### Attributes
- **columns**: array — Type, Area, Pages, Title, Owner, Status, Version
- **default_sort**: prioritySortKey + statusRank
- **detail_panel**: projection — same as grid view
- **rows**: list — projection of filtered feedback entries

### Actions
- **View** — sortable columns, click row to preview
- **Sort** — multi-sort
- **Open drawer** — click row opens edit drawer
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Sidebar + detail panel preserved across grid/list/table
- Type column shows pill with icon + label (not single letter)
- Version column splits done (shipped_date + version) vs open (target_version)
- Detail panel renders markdown notes + priority pill

### Used in
- **/ballpark-settings/feedback** — third view toggle

### Technical
- **Component**: app-feedback (table template inside CatalogueGrid projection)
- **Path**: client-angular/src/app/features/ballpark-settings/feedback/
- **Depends on**: FeedbackService, CatalogueGridComponent, p-table`,

  // ── Open / spec entries (v2.0+) ──
  'User — Authentication':
`## User Authentication

The first-class identity primitive for Ballpark. Every authenticated
request resolves to a User record. Profile, role and tenant association
live here. Login is via Google SSO.

### Object
User

### Attributes
- **name**: string
- **email**: string — unique
- **avatar**: image
- **tenant**: uuid — org_id
- **role**: enum — owner | admin | member
- **status**: enum — active | invited | suspended
- **last_login**: timestamp

### Actions
- **Add** — register via SSO + enrollment
- **Edit** — profile fields
- **Delete** — deactivate (soft)
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Google SSO is the only login provider
- Invite by email or invite code
- Platform admins can impersonate

### Used in
- **All authenticated routes** — req.user is the canonical identity

### Technical
- **Component**: AuthService + UserService
- **Path**: server/src/services/auth.service.js + users.service.js
- **Depends on**: Google OAuth 2.0, JWT, httpOnly cookies`,

  'Session — Auth Session':
`## Session

The token-bearing session that backs an authenticated request. Stateless
JWT in an httpOnly cookie, with a refresh token persisted in the DB so
revoke is possible.

### Object
Session

### Attributes
- **user_id**: uuid
- **token**: string — JWT
- **expires_at**: timestamp
- **device**: string — user agent

### Actions
- **Create** — login (SSO callback)
- **Delete** — logout
- **Refresh** — refresh token rotation
- **Copy** n/a
- **Move** n/a

### Special behaviours
- httpOnly cookie (XSS protection)
- 1-hour JWT expiry
- Refresh token in auth_sessions table
- Revoke on demand

### Used in
- **All authenticated routes** — middleware verifies token

### Technical
- **Component**: authenticate() middleware
- **Path**: server/src/middleware/auth.js
- **Depends on**: jsonwebtoken, cookie-parser`,

  'Google SSO — Authentication':
`## Google SSO

The OAuth 2.0 flow that backs login. New users are routed through
enrollment (create or join an org); returning users land directly on
the dashboard.

### Object
Auth provider — Google

### Attributes
- **google_id**: string
- **email**: string
- **name**: string
- **avatar_url**: string
- **access_token**: string
- **refresh_token**: string

### Actions
- **Authenticate** — Google consent screen
- **Enroll** — first login flow (create or join org)
- **Copy** n/a
- **Move** n/a

### Special behaviours
- OAuth 2.0 via Google
- Enrollment flow on first login (create / join org)
- Org type selection (agency / supplier)
- Plan selection for agencies

### Used in
- **/login** — SSO button
- **/api/auth/google/callback** — OAuth handler

### Technical
- **Component**: AuthService.googleCallback
- **Path**: server/src/services/auth.service.js
- **Depends on**: Google OAuth 2.0, JWT`,

  'Organisation — Tenant Management':
`## Organisation

The tenant boundary in Ballpark. Every user, project and item belongs to
exactly one Organisation. Plans, billing and role permissions are
scoped here.

### Object
Organisation

### Attributes
- **name**: string
- **type**: enum — agency | supplier
- **plan**: enum — free | pro | enterprise
- **ball_balance**: integer
- **city**: string
- **email**: string
- **phone**: string
- **logo_url**: image
- **cover_image_url**: image

### Actions
- **Add** — create on enrollment
- **Edit** — settings tab
- **Delete** — deactivate
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Transfer ownership (owner role only)
- Impersonate (platform admin only)
- Change plan
- Top up Ball balance

### Used in
- **All routes** — tenant scope on every query

### Technical
- **Component**: OrgService
- **Path**: server/src/services/org.service.js
- **Depends on**: shared.orgs (per-env)`,

  'Team Member — User Management':
`## Team Member

The org-scoped relationship between a User and an Organisation. Owns
role + invite state for that user within that org.

### Object
Team Member

### Attributes
- **user_id**: uuid
- **name**: string
- **email**: string
- **role**: enum — owner | admin | member
- **status**: enum — active | invited | suspended
- **joined_at**: timestamp
- **avatar**: image

### Actions
- **Add** — invite by email or code
- **Edit** — change role / name
- **Delete** — remove from org
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Invite by email or single/multi-use code
- Resend invite
- Filter by role / status

### Used in
- **/settings/team** — primary surface
- **All authenticated routes** — role gates

### Technical
- **Component**: TeamService
- **Path**: server/src/services/team.service.js
- **Depends on**: users + memberships tables`,

  'Project — Project Management':
`## Project

The central work unit. Every estimate, message and supplier interaction
attaches to a Project. AI parses the brief on save.

### Object
Project

### Attributes
- **name**: string
- **client_id**: uuid
- **event_date**: date
- **location**: string
- **guest_count**: integer
- **status**: enum
- **brief**: text
- **cover_image_url**: image
- **client_logo_url**: image
- **ball_balance**: integer — project-scoped
- **total_cost**: numeric
- **margin**: numeric — pct
- **vat**: numeric — pct
- **contingency**: numeric — pct

### Actions
- **Add** — create project
- **Edit** — every field
- **Delete** — soft (archive)
- **Clone** — copy a project as a starting point
- **Copy** yes (clone)
- **Move** n/a

### Special behaviours
- AI brief parse extracts structured fields on save
- Archive separates active / completed
- Export PDF for client delivery

### Used in
- **Dashboard** — project cards
- **/projects/:id** — detail
- **Estimate / Build / Messages** — all scoped to project

### Technical
- **Component**: ProjectService
- **Path**: server/src/services/project.service.js
- **Depends on**: AI brief parser`,

  'Estimate — Project Costing':
`## Estimate

The costing surface for a project. Bundles category briefs and line
items, applies margin / VAT / contingency and produces both the
internal and client totals.

### Object
Estimate

### Attributes
- **project_id**: uuid
- **categories**: list
- **line_items**: list — estimate_items
- **subtotal**: numeric
- **margin_pct**: numeric
- **vat_pct**: numeric
- **contingency_pct**: numeric
- **total**: numeric
- **client_total**: numeric
- **status**: enum

### Actions
- **View** — read in Estimate tab
- **Edit** — add / remove items
- **Send lead** — spend Ball to share with supplier
- **Export PDF** — client deliverable
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Add item from catalogue OR custom
- Toggle scope per item — In Scope / Client Handles / TBC
- Margin and VAT applied automatically

### Used in
- **/projects/:id/estimate** — primary
- **Build tab** — surfaces summary

### Technical
- **Component**: EstimateService
- **Path**: server/src/services/estimate.service.js
- **Depends on**: estimates + estimate_items tables`,

  'Estimate Item — Line Item':
`## Estimate Item

A single line in an estimate. Optionally bound to a catalogue item, a
supplier and a quote. Carries quantity, unit, ballpark cost and final
cost as the item moves through quoting.

### Object
Estimate Item

### Attributes
- **name**: string
- **category_id**: uuid
- **supplier_id**: uuid
- **scope**: enum — in_scope | client_handles | tbc
- **requirements**: text
- **ballpark_cost**: numeric
- **final_cost**: numeric
- **quantity**: numeric
- **unit**: string
- **status**: enum

### Actions
- **Add** — within estimate
- **Edit** — every field
- **Delete** — line removal
- **Copy** yes — duplicate line
- **Move** yes — between categories

### Special behaviours
- Link to catalogue item (canonical pricing)
- Link to quote (final pricing)

### Used in
- **Estimate tab** — list of all items
- **Build tab** — vendor-scoped subset

### Technical
- **Component**: EstimateItemService
- **Path**: server/src/services/estimate-item.service.js
- **Depends on**: estimate_items, items, quotes`,

  'Ball — Lead Credit':
`## Ball — Lead Credit

The platform currency. One Ball = one supplier lead. Spend on send,
top up via Stripe, monthly allowance per plan.

### Object
Ball Transaction

### Attributes
- **org_id**: uuid
- **amount**: integer
- **type**: enum — spend | topup | allowance
- **project_id**: uuid — when applicable
- **item_id**: uuid — when applicable
- **created_at**: timestamp
- **description**: text

### Actions
- **View** — read transaction history
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Top up balance (Stripe)
- Monthly allowance reset on plan
- Balance visible in nav

### Used in
- **Send Lead Flow** — debits Balls
- **Subscription** — credits monthly
- **Top up dialog** — credits via Stripe

### Technical
- **Component**: BallsService
- **Path**: server/src/services/balls.service.js
- **Depends on**: balls_transactions, Stripe`,

  'Lead — Send Lead Flow':
`## Send Lead

The flow that converts an estimate item into a supplier lead. Spends a
Ball, sends the supplier a brief, opens a thread.

### Object
Lead (sent by agency)

### Attributes
- **project_id**: uuid
- **category_id**: uuid
- **items**: list — estimate_items
- **suppliers**: list — recipients
- **brief**: text
- **ballpark_cost**: numeric
- **status**: enum
- **sent_at**: timestamp

### Actions
- **Add** — open send drawer
- **View** — history
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Pre-send gate — date / guests / one-liner required
- Ball deducted on confirm
- Email notification to supplier

### Used in
- **Build tab** — vendor selection step
- **Estimate** — line item context menu

### Technical
- **Component**: SendLeadDrawer
- **Path**: client-angular/src/app/features/projects/.../send-lead/
- **Depends on**: BallsService, MessageService, Resend`,

  'Lead Inbox — Supplier Lead Management':
`## Lead Inbox

The supplier-side inbox of incoming leads. Suppliers see the brief,
unlock to read details (Stripe lead fee), then accept or decline.

### Object
Lead (received by supplier)

### Attributes
- **project_id**: uuid
- **agency_id**: uuid
- **category**: string
- **items**: list
- **brief**: text
- **ballpark_cost**: numeric
- **status**: enum — locked | unlocked | accepted | declined
- **received_at**: timestamp

### Actions
- **View** — list + detail (locked summary)
- **Unlock** — pay lead fee via Stripe
- **Accept** — open quote
- **Decline** — close lead
- **Delete** — remove from inbox
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Locked summary teases without revealing brief
- Stripe Connect destination charge for unlock fee
- Email notification on receipt

### Used in
- **Supplier dashboard** — inbox
- **Notifications** — new lead

### Technical
- **Component**: LeadInboxComponent
- **Path**: client-angular/src/app/features/suppliers/lead-inbox/
- **Depends on**: LeadService, BillingService, Stripe`,

  'Quote — Supplier Quote Submission':
`## Quote

The supplier's structured response to a lead. Line items + total + notes
+ expiry. Submitted to the agency, who can accept, decline or compare
side-by-side.

### Object
Quote

### Attributes
- **lead_id**: uuid
- **supplier_id**: uuid
- **line_items**: list
- **total**: numeric
- **notes**: text
- **expiry_date**: date
- **status**: enum

### Actions
- **Add** — supplier submits
- **Edit** — pre-submit
- **Delete** — withdraw
- **Accept** — agency accepts
- **Decline** — agency declines
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Submit to agency triggers email
- Quote comparison view (side-by-side with ballpark ref)

### Used in
- **Supplier dashboard** — submit
- **Agency messages** — accept / compare

### Technical
- **Component**: QuoteService
- **Path**: server/src/services/quote.service.js
- **Depends on**: quotes, lead, message`,

  'Catalogue Item — Supplier Catalogue Management':
`## Catalogue Item (Supplier)

The supplier-side catalogue management surface. Suppliers self-manage
their items, with publish / unpublish, bulk import and AI taxonomy
suggestion.

### Object
Catalogue Item (supplier-managed)

### Attributes
- **name**: string
- **category_id**: uuid
- **description**: text
- **unit**: string
- **base_price**: numeric
- **min_price**: numeric
- **max_price**: numeric
- **tier**: enum — basic | mid | premium
- **tags**: text[]
- **cover_image_url**: image
- **lead_time_days**: integer
- **is_active**: boolean

### Actions
- **Add** — manual or via XLS bulk import
- **Edit** — every field
- **Delete** — soft (publish=false)
- **Copy** yes — duplicate item
- **Move** n/a

### Special behaviours
- Publish / unpublish toggle
- Bulk import via XLS
- AI taxonomy suggestion on description entry

### Used in
- **Supplier shop front** — public catalogue
- **/items** — supplier admin list

### Technical
- **Component**: ItemService (supplier scope)
- **Path**: server/src/services/item.service.js
- **Depends on**: items, categories, AI service`,

  'Subscription — Plan Management':
`## Subscription

The Stripe-backed subscription that gates ball allowance and feature
access. Owners can upgrade / downgrade / cancel; invoice history is
read-only.

### Object
Subscription

### Attributes
- **org_id**: uuid
- **plan**: enum — free | pro | enterprise
- **ball_allowance**: integer
- **renewal_date**: date
- **stripe_customer_id**: string
- **stripe_subscription_id**: string

### Actions
- **View** — current plan + invoice history
- **Edit** — upgrade / downgrade / cancel
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Upgrade, downgrade, cancel
- Stripe Checkout for payment method
- Invoice history surfaced read-only

### Used in
- **/settings/subscription** — primary
- **Onboarding** — plan selection (agency)

### Technical
- **Component**: SubscriptionService
- **Path**: server/src/services/subscription.service.js
- **Depends on**: Stripe`,

  'Payment — Stripe Integration':
`## Payments

The Stripe Connect layer that handles agency subscriptions, supplier
lead-fee unlocks and split payments. Surfaces a per-org wallet balance
and an admin reconciliation screen.

### Object
Payment

### Attributes
- **org_id**: uuid
- **amount**: numeric
- **currency**: string
- **type**: enum — subscription | lead_fee | topup
- **stripe_payment_id**: string
- **status**: enum
- **created_at**: timestamp

### Actions
- **View** — read history
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Stripe Connect — agency subscriptions
- Stripe Connect — supplier lead-fee unlocks
- Destination Charges for commission splits
- Wallet balance in account settings
- Admin reconciliation screen joins Ballpark + Stripe API

### Used in
- **Ball top-up** — Stripe Checkout
- **Lead unlock** — destination charge
- **Subscription** — recurring charge

### Technical
- **Component**: BillingService
- **Path**: server/src/services/billing.service.js
- **Depends on**: Stripe, Stripe Connect`,

  'Notification — In-App + Email':
`## Notification

The cross-cutting notification primitive. In-app bell with unread badge,
plus email via Resend for the lead lifecycle events.

### Object
Notification

### Attributes
- **user_id**: uuid
- **type**: enum
- **title**: string
- **message**: text
- **action_url**: string
- **read_at**: timestamp
- **created_at**: timestamp

### Actions
- **View** — bell dropdown
- **Mark read** — single + bulk
- **Delete** — single + bulk
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Email via Resend for lead-sent / lead-received / quote-submitted / quote-accepted
- In-app bell with unread count badge in nav
- Real-time via polling or Supabase realtime

### Used in
- **All authenticated views** — bell in nav
- **Email** — Resend deliveries

### Technical
- **Component**: NotificationService
- **Path**: server/src/services/notification.service.js
- **Depends on**: Resend, notifications table`,

  'Mobile — Responsive Layout':
`## Mobile Responsive Layout

The mobile-friendly variants of every page. Cross-cutting work to make
the app usable at 375px+ — bottom nav, touch-friendly cards, mobile
catalogue browse and project / estimate views.

### Object
Mobile responsive coverage

### Attributes
- **breakpoint**: 375px+
- **bottom_nav**: yes — already partially built
- **touch**: card / row interactions
- **mobile_catalogue**: yes
- **mobile_project**: yes
- **mobile_estimate**: yes

### Actions
- **View** — every page on mobile viewport
- **Copy** n/a
- **Move** n/a

### Special behaviours
- All pages responsive at 375px+
- Bottom nav on mobile (already partially built)
- Touch-friendly card interactions

### Used in
- **All pages** — cross-cutting concern

### Technical
- **Component**: shared CSS + responsive variants
- **Path**: client-angular/src/styles.css + per-component
- **Depends on**: Tailwind responsive prefixes`,

  'Image Sanitisation — AI Background Removal':
`## Image Sanitisation

The AI pipeline that takes a raw item image and produces a sanitised
catalogue version — background removed, brand text masked, halo applied.
Catalogue surfaces the sanitised image; supplier shop keeps the
original.

### Object
Item Image (sanitised)

### Attributes
- **original_url**: string
- **sanitised_url**: string
- **brand_removed**: boolean
- **halo_colour**: enum — cream | pink | green
- **review_status**: enum — pending | approved | rejected

### Actions
- **Upload** — supplier uploads original
- **Sanitise** — AI pipeline
- **Review** — supplier review step
- **Approve** — push to catalogue
- **Reject** — re-run or revert
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Pipeline: rembg (BiRefNet) + EasyOCR + inpaint
- Supplier review for residuals
- Halo style picker
- Catalogue uses sanitised, shop front uses original

### Used in
- **Catalogue** — sanitised
- **Supplier shop** — original

### Technical
- **Component**: ImageSanitisationService
- **Path**: server/src/services/image-sanitisation.service.js
- **Depends on**: rembg, EasyOCR, inpaint`,

  'Item Categories — Junction Table':
`## Item Categories Junction

The many-to-many relationship between items and categories. Replaces
items.tags[] for event-type filtering. Allows a single item to live in
multiple categories.

### Object
Item ↔ Category junction row

### Attributes
- **item_id**: uuid
- **category_id**: uuid
- **is_primary**: boolean

### Actions
- **Add** — link
- **Delete** — unlink
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Replaces items.tags[] for event-type filtering
- One item in multiple categories
- Migration: items.category_id → junction
- Migration: items.tags[] → matching category ids

### Used in
- **Catalogue** — multi-category filter
- **Item detail** — category list

### Technical
- **Component**: ItemCategoryService
- **Path**: server/src/services/item-category.service.js
- **Depends on**: item_categories table`
};

// ── 3. Two new spec entries (Task 6c) ─────────────────────────────────────
const NEW_SPECS = [
  {
    title: 'Test Case — Child note on feedback issues',
    type:  'prompt',
    object_type: 'issue',
    status: 'done',
    version: 'v1.11',
    shipped_date: SHIP_DATE,
    target_version: null,
    priority: 2,
    tags: ['feature-spec', 'v1.11'],
    notes:
`## Test Case

A lightweight test log entry attached directly to any feedback issue.
Records what was tested, the result and any observations. Multiple test
cases can be added to track testing across different dates or
environments. No bug creation or linking required — just a clean,
timestamped pass/fail/skip record.

### Object
shared.feedback — child entry, type=test_case

### Attributes
- **notes**: text — what was tested and what happened
- **status**: enum — pass | fail | skip
- **owner**: string — who performed the test (LW/BP/MG/JC)
- **submitted_by**: string — same as owner typically
- **parent_id**: uuid — the parent issue this belongs to
- **created_at**: timestamptz — when the test was run

### Actions
- **Add** — inline form at bottom of test cases section
- **View** — click row to expand full notes
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Multiple test cases allowed per issue
- Status icon: ✓ pass (green), ✗ fail (red), — skip (muted)
- Owner shown as 24px initials avatar
- Ordered chronologically — oldest first
- Add form requires both notes and result before submitting
- Owner defaults to LW, persists between adds in same session
- No bug linking — test cases are standalone observations
- Created directly from issue drawer inline form

### Used in
- **Feedback drawer** — below notes section on any issue
- **Bugs** — verify fix is working after deployment
- **Enhancements** — verify feature works as specified
- **Prompts** — verify requirements are implemented

### Technical
- **Object**: shared.feedback (child, type=test_case)
- **Path**: client-angular/src/app/features/ballpark-settings/feedback/
- **API**: POST /api/feedback (parent_id, type=test_case),
         GET /api/feedback/:id (returns test_cases[] array),
         GET /api/feedback/:id/children?type=test_case`
  },
  {
    title: 'Acceptance Criteria — Child note on feedback issues',
    type:  'prompt',
    object_type: 'issue',
    status: 'open',
    version: null,
    shipped_date: null,
    target_version: 'v2.0',
    priority: 2,
    tags: ['feature-spec', 'v2.0'],
    notes:
`## Acceptance Criteria

A structured definition of done attached to any feedback issue. Written
in markdown and agreed by the team before work begins. Tracks whether
criteria have been defined (Draft) or signed off (Agreed). One block
per issue, shown between notes and test cases in the drawer.

### Object
shared.feedback — child entry, type=acceptance_criteria

### Attributes
- **notes**: text — markdown criteria defining done conditions
- **status**: enum — draft | agreed
- **parent_id**: uuid — the parent issue
- **submitted_by**: string — who wrote the criteria
- **created_at**: timestamptz — when added

### Actions
- **Add** — created via + button in drawer (one per issue)
- **Edit** — markdown editor, autosaves on blur
- **Toggle status** — Draft ↔ Agreed via pill click
- **Copy** n/a
- **Move** n/a

### Special behaviours
- Only one acceptance criteria block per issue
- Status pill: Draft (amber) | Agreed (green)
- Autosaves on blur — no explicit save button
- Shows preview by default, click to edit
- Renders as markdown (app-markdown-editor)

### Used in
- **Feedback drawer** — below notes, above test cases
- **Prompts** — defines requirements before build starts
- **Bugs** — defines fix verification criteria
- **Enhancements** — defines scope and done conditions

### Technical
- **Object**: shared.feedback (child, type=acceptance_criteria)
- **Path**: client-angular/src/app/features/ballpark-settings/feedback/
- **Depends on**: app-markdown-editor
- **API**: POST /api/feedback (parent_id, type=acceptance_criteria),
         PATCH /api/feedback/:id (status, notes)`
  }
];

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    // Resolve Prompt category id + Feedback area id
    const promptCat = await pool.query(
      `SELECT id FROM shared.feedback_categories WHERE name='Prompt' AND object_type='issue' LIMIT 1`
    );
    const feedbackArea = await pool.query(
      `SELECT id FROM shared.feedback_categories WHERE namespace='area' AND name='Feedback' LIMIT 1`
    );
    if (!promptCat.rowCount) throw new Error('Prompt category missing — run migrate-schemas.js first');
    const promptCategoryId = promptCat.rows[0].id;
    const feedbackAreaId   = feedbackArea.rowCount ? feedbackArea.rows[0].id : null;

    // ── Task 1 + 3: backfill version + shipped_date for shipped entries ──
    let shippedUpdated = 0;
    for (const [title, version, shipped_date] of SHIPPED_MAP) {
      const r = await pool.query(
        `UPDATE shared.feedback
            SET version       = $2,
                shipped_date  = $3,
                status        = 'done'
          WHERE title = $1
            AND tags @> ARRAY['feature-spec']::text[]`,
        [title, version, shipped_date]
      );
      if (r.rowCount > 0) shippedUpdated += r.rowCount;
    }
    console.log(`shipped backfilled: ${shippedUpdated} rows`);

    // ── Task 2 + 6a: reformat notes ──
    let notesUpdated = 0, notesMissing = 0;
    for (const [title, body] of Object.entries(NOTES)) {
      const r = await pool.query(
        `UPDATE shared.feedback
            SET notes = $2
          WHERE title = $1
            AND tags @> ARRAY['feature-spec']::text[]`,
        [title, body]
      );
      if (r.rowCount > 0) {
        notesUpdated += r.rowCount;
      } else {
        notesMissing++;
        console.log(`  (no row matched title: ${title})`);
      }
    }
    console.log(`notes reformatted: ${notesUpdated} rows (${notesMissing} titles had no match)`);

    // ── Task 6c: Insert new spec entries (Test Case + Acceptance Criteria) ──
    let inserted = 0, skipped = 0;
    for (const s of NEW_SPECS) {
      const exists = await pool.query(
        `SELECT id FROM shared.feedback WHERE title = $1 LIMIT 1`,
        [s.title]
      );
      if (exists.rowCount) {
        // Update notes + version metadata if it exists
        await pool.query(
          `UPDATE shared.feedback
              SET notes          = $2,
                  status         = $3,
                  version        = $4,
                  shipped_date   = $5,
                  target_version = $6,
                  tags           = $7,
                  priority       = $8,
                  area_category_id = $9
            WHERE id = $1`,
          [exists.rows[0].id, s.notes, s.status, s.version, s.shipped_date,
           s.target_version, s.tags, s.priority, feedbackAreaId]
        );
        skipped++;
        console.log(`  spec already existed (updated): ${s.title}`);
      } else {
        await pool.query(
          `INSERT INTO shared.feedback
             (feedback_category_id, area_category_id, title, notes, submitted_by,
              environment, object_type, type, status, tags,
              version, shipped_date, target_version, priority)
           VALUES ($1, $2, $3, $4, 'Liam', 'preview', $5, $6, $7, $8,
                   $9, $10, $11, $12)`,
          [promptCategoryId, feedbackAreaId, s.title, s.notes,
           s.object_type, s.type, s.status, s.tags,
           s.version, s.shipped_date, s.target_version, s.priority]
        );
        inserted++;
        console.log(`  spec inserted: ${s.title}`);
      }
    }
    console.log(`new specs: inserted=${inserted}, updated=${skipped}`);

    // Final audit — anything still missing version + shipped_date?
    const missing = await pool.query(
      `SELECT title, version, shipped_date
         FROM shared.feedback
        WHERE status = 'done'
          AND tags @> ARRAY['feature-spec']::text[]
          AND (version IS NULL OR shipped_date IS NULL)
        ORDER BY title`
    );
    if (missing.rowCount) {
      console.log(`\n!! ${missing.rowCount} done feature-spec rows still missing version or shipped_date:`);
      missing.rows.forEach(r => console.log(`   - ${r.title} (version=${r.version}, shipped=${r.shipped_date})`));
    } else {
      console.log('\nAll done feature-spec rows have version + shipped_date ✓');
    }
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
