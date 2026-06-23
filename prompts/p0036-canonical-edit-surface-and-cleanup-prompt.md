# CC Prompt — p0036 — Canonical edit-surface standard + namespace cleanup

Locks in the "Standard Edit Surface" as the single canonical pattern for every editable surface in the app — drawers, page edit forms, project sub-tabs. The pattern is already what `event-drawer.component.ts` does today (the worked exemplar): hero/page header on top, flat sections separated by hairline dividers, eyebrow + edit pencil on each section, view/edit input states without pixel shift.

This prompt does three things in one commit:
1. **Document** the Standard Edit Surface authoritatively in `WORKING_STANDARDS.md` so the shape is no longer implicit
2. **Delete dead code** — the unreached `event.component.ts` tab carries 121 stale `bp-brief-*` hits in code that isn't even routed
3. **Refactor the remaining drift** — `event-drawer`'s `bp-evd-row*` / `bp-evd-field` grid namespace, plus `brief-public` and `build-legacy` mop-up

This is NOT the shared-component extraction. `<app-edit-section>` extraction stays in `p0037`. p0036 cleans the CSS-class layer and documents the standard so the extraction has an unambiguous target.

Same rules: existing v1.22 tokens only, Lucide icons only, PrimeNG + Tailwind + CSS vars per WORKING_STANDARDS.

## Background — the standard is mostly there

The canonical chrome already exists in `client-angular/src/styles.css`:

- **Sections** (lines 1668-1672): `.bp-section`, `.bp-section-header`, `.bp-section-title`, `.bp-section-actions`
- **Field grid** (lines 1718-1722): `.bp-field-grid-2`, `.bp-field-grid-3`, `.bp-field-label`
- **Field states** (lines 1800-1916): `.bp-field-readonly` (view) and `.bp-input-edit` (edit) with the explicit "v1.65ao — STANDARD FIELD SIZE" comment calling out zero-shift view→edit transitions
- **Drawer chrome** (used by event-drawer, supplier-drawer, item-drawer, estimate-drawer): `.bp-drawer`, `.bp-drawer-header`, `.bp-drawer-header-row`, `.bp-drawer-label`, `.bp-drawer-ref-chip`, `.bp-drawer-title`, `.bp-drawer-body`
- **Icon buttons**: `.bp-icon-btn`, `.bp-icon-save`, `.bp-icon-cancel`, `.bp-icon-danger`
- **Page header**: `.bp-page-title`, `.bp-page-divider`

`event-drawer.component.ts` (the screenshot exemplar) uses all of the above correctly at the section and field-state layer. Most other editable surfaces in the app already comply (`features/settings/organisation`, `features/settings/team`, `features/settings/subscription`, project Overview tab, supplier-drawer, item-drawer, estimate-drawer, category-context-panel, etc.).

**Three pockets of drift remain:**

1. **`features/projects/pages/project-detail/tabs/event/event.component.ts`** — the legacy in-page tab. 121 `bp-brief-*` hits. Per `project-detail.routes.ts` line 17, `/event` redirects to `/overview`, so this file is **unreachable**. The drawer replaced it (v1.29b → v1.65o per the header comment); the tab file was kept for git-history continuity only. **Delete the file.**
2. **`features/brief-public/brief-public.component.ts`** — 4 `bp-brief-*` hits. **Refactor.**
3. **`features/projects/pages/project-detail/tabs/build/build-legacy.component.ts`** — 4 `bp-brief-*` hits. Still routed (lazy-loaded at `project-detail.routes.ts` line 69). **Refactor.**

**One additional drift to fix** in the live exemplar itself:

4. **`shared/components/event-drawer/event-drawer.component.ts`** — its section/field/edit chrome is canonical, but it invented a parallel grid namespace `bp-evd-row` / `bp-evd-row--1` / `bp-evd-row--2` / `bp-evd-row--3` / `bp-evd-field` instead of using `bp-field-grid-N` + `bp-field`. **Refactor those classes only.** The other `bp-evd-*` classes (`bp-evd-budget`, `bp-evd-prefix`, `bp-evd-suffix*`, `bp-evd-brief-*`, `bp-evd-parse`, `bp-evd-status-*`, `bp-evd-footer`) are page-specific and stay — they're legitimate local concerns (currency prefix/suffix on value input, AI brief parser flow, status pill, timestamp footer).

## 1. WORKING_STANDARDS — add "Standard Edit Surface" section

In `WORKING_STANDARDS.md`, find the **"Extract Before Duplicate"** section (containing the "Page chrome" sub-rule from p0034 and the `<app-update-me>` sub-rule from p0035). Immediately **after** the existing "Page chrome — separate rule, same spirit" sub-rule and **before** the "Marking debt with `<app-update-me>`" sub-rule, insert a new sub-rule called **"Standard Edit Surface — canonical shape for editable pages and drawers."**

Content:

````markdown
### Standard Edit Surface — canonical shape for editable pages and drawers

Every editable surface in the app — full-page edit forms (Settings/Organisation,
Subscription, Team), project sub-tabs (Overview, Build), and slide-out drawers
(event-drawer, supplier-drawer, item-drawer, estimate-drawer) — follows
the same shape. There is ONE standard. Worked exemplar:
`shared/components/event-drawer/event-drawer.component.ts`.

**Anatomy**

1. **Header band** at top.
   - Page surfaces: `<h2 class="bp-page-title">{TITLE}</h2>` + `<div class="bp-page-divider"></div>`
   - Drawer surfaces: hero band with `bp-drawer-label` eyebrow (often with `bp-drawer-ref-chip` for the object ref) + `bp-drawer-title` serif title + close button
2. **Sections** stacked vertically — flat blocks separated by hairline dividers (NOT boxed cards). Each section:
   - `<div class="bp-section">` wrapper
   - `<div class="bp-section-header">` containing `<span class="bp-section-title">EYEBROW</span>` and `<div class="bp-section-actions">` slot (edit pencil → save/cancel)
   - Field grid below: `<div class="bp-field-grid-2">` / `-3` / `-4`
3. **Fields** — single input element per field, class-bound for view vs edit state.

**Canonical edit-section markup**

```html
<div class="bp-section">
  <div class="bp-section-header">
    <span class="bp-section-title">EYEBROW LABEL</span>
    <div class="bp-section-actions">
      <button *ngIf="!editing" class="bp-icon-btn" (click)="startEdit()"
              title="Edit">
        <lucide-icon name="square-pen" [size]="14"></lucide-icon>
      </button>
      <ng-container *ngIf="editing">
        <button class="bp-icon-btn bp-icon-save" (click)="save()"
                [disabled]="saving" title="Save">
          <i class="pi pi-check"></i>
        </button>
        <button class="bp-icon-btn bp-icon-cancel" (click)="cancel()"
                title="Cancel">
          <i class="pi pi-times"></i>
        </button>
      </ng-container>
    </div>
  </div>
  <div class="bp-field-grid-2">     <!-- or -grid-3 / -grid-4 -->
    <div class="bp-field">
      <label class="bp-field-label">{LABEL}</label>
      <input pInputText [(ngModel)]="field"
             class="w-full"
             [class.bp-field-readonly]="!editing"
             [class.bp-input-edit]="editing"
             [readonly]="!editing"/>
    </div>
  </div>
</div>
```

**Canonical class taxonomy**

| Purpose | Class |
|---|---|
| Page title | `bp-page-title` |
| Page divider | `bp-page-divider` |
| Page wrapper (feature-local layout) | `bp-{feature}-body` |
| Drawer host | `<p-sidebar styleClass="bp-drawer">` |
| Drawer header row | `bp-drawer-header-row` |
| Drawer eyebrow / ref-chip | `bp-drawer-label`, `bp-drawer-ref-chip` |
| Drawer title | `bp-drawer-title` |
| Drawer body | `bp-drawer-body` |
| Section wrapper | `bp-section` |
| Section header (eyebrow + actions row) | `bp-section-header` |
| Section eyebrow text | `bp-section-title` |
| Section actions slot | `bp-section-actions` |
| Section hint (small muted explainer) | `bp-section-hint` |
| Field grid | `bp-field-grid-2` / `-3` / `-4` |
| Field column span | `bp-field-s2` (span 2) |
| Field row wrapper | `bp-field` |
| Field label | `bp-field-label` |
| Field input — view mode | `bp-field-readonly` + `[readonly]` |
| Field input — edit mode | `bp-input-edit` |
| Icon button — base / save / cancel / destructive | `bp-icon-btn` (+ `bp-icon-save` / `bp-icon-cancel` / `bp-icon-danger`) |

**View-vs-edit input pattern**

ONE input per field, class-bound. NOT two sibling inputs gated by `*ngIf`.
The `bp-field-readonly` / `bp-input-edit` classes share the exact 34px
height and metrics so view→edit produces no layout shift (see the
`v1.65ao — STANDARD FIELD SIZE` comment in `styles.css`).

**Non-standard namespaces — do not introduce, refactor when encountered**

- `bp-brief-*` — legacy from when projects were called "briefs." Retired by p0036.
- Custom per-feature grid / field namespaces (e.g., `bp-evd-row`, `bp-evd-field`) — always use the canonical `bp-field-grid-N` + `bp-field`.
- Custom per-page section classes (`bp-foo-sec`, `bp-foo-flabel`, etc.) — always use the canonical `bp-section-*`.

**Page-local helpers are fine** when the concern is genuinely local
(e.g., `bp-evd-budget`, `bp-evd-prefix*`, `bp-evd-status-pill` in
event-drawer — currency prefix UI, status pill chip — these are
legitimately page-specific and don't belong in the global namespace).
Use the `bp-{feature-short}-*` prefix convention.
````

Don't reformat or restructure anything else in `WORKING_STANDARDS.md`.

## 2. Add missing canonical CSS to `styles.css`

In `client-angular/src/styles.css`, the field-grid currently defines only `-2` and `-3` (lines 1718-1719). Add the canonical 4-column grid + span helper immediately after:

```css
.bp-field-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.bp-field-s2    { grid-column: span 2; }
```

Match the existing `gap: 20px` (don't carry the Event drawer's tighter `12px` into the canonical rule — the standard wins).

Add the matching responsive collapse rule at the existing `@media` breakpoint (around line 2059):

```css
.bp-field-grid-4 { grid-template-columns: 1fr !important; }
.bp-field-s2    { grid-column: auto !important; }
```

Add `bp-section-hint` if it isn't already defined (group with the section rules around line 1671):

```css
.bp-section-hint { font-size: 11.5px; color: var(--color-text-secondary); }
```

## 3. Delete `event.component.ts` (dead tab)

`client-angular/src/app/features/projects/pages/project-detail/tabs/event/event.component.ts` is unreached — `/event` redirects to `/overview` per `project-detail.routes.ts` line 17, and the file's own header comment notes it was retained for git-history continuity only.

- **Delete the file.**
- **Delete the `tabs/event/` directory** if nothing else lives there (check for sibling `.css` / `.html` / `.spec.ts` files).
- **Remove the `path: 'event', redirectTo: 'overview'` route** from `project-detail.routes.ts` — the `/event` URL doesn't need to survive (the redirect was a transition courtesy when the drawer replaced the tab; no extant external link should still point at it). Verify by greppping for `/event` references inside the codebase first. If any internal link still routes to `/event`, leave the redirect in for safety and note it in the ship report.
- **Remove the lazy `loadComponent` import** for the event tab if one exists.

This single deletion kills 121 of the remaining `bp-brief-*` hits.

## 4. Refactor `event-drawer.component.ts` grid namespace

`client-angular/src/app/shared/components/event-drawer/event-drawer.component.ts`. Template + local styles.

**Template renames** (only the grid/field classes — leave the rest):

| Old | New |
|---|---|
| `bp-evd-row--1` | `bp-field-grid-2` with `bp-field-s2` span (single-col-effective via span-2 in 2-col grid) **OR** restructure the field into a `bp-field-grid-1` if such a single-col layout is what's expected. Use whichever produces the visually equivalent layout to today. |
| `bp-evd-row--2` | `bp-field-grid-2` |
| `bp-evd-row--3` | `bp-field-grid-3` |
| `bp-evd-row` (no modifier) | Inspect: if it's a row wrapper without a column count, it's likely styled to behave as a 2-col grid by default — map to `bp-field-grid-2`. |
| `bp-evd-field` | `bp-field` |

**Styles in the component's `styles: [...]` array**: delete the local rules that define `bp-evd-row*` and `bp-evd-field`. Keep all other local rules — they style genuinely page-specific concerns.

If the drawer's grid was using a tighter `gap` than 20px and the visual rhythm depended on it, document the deviation in the ship report and propose a follow-up — but **default to the canonical 20px**.

## 5. Refactor `brief-public.component.ts`

`client-angular/src/app/features/brief-public/brief-public.component.ts` — 4 `bp-brief-*` hits. Apply the standard rename mapping:

| Old | New |
|---|---|
| `bp-brief-sec` | `bp-section` |
| `bp-brief-sec-h` | `bp-section-header` |
| `bp-brief-sec-label` | `bp-section-title` |
| `bp-brief-sec-actions` | `bp-section-actions` |
| `bp-brief-grid4` | `bp-field-grid-4` |
| `bp-brief-s2` | `bp-field-s2` |
| `bp-brief-field` | `bp-field` |
| `bp-brief-flabel` | `bp-field-label` |
| `bp-brief-finput` (view) | `bp-field-readonly` |
| `bp-brief-edit` | `bp-input-edit` |

Delete any local CSS in the component that defined `bp-brief-*` rules.

## 6. Refactor `build-legacy.component.ts`

`client-angular/src/app/features/projects/pages/project-detail/tabs/build/build-legacy.component.ts` — 4 `bp-brief-*` hits. Same mapping as §5. Still routed (lazy-loaded at `project-detail.routes.ts` line 69), so it's live code.

If `build-legacy` contains hand-rolled section markup that's not using a shared component, add `<app-update-me reason="app-edit-section">` at the top of its template.

## What NOT to do

- **Don't extract `<app-edit-section>` yet.** That's `p0037`. p0036 documents the standard + cleans the CSS-class layer.
- **Don't touch the other `bp-evd-*` classes** in event-drawer beyond grid/field. The page-specific ones stay (`bp-evd-budget`, `bp-evd-prefix*`, `bp-evd-suffix*`, `bp-evd-brief-*`, `bp-evd-parse`, `bp-evd-status-*`, `bp-evd-footer`).
- **Don't refactor compliant pages.** Organisation, Team, Subscription, Overview tab, supplier-drawer, item-drawer, estimate-drawer, category-context-panel etc. are already canonical — leave them.
- **Don't add `<app-update-me>` to compliant surfaces.** The banner is only for surfaces that still hand-roll chrome after this commit. Event-drawer post-refactor isn't a candidate (it uses canonical chrome).
- **Don't reorganise `styles.css`.** Just the three additions in the locations specified.
- **Don't change `WORKING_STANDARDS` outside the new sub-rule.** No reformatting, no deletions elsewhere.
- **Don't widen scope to project-detail Build / Marketplace / Estimate / Messages / Suppliers tabs.** Earlier grep confirmed they have zero `bp-brief-*` hits — they're outside p0036's scope.

## Verify

- **Grep clean (legacy namespace):** `grep -rn "bp-brief-" client-angular/src/app` → zero hits.
- **Grep clean (event-drawer grid drift):** `grep -rn "bp-evd-row\|bp-evd-field" client-angular/src/app` → zero hits.
- **Event-drawer visual + functional parity:** open the drawer from a project Overview event strip. Same hero band, same three sections (EVENT DETAILS / EVENT TYPE / LOGISTICS), same edit-pencil → save/cancel flow, same view-edit input behaviour with no layout shift. Sections still separated by hairline dividers (not boxed). 4-col grid + span-2 layout where it was before.
- **brief-public visual parity:** open the public brief view. Same layout, same chrome, no regressions.
- **build-legacy visual parity:** open the legacy build URL. Same layout.
- **Event tab URL removed:** `/projects/:id/event` either 404s or redirects (per whichever path you chose). Either is acceptable; document which in the ship report.
- **WORKING_STANDARDS:** new "Standard Edit Surface — canonical shape for editable pages and drawers" sub-rule appears under "Extract Before Duplicate," between the existing page-chrome rule and the `<app-update-me>` rule. No other doc changes.
- **`styles.css` additions:** `bp-field-grid-4`, `bp-field-s2`, `bp-section-hint` defined (the first two also in the small-screen `@media` collapse block).
- **No regression on the compliant pages.** Spot-check Settings/Organisation, Settings/Team, project Overview tab — chrome unchanged.

When complete and verified, mark `p0036` `Done` in `prompts/backlog.md` and write `p0036-canonical-edit-surface-and-cleanup-shipped.md` per the cc-onboarding ship-report convention.

The ship report should include:
- Deletion: confirmation that `event.component.ts` (and its directory if applicable) is gone, and the `/event` route decision
- Rename count: `bp-brief-*` hits eliminated (~129 total: 121 from event tab deletion + 4 brief-public + 4 build-legacy) and `bp-evd-row*` / `bp-evd-field` hits eliminated (from event-drawer)
- Before/after screenshot of the event-drawer in view mode and edit mode (confirm visual parity)
- Both verification greps returning zero hits
