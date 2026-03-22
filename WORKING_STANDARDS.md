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
           dev     = active development
           preview = QC and testing
           master  = demo (Beth & Megan) + post go-live releases
Deploy:    Vercel (frontend) + Railway (backend)
           dev     → auto-deploy on push
           preview → QC environment
           master  → demo environment, source for AWS production build
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
p-checkbox         → Checkboxes
p-toggleSwitch     → On/off toggles
p-tabView          → Tab navigation
p-dialog           → Modals (with styleClass="bp-modal")
p-toast            → Notifications
p-table            → Data tables
p-progressSpinner  → Loading states
p-tag              → Status badges
p-calendar         → Date picker
```

### Shared Angular Components
```
app-modal
  → p-dialog wrapper with parchment header
  → Standard footer with parchment buttons
  → Use for ALL modals and confirmations
  → Path: shared/components/modal/

app-image-upload-panel
  → Venue/logo image upload
  → Background removal toggle
  → Colour picker for card background
  → Works for both project and supplier images
  → Path: shared/components/image-upload-panel/

app-avatar
  → Initials circle with theme accent background
  → Inputs: name (string), size (number)
  → Path: shared/components/avatar/

app-stat-card
  → Dashboard stat cell (label + value + subtext)
  → Path: shared/components/stat-card/

app-loading
  → p-progressSpinner, centred and padded
  → Use for ALL loading states
  → Path: shared/components/loading-spinner/

app-status-badge
  → Custom span (NOT p-tag) with CSS variable colours
  → All statuses defined in styles.css — single source of truth
  → Inputs: status (string), statusName (string)
  → Shows coloured dot for project/lead statuses
  → No dot for role pills (owner, member, admin)
  → All pills have 0.5px border (Option A agreed)
  → Path: shared/components/status-badge/
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
--color-text-primary     /* #111111 */
--color-text-secondary   /* #888888 */
--color-text-muted       /* #BBBBBB */
--font-display           /* Playfair Display */
--font-body              /* Libre Franklin */
```

---

## Button Standards

All defined in `styles.css` — change there to change everywhere.

```
p-button              → Amber filled, white text
                         Hover: dark amber
p-button-outlined     → White bg, amber border + text
                         Hover: amber filled, white text
p-button-text         → Transparent, amber text
                         Hover: parchment tint
p-button-danger       → White bg, red text
                         Hover: light red tint
.bp-btn-cancel        → Parchment bg (modal footer only)
.bp-btn-save          → Parchment bg (modal footer only)
                         Both hover: amber filled
```

---

## Input Standards

```
Style:      Outlined (Option A)
Label:      Above field, sentence case, small gray
Background: Parchment (--theme-bg) when in edit mode
            White when in view mode
Focus:      Theme accent border + subtle amber glow
Validation: Red border on error
```

---

## Modal Standard

```html
<p-dialog
  [header]="title"
  [(visible)]="visible"
  [modal]="true"
  [draggable]="false"
  [resizable]="false"
  [style]="{width:'480px'}"
  styleClass="bp-modal"
  (onHide)="close.emit()">

  <!-- content -->

  <ng-template pTemplate="footer">
    <p-button label="Cancel" styleClass="bp-btn-cancel"
              (onClick)="close.emit()">
    </p-button>
    <p-button [label]="saveLabel" styleClass="bp-btn-save"
              (onClick)="confirm.emit()">
    </p-button>
  </ng-template>
</p-dialog>
```

Header: Parchment background + Playfair Display title  
Padding: 24px all sides  
Buttons: Parchment default → amber on hover  

---

## Edit Patterns

### Single Record (settings, profile)
```
View mode:
  Fields render as readonly pInputText (bp-field-readonly)
  Transparent border + background — looks like plain text
  Pencil icon (pi pi-pencil) always visible top right of section header
  Click pencil → fields switch to editable pInputText (bp-input-edit)

Edit mode:
  parchment background (--theme-bg)
  theme accent border (--theme-accent)
  Pencil replaced by check (pi pi-check) + times (pi pi-times) icons
  Check = save, times = cancel — both in section header, no footer buttons
  Cancel restores snapshot — no data loss

Key principle:
  SAME pInputText element in both modes
  View = readonly + transparent styling
  Edit = editable + parchment + accent border
  Same box model = zero layout shift on toggle
  No footer buttons = no layout shift when toggling

Labels:
  bp-field-label on BOTH view and edit labels
  Defined in styles.css — change once, affects everywhere

When to use:
  Settings / Organisation Details
  Settings / Financial Defaults
  Any single-record page
```

### Section header icon buttons
```
Used for pencil / check / times actions in section headers.
NOT p-button — these are icon-only 28×28px controls, unique to this pattern.
Defined in component styles as .bp-icon-btn.

.bp-icon-btn       → 28×28px, no border, no bg, muted color
                     Hover: theme accent + parchment bg
.bp-icon-save      → extends bp-icon-btn, theme accent color
.bp-icon-cancel    → extends bp-icon-btn, muted color

Template:
  <button class="bp-icon-btn" (click)="startEdit('section')">
    <i class="pi pi-pencil"></i>
  </button>
  <button class="bp-icon-btn bp-icon-save" (click)="save()">
    <i class="pi pi-check"></i>
  </button>
  <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('section')">
    <i class="pi pi-times"></i>
  </button>

Always use PrimeNG icons (pi pi-*) for these — not Lucide.
```

### Input classes (defined in component styles)
```
.bp-field-label    → styles.css — 12px, muted, font-weight 500
                     Use on ALL labels, view AND edit mode

.bp-field-readonly → component styles only
                     readonly pInputText: transparent border+bg,
                     no cursor, no focus ring

.bp-input-edit     → component styles only
                     editable pInputText: parchment bg,
                     theme accent border + glow on focus
```

### Multiple Items (catalogue, team, categories)
```
Drawer pattern (slides from right):
  Parchment header (Playfair Display title + subtitle)
  Form fields using p-inputText standard
  Parchment footer with Cancel + primary action buttons
  Closes on save or cancel
  Background content stays visible

When to use:
  Add/edit catalogue items
  Add team members
  Add categories
  Create project (complex form)
  Send lead
```

---

## Drawer Standard

Reference: prototype screenshot (Stand structure brief drawer)

```html
<p-sidebar [(visible)]="drawerVisible"
           position="right"
           styleClass="bp-drawer"
           [style]="{width:'480px'}">

  <!-- Parchment header -->
  <ng-template pTemplate="header">
    <div class="bp-drawer-header">
      <span class="bp-drawer-label">SECTION LABEL</span>
      <div class="bp-drawer-title">Drawer Title</div>
    </div>
  </ng-template>

  <!-- Scrollable content -->
  <div class="bp-drawer-body">
    <!-- fields, cards, selections here -->
  </div>

  <!-- Dark CTA footer -->
  <ng-template pTemplate="footer">
    <div class="bp-drawer-footer">
      <p-button label="Primary action →"
                styleClass="bp-drawer-cta w-full">
      </p-button>
      <p class="bp-drawer-footer-sub">Supporting context text</p>
    </div>
  </ng-template>

</p-sidebar>
```

Header:
  Parchment background (--theme-bg)
  Section label — 11px uppercase, muted, letter-spaced
  Title — Playfair Display, 22px, font-weight 400
  Close X — top right

Content:
  White background
  Scrollable
  Standard padding var(--section-pad)

Footer CTA:
  Dark filled button — background: var(--color-black), color: #fff
  Full width
  Supporting subtext below — 11px, muted, centered
  e.g. "This will use 1 Ball (7 remaining)"

Note: footer CTA is dark (not amber) — this is intentional.
The drawer CTA is a high-commitment primary action.
Amber p-button is for inline/form actions.
Dark CTA = "I am ready to commit to this action."
```

---

## Status Pill Standard

```
Component:  app-status-badge
            <app-status-badge [status]="project.status_name">
            </app-status-badge>

Design:     11px, font-weight 600, border-radius 20px
            Coloured dot for project + lead statuses
            No dot for role pills
            ALL pills have 0.5px border (Option A agreed)

Colours:    Defined ONLY in styles.css — never in components
            Class pattern: .bp-pill-{status} + .bp-dot-{status}

Project:    active (green), draft (yellow), costing (blue),
            closed / completed / cancelled (gray)

Lead/Ball:  sent (purple), quoted (blue), confirmed (green),
            declined (red), pending (yellow), accepted (green)

Roles:      owner (parchment/theme), member (gray), admin (purple)
            No dot on role pills

Never:      Use p-tag for status badges
            Define pill colours in component files
            Use Tailwind color classes (bg-green-100 etc.)
```

---

## Lucide Icons Standard

```
Always use LucideAngularModule.pick() — never bare LucideAngularModule
Register only the icons used in that component

Example:
  import { LucideAngularModule, Pencil } from 'lucide-angular';

  imports: [
    LucideAngularModule.pick({ Pencil }),
    ...
  ]

No readonly icons = {} object needed in the class.
Template usage: <lucide-icon name="pencil" [size]="16"></lucide-icon>
Icon names are kebab-case strings matching the Lucide name.

Tab navigation labels are TEXT ONLY — no icons in hero tabs.
For action icons (pencil, check, times) use PrimeNG pi pi-* icons,
not Lucide — they are always available without registration.
```

---

## Page Layout Standard

### Hero banner
```
Every settings/feature page uses the hero banner pattern:
  Parchment background (--theme-bg)
  Org name — Playfair Display, 36px, centered
  Page label — uppercase, muted, letter-spaced (e.g. SETTINGS)
  Tab bar — centered, text labels only, NO icons
  Active tab — theme accent underline
```

### Page title
```
Every tab has a centered Playfair Display title below the hero,
above the first section. Use bp-page-title class.

  .bp-page-title — defined in component styles
    font-family: var(--font-display)
    font-size: var(--text-2xl)  /* 22px */
    font-weight: 400
    text-align: center
    margin-bottom: 24px

Examples:
  Organisation tab → "Organisation Settings"
  Team tab         → "Team"
  Categories tab   → "Categories"
  Subscription tab → "Subscription"
  Appearance tab   → "Appearance"
```

### Content area
```
  max-width: 640px, margin: 0 auto — centres under hero tabs
  Appearance tab exception: 960px two-column grid (form + preview)
```

---

## File Locations

```
client-angular/src/
  app/
    core/
      services/     → Singleton services (ConfigService, ApiService)
      guards/       → Route guards
      models/       → TypeScript interfaces (one file per entity)
    shared/
      components/   → Reusable components (modal, avatar, stat-card)
      services/     → Utility services (ImageProcessingService, StorageService)
      pipes/        → GbpPipe (currency formatting)
    layout/
      top-nav.component.ts
    features/
      dashboard/
      settings/
      projects/
      suppliers/
      clients/
  styles.css        → SINGLE SOURCE OF TRUTH for all PrimeNG overrides
                      Change button/input styles here only
```

---

## Developer Handoff & Release Strategy

```
Branch strategy:
  dev      → active development (Claude chat + Claude Code)
  preview  → QC and testing before demo
  master   → demo to Beth & Megan, post go-live release branch

Go-live:
  When validated, master is handed to developers for AWS deployment.
  Post go-live, new features continue to be built here on dev,
  QC'd on preview, then released to master → AWS production.

What developers will receive:
  - Working Angular/Node codebase
  - Clean component architecture
  - This standards document
  - Product spec (Ballpark_Product_Specification_v1_0.md)
  - Backlog (BACKLOG.md)

AWS production infrastructure is the responsibility of the
development team — not in scope for this build phase.
```

---

## Backend Laws

```
Routes     → Thin controllers only
             Validate input → call service → return response
             Never write SQL in a route handler

Services   → All business logic and SQL
             One file per domain
             server/src/services/

Errors     → Always use next(err)
             Never res.status(500).json() in routes
             Centralised handler in index.js

Config     → dotenv called ONCE in index.js
             All env vars via process.env
             Never hardcode URLs or credentials

CORS       → Driven by ALLOWED_ORIGINS env var
SSL        → Conditional on NODE_ENV
```

---

## Environment Variables

```
Local (.env):
  STORAGE_BUCKET_PROJECTS=dev-project-assets
  STORAGE_BUCKET_SUPPLIERS=dev-supplier-assets
  SUPABASE_SERVICE_ROLE_KEY=...

Railway preview:
  STORAGE_BUCKET_PROJECTS=preview-project-assets
  STORAGE_BUCKET_SUPPLIERS=preview-supplier-assets

Railway production:
  STORAGE_BUCKET_PROJECTS=project-assets
  STORAGE_BUCKET_SUPPLIERS=supplier-assets
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

---

## Build Status

```
✅  v1.0  Foundation
✅  v1.1  Design system
           Option D theme, CSS variables, appearance settings
✅  v1.2  Architecture + Dashboard
           Backend service layer
           Image processing + Supabase Storage (6 buckets)
           Project + supplier cards with images
           PrimeNG migration — shared components complete
           Dashboard complete
✅  v1.2  Settings — all 5 tabs
           Hero banner + centred horizontal tabs
           Centred Playfair page title per tab
           Organisation: 3 sections, always-visible pencil,
             check/times icon edit pattern, readonly/edit toggle,
             zero layout shift, parchment inputs on edit
           Team: p-dataView list/card toggle, filter sidebar
             (Sort by / Filter by / Role), app-avatar,
             app-status-badge, invite button
           Categories: active categories grid with pi-tag icon
           Subscription: plan + balance display
           Appearance: platform/terminology/theme/mode/hero controls
             + live preview panel
           Global bp-field-label standard in styles.css
           Global pInputText padding standard in styles.css
⬜         Dashboard — migrate local .bp-badge-* to app-status-badge
⬜         Settings — Team invite drawer
⬜         Settings — Categories management
⬜         Projects — list + create flow
⬜         AI brief parser
⬜         Estimate view
⬜         Suppliers — browse + catalogue
⬜         Ball mechanic — send lead flow
⬜         Supplier-facing product
```

---

## Version History

```
v1.0  Foundation
v1.1  Design system (Option D, theming, appearance settings)
v1.2  Architecture review, backend service layer,
      image processing, storage service,
      project + supplier cards with images,
      PrimeNG migration (shared components),
      dashboard complete,
      settings all 5 tabs complete
v1.3  Authentication (Google SSO) — next
```
