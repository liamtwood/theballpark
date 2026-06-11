# Ballpark — Design System

Visual quick-reference. Tokens, typography, components, layout patterns.
For workflow + ship-report process, see `CLAUDE.md`. For engineering rules
(transactions, JWT, etc.), see `ENGINEERING.md`. For tech stack + auth +
database, see `ARCHITECTURE.md`.

This doc has two versions of Ballpark's design language because both apps
live in the repo today:

- **v1** (`client-angular/`) — Angular 18, parchment + amber palette
- **v2** (`client-v2/`) — Angular 21, vivid pink+green gradient brand mark,
  semantic-state tokens, palette-replaced Tailwind (no raw colors compile)

When working in `client-v2/`, follow the **v2 sections** below. v1 sections
are retained for the period until v1 is retired (pV2-11).

---

## 1. Visual theme & atmosphere

Ballpark is a connection layer between event agencies and suppliers. Calm,
editorial, trustworthy — not flashy. The visual language signals "reliable
trade infrastructure," not "lifestyle marketplace."

**Two surfaces, two moods:**

- **Marketing / landing** — warm, brand-forward, vivid gradient logo treatment
- **App / signed-in** — calm parchment surfaces, restrained accents, content
  takes the eye not the chrome

**Key characteristics:**

- **Warm minimalism** — parchment backgrounds, calm hairlines, restrained shadows
- **Editorial typography** — display serif headlines paired with humanist sans body
- **Gradient brand mark** — pink-to-green vivid identity, used sparingly (logo
  circle, primary CTA)
- **Semantic state colours** — fixed meaning across surfaces (live/signing/payment/
  declined), never re-theme

---

## 2. Brand tokens (`--bp-*`) — v2

The `--bp-*` namespace is **brand-fixed**. Not themable. Defines the Ballpark
identity. Matches the `.bp-*` CSS class prefix convention.

```css
:root {
  --bp-gradient:              linear-gradient(135deg, #d63384 0%, #16a34a 100%);
  --bp-gradient-shadow-rgb:   214, 51, 132;   /* pink stop as r,g,b — source for brand glow + focus ring */
  --bp-text-on-gradient:      #ffffff;
  --bp-text-color:            #1f2937;
  --bp-font:                  'Inter Tight', ui-sans-serif, system-ui, sans-serif;
}
```

**Where each appears:**

- `--bp-gradient` — avatar circle fill (with white initials), primary Sign Up CTA,
  brand-mark surfaces
- `--bp-text-on-gradient` — text that sits ON the gradient (white initials,
  white CTA label)
- `--bp-text-color` — wordmark "Ballpark", primary text on standard surfaces
- `--bp-font` — wordmark + avatar initials + brand-prominent typography.
  Currently `Inter Tight`; future ConfigService can override at runtime from DB

---

## 3. Theme tokens (`--theme-*`) — both versions

Theme tokens **may be customised per persona / preset** via the page-settings
drawer. Use these for accents that should recolour with the active theme.

**v1 palette (parchment + amber):**

```css
--theme-accent: #D97706;    /* Primary — amber */
--theme-bg:     #F5F0E8;    /* Parchment */
--theme-text:   #92400E;    /* Dark amber */
--theme-border: #E8D9C0;    /* Warm hairline */
--theme-empty:  #EDD9A3;    /* Empty state */
```

**v2 carries these forward, applied through PrimeNG Aura's preset bridge.**
The `tailwind.config.js` palette REPLACES Tailwind's default colors with
token-backed names — `text-slate-500`, `bg-white`, `border-black/10` do not
compile (build fails).

---

## 4. Semantic-state tokens (`--color-*`) — fixed meaning

These never recolour with theme. They encode state semantics, so a green pill
means "live" everywhere.

```css
--color-success:      #047857;   /* Live / Signed / Accepted */
--color-success-soft: #d1fae5;
--color-warn:         #b45309;   /* Negotiating / Pending invite */
--color-warn-soft:    #fef3c7;
--color-danger:       #b91c1c;   /* Suspended / Declined / Destructive */
--color-danger-soft:  #fee2e2;
--color-info:         #1e40af;   /* Signing SOW / In progress */
--color-info-soft:    #dbeafe;
--color-action:       #6d28d9;   /* Payment Processing / Quoted */
--color-action-soft:  #ede9fe;
```

Plus structural neutrals:

```css
--color-border-hairline:  rgba(15, 23, 42, 0.10);
--color-border-medium:    rgba(15, 23, 42, 0.18);
--color-text:             #111111;  /* darkest — hero/page titles */
--color-text-strong:      #374151;  /* middle — section titles + field values */
--color-text-secondary:   #6b7280;  /* light — subtitles + field labels */
--color-text-muted:       #BBBBBB;
--color-surface:          #FFFFFF;
--color-fill:             #f8fafc;
```

**Each soft variant pairs with its strong sibling** for badge / pill chrome:

```html
<span class="bg-warn-soft text-warn px-2 py-0.5 rounded-full text-xs">
  Pending invite
</span>
```

---

## 5. Typography — ONE family, one type scale, enforced (pV2-TYPE-01)

**Headline rule: the font FAMILY never varies.** One family for every text
node, DB-driven: the `bp_brand_config` key/value row `font_pair` →
`BrandConfigService` → `--bp-font` on `:root` at bootstrap. Differentiation
comes from the type SCALE — size, weight, case, color, line-height — never
from family. Like Word's font picker: the admin picks one font, the entire
app follows in one reload (drill-verified: flipping the DB row to monospace
restyles everything including PrimeNG controls).

`--font-display` / `--font-body` survive as ALIASES of `--bp-font` (a future
two-family pairing is a one-line token flip; they die with v1). `--font-mono`
exists for dev chrome only (version chip) — not a brand surface.

**Two legal declaration sites** for `font-family` / literal `font-size`:
`client-v2/src/styles.css` and the `BallparkPreset` in `app.config.ts`.
Components may reference TOKENS (`var(--bp-font)`, `var(--font-*)`,
`var(--text-*)`) but never literals — lint-enforced by
`client-v2/scripts/check-style-guards.js` (arbitrary Tailwind `text-[Npx]`
fails too; the token-mapped `text-xs…text-greeting` utilities are the
sanctioned Tailwind path). Dynamic template bindings (`[style.font-size.px]`,
e.g. the avatar's size-proportional initials) are the sanctioned runtime
exception (§13).

**PrimeNG**: Aura sets NO font-family of its own (verified empirically —
PrimeNG 21 inherits the page font; `--p-font-family` is unset). No preset
bridge needed; PrimeNG controls follow `--bp-font` automatically.

### Layer 1 — primitive tokens (styles.css; the One Definition of every value)

```css
--text-xs:       10px;   /* micro-meta — capsule chip captions */
--text-2xs:      11px;   /* eyebrows, status pills, timestamps */
--text-sm:       12px;   /* field labels, help, captions, column headers */
--text-base:     13px;   /* body small, subtitles, field values */
--text-md:       14px;   /* body default, drawer section titles */
--text-lg:       16px;   /* large body — marketing paragraph */
--text-xl:       18px;   /* section titles, home subtitle */
--text-2xl:      22px;   /* ALL container headings: card / drawer / edit-section titles */
--text-hero:     40px;   /* page titles (28px under 640px via ROOT media override) */
--text-greeting: clamp(40px, 5vw, 60px);  /* home greeting — responsive in the token */

--tracking-wide:  0.05em; /* uppercase treatments */
--leading-tight:  1.15;   /* greeting / hero titles */
--leading-snug:   1.3;    /* card + drawer titles */
--leading-normal: 1.45;   /* body, labels, help */
```

Mobile sizes change at the ROOT (`@media` re-declaring the token), never
per-component. `--text-greeting` needs no override — `clamp()` is the
responsive mechanism.

### Layer 2 — the type-class table (the binding standard)

Surface-keyed names; every class composes Layer-1 tokens and sets
`font-family: var(--bp-font)`. **Shared components bake their classes in**
(page-hero applies `.bp-page-*`, edit-field applies `.bp-field-*`,
home-launcher applies `.bp-home-*`, launcher-tile applies `.bp-card-*`) —
hand-typed classes appear only in page-specific templates. Where two classes
coincide today (card-title ≡ drawer-title) that's deliberate convergence of
compositions, free to diverge later — the values live once, in Layer 1.

| Layer | Class | Size | Weight | Case | Leading | Color |
|---|---|---|---|---|---|---|
| Hero — home | `.bp-home-title` | greeting | 400 | — | tight | `--color-text` |
| | `.bp-home-subtitle` | xl | 400 | — | normal | `--color-text-secondary` |
| Hero — page | `.bp-page-back` | base | 500 | — | normal | `--color-text-secondary` (hover `--theme-accent`) — back link ABOVE the title; `<app-page-hero>` bakes it in |
| | `.bp-page-label` | 2xs | 600 | UPPER+track | normal | `--theme-text` ¹ |
| | `.bp-page-title` | hero | 400 | — | tight | `--color-text` |
| | `.bp-page-subtitle` | xl | 400 | — | normal | `--color-text-secondary` |
| Section | `.bp-section-title` | xl | 500 | — | snug | `--color-text` |
| | `.bp-section-subtitle` | base | 400 | — | normal | `--color-text-secondary` |
| Edit-form card | `.bp-edit-section-title` | 2xl | 400 | — | snug | `--color-text-strong` — `<app-edit-section>` bakes it in; same RANK as card/drawer titles, differentiated by the middle shade |
| Card / tile | `.bp-card-title` | 2xl | 400 | — | snug | `--color-text` |
| | `.bp-card-subtitle` | base | 400 | — | normal | `--color-text-secondary` |
| Drawer | `.bp-drawer-label` | 2xs | 600 | UPPER+track | normal | `--theme-text` ¹ |
| | `.bp-drawer-title` | 2xl | 400 | — | snug | `--color-text` |
| | `.bp-drawer-section-title` | md | 500 | — | snug | `--color-text` |
| | `.bp-drawer-section-subtitle` | sm | 400 | — | normal | `--color-text-secondary` |
| Field | `.bp-field-label` | sm | 500 | — | normal | `--color-text-secondary` |
| | `.bp-field-value` | md | 400 | — | normal | `--color-text-strong` — converged with edit-field's `.bp-fld` chrome (Liam, 2026-06-11) |
| | `.bp-field-help` | sm | 400 | — | normal | `--color-text-muted` |
| Body | `.bp-body` | md | 400 | — | normal | `--color-text` |
| | `.bp-body-small` | base | 400 | — | normal | `--color-text` |
| | `.bp-caption` | sm | 400 | — | normal | `--color-text-muted` |
| Inline | `.bp-status-pill` | 2xs | 600 | UPPER+track | 1 | per state — class is TYPE only; shape + state colors stay with the consumer |
| | `.bp-meta` | 2xs | 400 | — | normal | `--color-text-muted` |
| Column | `.bp-table-column-header` | sm | 600 | — | normal | `--color-text-secondary` |
| Brand | `.bp-wordmark` | 16px (brand metric — legal-site literal) | 600 | — | 1 | `--bp-text-color` |

¹ **Locked decision (Liam, 2026-06-11):** eyebrows use the THEMABLE
`--theme-text` (they re-colour with persona presets); titles stay on the
fixed-neutral `--color-text`. Deliberately ported from v1 — do not "fix".

### Rules

1. **Always resolve through a token or a table class.** If the role you need
   isn't in the table, propose a new row — don't inline. No family
   exceptions, anywhere.
2. **One-off sizes are a smell** — `font-size: 44px` in a component is how
   pV2-04b drifted. The guard fails the lint on it now.
3. **Mobile via root token override**, never per-component re-declarations.
4. **v1 hierarchy** (Playfair/Libre Franklin pair) is retired in v2; v1 keeps
   its own styles until pV2-11.

---


## 6. Components

### PrimeNG components — always use these

```
p-button           → ALL buttons, no exceptions
p-inputText        → ALL text inputs
p-inputNumber      → Number inputs (VAT%, prices)
p-inputTextarea    → Multiline text
p-dropdown / p-select (v2) → Select / dropdown
p-selectButton     → Toggle groups
p-checkbox         → Checkboxes
p-toggleSwitch     → On/off toggles
p-tabView          → Tab navigation
p-dialog           → Modals (styleClass="bp-modal")
p-sidebar (v1) / p-drawer (v2) → Drawers (styleClass="bp-drawer")
p-toast            → Notifications
p-table            → Data tables
p-popover (v2)     → Free-content overlay menus
p-progressSpinner  → Loading states
p-calendar / p-datePicker (v2) → Date picker
p-chips / p-autocomplete (v2) → Tag input
```

### v2 standalone components

| Component | Location | Purpose |
|---|---|---|
| `<app-user-avatar>` | `shared/user-avatar/` | image OR gradient circle with white initials; size input |
| `<app-shell>` | `shell/app-shell/` | transparent header + footer chip + router-outlet |
| `<app-user-menu>` | `shell/user-menu/` | 40px avatar → popover with current user + dev switcher + sign-out |
| `<app-page-hero>` | `shell/page-hero/` | title + subtitle + optional back + accent variants + actions slot |
| `<app-version-chip>` | `shell/version-chip/` | fixed bottom-right `[Dev v2] vX.YYz` chip |

### v1 shared Angular components

```
app-modal               → p-dialog wrapper with parchment header
app-image-upload-panel  → Upload / Unsplash / Icon / Colour tabs
app-avatar              → Initials circle, theme accent background
app-stat-card           → Dashboard stat cell
app-loading             → Centred spinner
app-status-badge        → Coloured status pill (uppercase always)
app-feedback-dialog     → Floating feedback capture
app-markdown-editor     → Markdown editor with toolbar + preview
app-edit-section        → Per-section edit lifecycle
app-edit-field          → Single editable field (page/card/drawer densities)
CatalogueGridComponent  → Reusable grid for browse pages
```

---

## 7. Layout patterns

### v2 page composition

```
<app-shell>                       ← transparent header, fixed
  <app-page-hero
    title="Inbox"
    subtitle="Project conversations"
    [back]="{ label: 'Back', href: '/home' }"
    align="left"
    accent="none">                ← default transparent
    <p-button hero-actions ... /> ← right-side actions slot
  </app-page-hero>

  <div class="bp-page-body">      ← 32px padding wrapper
    <!-- page content -->
  </div>
</app-shell>
<app-version-chip />              ← fixed bottom-right
```

### v1 page composition

```
Hero banner
  Parchment background (--theme-bg)
  Org name — Playfair Display, 36px, centered
  Page label — uppercase, muted, letter-spaced (e.g. SETTINGS)
  Tab bar — centered, text labels only, NO icons
  Active tab — theme accent underline
  Single border-bottom: 0.5px solid var(--color-border) on tab bar only
  No border on hero container itself

Page title (every tab)
  Playfair Display, 22px, weight 400
  text-align: center, margin-bottom: 24px
  class: bp-page-title

Content area
  max-width: 640px, margin: 0 auto
  Appearance tab exception: 960px two-column grid
```

---

## 8. Buttons

All defined in `styles.css`. Change there to change everywhere.

### Button tiers (v2)

```
p-button              → Filled accent (themed), white text. Hover: darker shade.
                        Default app primary CTA.
p-button-outlined     → White bg, accent border + text. Hover: accent filled
p-button-text         → Transparent, accent text. Hover: theme-soft tint
p-button-danger       → White bg, red text. Hover: light red tint
.bp-btn-cancel        → Parchment-ish bg (modal / drawer footer)
.bp-btn-save          → Parchment-ish bg (modal / drawer footer). Both hover: accent
.bp-btn-outline       → White pill, hairline border, neutral text. The quiet
                        action: edit-form "Edit" + "Cancel" (§10).
.bp-btn-grad          → Vivid gradient fill (--bp-gradient), white text.
                        BRAND CTA — sign-up, hero CTAs, AND the edit-form
                        "Save changes" (§10, the v1 standard). NOT for other
                        everyday in-app primaries (that's plain p-button).
```

### `.bp-btn-grad` — locked spec (shipped v2.11c)

Lives in `client-v2/src/styles.css`. Reach for it on:

- The edit-form card's **Save changes** (via `<app-edit-section>` — §10)
- Marketing/landing Sign Up CTA (primary)
- Hero CTAs that need brand expression
- "Create new project" if/when promoted to a hero-level CTA

Outside those, routine page primaries (send, confirm, dialog OK) stay as
plain themed `p-button` so the brand gradient stays scarce and meaningful.

```css
/* Shared chrome with .bp-btn-outline */
.bp-btn-outline,
.bp-btn-grad {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  font-family: var(--font-body);
  font-size: var(--text-md);            /* 14px */
  font-weight: 400;
  cursor: pointer;
  border: 1px solid transparent;
  transition: box-shadow .15s, transform .15s, background .15s;
}

.bp-btn-grad {
  background: var(--bp-gradient);
  color: var(--bp-text-on-gradient);
  /* Brand-glow shadow uses --bp-gradient-shadow-rgb (pink stop) */
  box-shadow:
    0 2px 6px rgba(var(--bp-gradient-shadow-rgb), 0.20),
    0 1px 2px rgba(0, 0, 0, 0.06);
}
.bp-btn-grad:hover {
  box-shadow:
    0 8px 20px rgba(var(--bp-gradient-shadow-rgb), 0.28),
    0 2px 6px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}
.bp-btn-grad:active   { transform: translateY(0); }
.bp-btn-grad:disabled { opacity: .55; cursor: default; box-shadow: none; transform: none; }
.bp-btn-grad:focus-visible {
  outline: 2px solid rgba(var(--bp-gradient-shadow-rgb), 1);
  outline-offset: 2px;
}

/* Drawer density — when inside .bp-card--drawer or a drawer footer */
.bp-card--drawer .bp-btn-outline,
.bp-card--drawer .bp-btn-grad {
  padding: 8px 16px;
  font-size: var(--text-base);   /* 13px */
}
```

**Supporting tokens** (live in `client-v2/src/styles.css` since v2.11c):

```css
--radius-pill: 999px;                     /* button pills — never inline 9999px */
--bp-gradient-shadow-rgb: 214, 51, 132;   /* pink stop of --bp-gradient, as r,g,b */
```

`--bp-gradient-shadow-rgb` mirrors v1's `--theme-accent-rgb` pattern — the
source for every brand-glow shadow or focus ring; never inline the rgba in
components. `.bp-btn-outline` rides `--color-surface` / `--color-border-hairline`
/ `--color-text` / `--shadow-xs` (hover `--shadow-md`).

### Sizes (v2 PrimeNG)

- `size="small"` — drawer / dense form action
- default — main page CTA
- `size="large"` — hero CTA (e.g. landing page Sign Up — pair with `.bp-btn-grad`)

---

## 9. Drawer standard

v1 uses `<p-sidebar>`; v2 uses `<p-drawer>` (Aura rename). Same `styleClass="bp-drawer"`.

```html
<!-- v2 markup -->
<p-drawer [(visible)]="drawerVisible"
          position="right"
          styleClass="bp-drawer"
          [style]="{ width: '480px' }">
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
    <p-button label="Cancel" styleClass="bp-btn-cancel" (onClick)="close()" />
    <p-button [label]="actionLabel" styleClass="bp-btn-save" (onClick)="save()" />
  </ng-template>
</p-drawer>
```

### Chrome — locked spec

v2's drawer ships Aura-default out of the box; the `.bp-drawer` styleClass
hooks must override the header / content / footer to land Ballpark identity.
**Defined once in** `client-v2/src/styles.css`, never per-component.

```css
/* Header — tinted fill, subtle border, generous breathing room */
.bp-drawer.p-drawer .p-drawer-header {
  background: var(--theme-drawer-header-bg);   /* see token below */
  border-bottom: 0.5px solid var(--theme-border);
  padding: 20px 24px;
}

/* Content — kill PrimeNG default padding; .bp-drawer-body owns it */
.bp-drawer.p-drawer .p-drawer-content {
  padding: 0;
}

/* Footer — white, hairline top, right-aligned actions */
.bp-drawer.p-drawer .p-drawer-footer {
  background: var(--color-surface);
  border-top: 0.5px solid var(--color-border-hairline);
  padding: 16px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* Internal structure (header eyebrow + title) */
.bp-drawer-header     { display: flex; flex-direction: column; gap: 2px; }
.bp-drawer-header-row { display: flex; align-items: flex-start; justify-content: space-between; width: 100%; }
.bp-drawer-label      {
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--theme-text);
  text-transform: uppercase;
}
.bp-drawer-title      {
  font-family: var(--font-display);
  font-size: var(--text-2xl);   /* 22px */
  font-weight: 400;
  color: var(--color-text);
  line-height: 1.2;
}
.bp-drawer-body       { padding: 24px; }
```

**New token to introduce** (in `client-v2/src/styles.css`):

```css
--theme-drawer-header-bg: var(--color-fill);   /* default, near-white */
```

v1 used `--color-fill` (`#f8fafc` cool tint). v2 has the option to map this
to `--theme-soft` (soft pastel pink → mint) if the drawer should carry brand
warmth — pick one, lock it, document the choice in DESIGN.md. **Default to
`--color-fill`** unless QC says otherwise.

### Section + field chrome inside drawers

For editable attribute sections in v1: use `<app-edit-section
density="drawer">` (per-section lifecycle) or `[editable]="false"` for an
always-edit form, with `<app-edit-field density="drawer">` for fields. The
shared component owns the wiring.

v2 has `<app-edit-field>` foundation from pV2-04b1-qc (drawer density, text +
select only). Extend to page density in pV2-04c.

---

## 10. Edit patterns

### Single record — the edit-form card standard (locked v2.11c)

**Profile (`/settings/profile`) is the reference.** Every future edit
surface uses this template; the hover-pencil + tick/cross pattern is
retired.

```
Card chrome:  --color-surface bg, --color-border-hairline border,
              --radius-card (20px), p-6
Title:        .bp-edit-section-title (2xl/400/snug/strong) at the top —
              <app-edit-section> bakes it in; consumers never type the class
Fields:       .bp-field-grid-2 / .bp-field-grid-3 of <app-edit-field>
              (zero view→edit shift)
Buttons:      bottom-left .bp-card-foot row (mt-6, gap 10px)
  View:       "Edit"  — .bp-btn-outline + square-pen icon (16)
  Editing:    "Cancel" — .bp-btn-outline
              "Save changes" — .bp-btn-grad + check icon (16),
              both disabled while saving
Lifecycle:    owned by <app-edit-section> — (edit) → consumer snapshots,
              (cancelled) → consumer restores, (save) → consumer persists
              then flips [(editing)] off itself (no optimistic close).
              editLabel / saveLabel inputs override the copy.
When to use:  Profile, any single-record settings page
```

### Multiple items (catalogue, team, categories)

```
Drawer pattern: p-sidebar / p-drawer, position="right", width 480px
  Parchment header (display title + subtitle)
  Form fields using standard p-inputText
  Parchment footer: Cancel + Save
When to use: Catalogue items, team members, categories, send lead
```

---

## 11. Status pills

```
Component: <app-status-badge> (v1)
  <app-status-badge [status]="entity.status_name" />

Design:  11px, font-weight 600, border-radius 20px, UPPERCASE
         0.5px border always
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

### v2 status pills via semantic tokens

```html
<span class="bg-success-soft text-success px-2 py-0.5 rounded-full text-xs font-semibold uppercase">
  Live
</span>
<span class="bg-warn-soft text-warn ...">Negotiating</span>
<span class="bg-info-soft text-info ...">Signing SOW</span>
<span class="bg-action-soft text-action ...">Payment Processing</span>
```

---

## 12. Lucide icons standard

### v1 (Angular 18) — per-component `.pick()`

```
Always use LucideAngularModule.pick() — never bare LucideAngularModule
Register only the icons used in that component

Example:
  imports: [ LucideAngularModule.pick({ SquarePen, ChevronRight }) ]
  Template: <lucide-icon name="square-pen" [size]="16"></lucide-icon>
```

### v2 (Angular 21 / standalone components) — ONE global `.pick()` in `app.config.ts`

The v1 per-component pattern does NOT compile in v2's standalone imports.
Register every icon the app uses ONCE in `app.config.ts`:

```typescript
// client-v2/src/app/app.config.ts
import { LucideAngularModule, SquarePen, ChevronRight, Inbox, Store /* … */ } from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(
      LucideAngularModule.pick({ SquarePen, ChevronRight, Inbox, Store /* … */ })
    ),
    // …
  ],
};
```

Components just import `LucideAngularModule` (no `.pick()`):

```typescript
@Component({
  selector: 'app-foo',
  standalone: true,
  imports: [LucideAngularModule],
  template: `<lucide-icon name="square-pen" [size]="16"></lucide-icon>`,
})
```

Add new icon names to the global `pick()` call when introducing them.

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
  trash-2       → destructive action
  list-filter   → filter button
  messages-square → conversations / inbox eyebrow
```

---

## 13. Styling laws

### The three-layer rule

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
- Hardcode hex colour values in component files (enforced at compile time in v2)
- Use raw Tailwind utility classes with embedded colors (`text-slate-500`,
  `bg-white`, `border-black/10`, etc.) — these do not compile in v2
- Use inline styles for layout (use Tailwind)
- Create a new button style outside of styles.css
- Use different styling approaches in different components

### Inline styles — allowed exceptions

- Preview panel dynamic values: `[style.color]="previewAccent"` etc.
  These bind to runtime values from ConfigService and cannot use CSS vars.
- 0.5px borders: `style="border-bottom: 0.5px solid var(--color-border)"`
  Tailwind does not support sub-pixel border widths.

---

## 14. Naming & vocabulary

Canonical **internal** vocabulary — exact names in routes, components, types,
and code comments. Customer-facing UI labels may differ (config / persona
overrides); internal names below are fixed.

| Internal name | What it is | URL | Default label | Customer override |
|---|---|---|---|---|
| **storefront** | A supplier's public-facing presence — branding, company info, how they appear in the Marketplace | `/storefront` | "Storefront" | "Profile" |
| **store** | A supplier's catalogue management — their items/products | `/store` | "Store" | "Shop" |

`storefront` vs `store` is the canonical pair — keep them distinct:

- *storefront* = the shop window (presentation / profile).
- *store* = the stockroom (catalogue / items).

Do not reintroduce `shopfront` — renamed to `storefront` in v1.68c. UI labels
are the ONLY place an alternative word may appear, and only via the
label-config / persona override mechanism — never hard-code a customer label
(e.g. "Profile", "Shop") as the internal route/type/component name.

---

## 15. Do's and don'ts

### Do

- **Do** use semantic tokens for state (success / warn / danger / info / action) —
  meaning never recolours with the theme
- **Do** use `--bp-*` for brand identity (wordmark, avatar fill)
- **Do** use `--theme-*` for accents that should follow theme presets
- **Do** keep status pills UPPERCASE
- **Do** keep buttons defined in `styles.css` — change once, propagates
- **Do** use `LucideAngularModule.pick({ IconName })` — register only what's used
- **Do** use the `host:` binding pattern in v2 components (no inner wrapper)

### Don't

- **Don't** hardcode hex codes anywhere in component files (v2 build fails)
- **Don't** use raw Tailwind color utilities (`text-slate-*`, `bg-white`,
  `border-black/N`) — v2 build fails
- **Don't** invent new button styles outside `styles.css`
- **Don't** use `p-tag` for status — use `<app-status-badge>` or semantic-token pills
- **Don't** mix `--bp-*` (brand fixed) with `--theme-*` (themable) — pick the
  right tier for the use case
- **Don't** use bare `LucideAngularModule` — always `.pick({})`

---

## Where each token lives

| Token | File |
|---|---|
| `--bp-*` | `client-v2/src/styles.css` + runtime override via `BrandConfigService` from `bp_brand_config` DB table |
| `--theme-*` | `client-angular/src/styles.css` (v1) + `client-v2/src/styles.css` (v2 carries forward) |
| `--color-*` semantic state | `client-v2/src/styles.css` (added in pV2-AUDIT-02 Fix 5) |
| Tailwind palette | `client-v2/tailwind.config.js` (REPLACES default — palette-bound to tokens) |
| PrimeNG bridge | `client-v2/src/app/app.config.ts` via `definePreset` + `providePrimeNG` (`BallparkPreset`) |
| v1 button + pill classes | `client-angular/src/styles.css` |
