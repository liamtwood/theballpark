# p0038 — inbox-v2 search row + tree-rail shell (empty structure)

## Goal

Add the next chrome layers to `<app-messages-inbox-v2>`: the search row,
the two-column body shell, and the empty 3-deep tree rail using the
marketplace's existing global sidebar classes. **No data is loaded** — the rail
renders zero rows; the right pane shows an empty-state placeholder.

Agent default tree shape (this prompt): **Supplier → Category → Item**.
Supplier-viewer tree (Project → Item) and project-scoped variants land in p0039.

Also fold in two small adjacent items:
- Wire `heroAlign` from route data in app-shell (p0037 QC note).
- Declare the `showItemPreview` input on the shared component (used by a later prompt).

After this lands, `/inbox-v2` will show the full layout chrome — search bar
on top, empty rail on the left with the "Project conversations" eyebrow, empty
placeholder on the right — before any data muddies the picture.

## What's reused (do NOT re-create)

Global CSS already in `client-angular/src/styles.css`:
- `.bp-search-row`, `.bp-search-input`, `.bp-search-icon`, `.bp-search-filter-btn`
- `.bp-cat-body`, `.bp-cat-body--cats-left`, `.bp-cat-sidebar`, `.bp-cat-sidebar-head`, `.bp-cat-sidebar-body`
- `.bp-filter-title` (eyebrow text)
- `.bp-cat-rail`, `.bp-cat-rail-all`, `.bp-cat-rail-item`, `.bp-cat-rail-icon`, `.bp-cat-rail-text`, `.bp-cat-rail-name`, `.bp-cat-rail-count`, `.bp-cat-rail-chev`
- `.bp-cat-rail-subs`, `.bp-cat-rail-sub`

The marketplace `catalogue-grid.component.ts` (`shared/components/catalogue-grid/`) is the canonical reference for how these compose. Mirror its sidebar structure.

## What's new

### 1. New generic level primitive added to `styles.css`

Inbox-v2's tree depth varies (1-3 levels deep depending on viewerRole + scopedToProjectId). Instead of adding `.bp-cat-rail-sub-sub` for a fixed third level, add ONE generic row primitive that takes a `[data-level]` attribute for indent:

```css
/* v1.69x (p0038) — generic tree row used by inbox-v2's rail.
   Replaces ad-hoc .bp-cat-rail-sub-sub. Indent set by [data-level]. */
.bp-cat-rail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  border-radius: var(--radius-button);
  font-size: 13px;
  color: var(--color-text);
  transition: background 0.12s;
}
.bp-cat-rail-row[data-level="1"] { padding-left: 12px; font-weight: 600; }
.bp-cat-rail-row[data-level="2"] { padding-left: 28px; font-size: 12px; color: var(--color-text-secondary); }
.bp-cat-rail-row[data-level="3"] { padding-left: 44px; font-size: 12px; color: var(--color-text-secondary); }
.bp-cat-rail-row:hover { background: var(--color-fill); }
.bp-cat-rail-row.active { background: var(--theme-soft); color: var(--theme-accent); font-weight: 600; }

/* Optional subtitle line under the row's main label (used for supplier viewer:
   project row shows agency name as muted subtitle below project name). */
.bp-cat-rail-row-text { display: flex; flex-direction: column; align-items: flex-start; flex: 1; min-width: 0; }
.bp-cat-rail-row-name { line-height: 1.3; }
.bp-cat-rail-row-sub  { font-size: 11px; color: var(--color-text-secondary); font-weight: 400; line-height: 1.2; }
.bp-cat-rail-row-count { font-size: 11px; color: var(--color-text-secondary); }
.bp-cat-rail-row-chev  { color: var(--color-text-secondary); flex-shrink: 0; }
```

Sit these rules next to the existing `.bp-cat-rail-*` block in styles.css.

### 2. heroAlign wiring in app-shell

In `app-shell.component.ts` `updateFromRoute()`, alongside the existing `heroTitle` / `heroSub` reads (around line 846-847), also read `heroAlign` from route data and store it as the route default. The hero template should resolve final align as:

```
saved page-setting (ConfigService.getPageSetting(pageKey).heroAlign)
  ?? route.data.heroAlign
  ?? 'centre'        // existing global default
```

Concretely:
1. Add a new field on the component: `routeHeroAlign: 'left' | 'centre' | '' = ''`
2. In `updateFromRoute()`: `this.routeHeroAlign = data['heroAlign'] || '';`
3. Wherever the final `heroAlign` value is computed (currently reads from `ConfigService` / page-settings), add a fallback to `this.routeHeroAlign`, then to the existing default.

Behaviour after this lands:
- `/inbox-v2` (route data has `heroAlign: 'left'`, no saved page-setting) → left-aligned hero
- Open page-settings drawer, change align to Centre, save → centre wins (saved override beats route default)
- Reset page-settings → falls back to route default → left again

### 3. Component changes — `messages-inbox-v2.component.ts`

#### 3a. New input

```typescript
@Input() showItemPreview = true;
```

No template usage yet. It's declared so future prompts (item-preview-card layer) can read it without breaking the existing API.

#### 3b. State + types

Tree shape — **Supplier → Category → Item** for the agent-full case (this prompt's default). Supplier-viewer (Project → Item) and project-scoped variants come in p0039.

```typescript
export interface ItemThreadNode {
  itemId: string;
  itemName: string;
  latestSnippet: string;
  timestamp: string;       // pre-formatted relative string for now
  unreadCount: number;
}
export interface CategoryNode {
  categoryId: string;
  categoryName: string;
  iconName?: string;       // Lucide icon name (e.g. 'flower-2', 'utensils')
  threadCount: number;
  items: ItemThreadNode[];
}
// Top-level node for AGENT viewer (this prompt's tree).
export interface AgentSupplierNode {
  supplierId: string;
  supplierName: string;
  subtitle?: string;       // optional muted subtitle (reserved for future use)
  threadCount: number;
  categories: CategoryNode[];
}
// Top-level node for SUPPLIER viewer (declared for forward compat — not used here).
export interface SupplierProjectNode {
  projectId: string;
  projectName: string;
  agencyName: string;      // the FROM — shown as muted subtitle
  threadCount: number;
  items: ItemThreadNode[];
}
```

Component state:
```typescript
searchTerm = '';
filterOpen = false;                            // filter drawer comes later
agentTree: AgentSupplierNode[] = [];           // empty for now
expandedSupplierIds = new Set<string>();
expandedCategoryIds = new Set<string>();
selectedItemId: string | null = null;
```

Stub handlers (template hooks, no logic):
```typescript
onSearchChange(): void { /* debounced filter — comes with data prompt */ }
toggleSupplier(id: string): void {
  this.expandedSupplierIds.has(id)
    ? this.expandedSupplierIds.delete(id)
    : this.expandedSupplierIds.add(id);
}
toggleCategory(id: string): void {
  this.expandedCategoryIds.has(id)
    ? this.expandedCategoryIds.delete(id)
    : this.expandedCategoryIds.add(id);
}
selectItem(id: string): void {
  this.selectedItemId = id;
  this.threadSelected.emit(id);
}
activeFilterCount(): number { return 0; }     // stub — filter drawer comes later
```

#### 3c. Template

Uses the new `.bp-cat-rail-row[data-level]` primitive for ALL three levels — uniform markup, indent driven by the data attribute. Top to bottom:

```html
<div class="bp-inbox-v2" [class.bp-inbox-v2--compact]="compact">

  <!-- Search row (gated) -->
  <div class="bp-search-row" *ngIf="showSearchRow">
    <lucide-icon name="search" [size]="14" class="bp-search-icon"></lucide-icon>
    <input pInputText
           [(ngModel)]="searchTerm"
           (ngModelChange)="onSearchChange()"
           placeholder="Search threads, suppliers, items..."
           class="bp-search-input"/>
    <button type="button" class="bp-search-filter-btn"
            *ngIf="showFilterDrawer"
            [class.active]="filterOpen"
            (click)="filterOpen = !filterOpen"
            title="Filters">
      <lucide-icon name="list-filter" [size]="15"></lucide-icon>
    </button>
  </div>

  <!-- Two-column body shell (sidebar + thread pane) -->
  <div class="bp-cat-body bp-cat-body--cats-left">

    <!-- LEFT: tree rail (gated) -->
    <div class="bp-cat-sidebar" *ngIf="showTreeRail">
      <div class="bp-cat-sidebar-head">
        <lucide-icon name="messages-square" [size]="13" class="bp-cat-sidebar-head-icon"></lucide-icon>
        <div class="bp-filter-title">Supplier conversations</div>
      </div>
      <div class="bp-cat-sidebar-body">
        <div class="bp-cat-rail">
          <!-- Empty while agentTree = []. Each level uses .bp-cat-rail-row
               with [data-level] driving indent. -->
          <ng-container *ngFor="let supplier of agentTree">

            <!-- LEVEL 1 — supplier -->
            <button type="button" class="bp-cat-rail-row" [attr.data-level]="1"
                    (click)="toggleSupplier(supplier.supplierId)">
              <lucide-icon name="store" [size]="15"></lucide-icon>
              <span class="bp-cat-rail-row-text">
                <span class="bp-cat-rail-row-name">{{ supplier.supplierName }}</span>
                <span class="bp-cat-rail-row-sub" *ngIf="supplier.subtitle">{{ supplier.subtitle }}</span>
              </span>
              <span class="bp-cat-rail-row-count" *ngIf="supplier.threadCount">{{ supplier.threadCount }}</span>
              <lucide-icon [name]="expandedSupplierIds.has(supplier.supplierId) ? 'chevron-down' : 'chevron-right'"
                           [size]="14" class="bp-cat-rail-row-chev"></lucide-icon>
            </button>

            <ng-container *ngIf="expandedSupplierIds.has(supplier.supplierId)">
              <ng-container *ngFor="let category of supplier.categories">

                <!-- LEVEL 2 — category -->
                <button type="button" class="bp-cat-rail-row" [attr.data-level]="2"
                        (click)="toggleCategory(category.categoryId)">
                  <lucide-icon [name]="category.iconName || 'folder'" [size]="14"></lucide-icon>
                  <span class="bp-cat-rail-row-text">
                    <span class="bp-cat-rail-row-name">{{ category.categoryName }}</span>
                  </span>
                  <span class="bp-cat-rail-row-count" *ngIf="category.threadCount">{{ category.threadCount }}</span>
                  <lucide-icon [name]="expandedCategoryIds.has(category.categoryId) ? 'chevron-down' : 'chevron-right'"
                               [size]="13" class="bp-cat-rail-row-chev"></lucide-icon>
                </button>

                <ng-container *ngIf="expandedCategoryIds.has(category.categoryId)">
                  <!-- LEVEL 3 — item thread (leaf, selectable) -->
                  <button type="button" class="bp-cat-rail-row" [attr.data-level]="3"
                          *ngFor="let thread of category.items"
                          [class.active]="selectedItemId === thread.itemId"
                          (click)="selectItem(thread.itemId)">
                    <span class="bp-cat-rail-row-text">
                      <span class="bp-cat-rail-row-name">{{ thread.itemName }}</span>
                      <span class="bp-cat-rail-row-sub" *ngIf="thread.latestSnippet">{{ thread.latestSnippet }}</span>
                    </span>
                    <span class="bp-cat-rail-row-count" *ngIf="thread.unreadCount">{{ thread.unreadCount }}</span>
                  </button>
                </ng-container>

              </ng-container>
            </ng-container>

          </ng-container>
        </div>
      </div>
    </div>

    <!-- RIGHT: thread pane (empty placeholder for now) -->
    <div class="bp-inbox-v2-thread-pane">
      <div class="bp-inbox-v2-empty">
        Select a thread to view.
      </div>
    </div>
  </div>
</div>
```

Note: only the LEAF row (`[data-level]="3"`) uses `.active` (the currently-selected thread). The level-1 and level-2 rows don't carry `.active` — they're expand/collapse controls, not selection targets. Avoids conflating "expanded" with "active".

#### 3d. Imports

Add to the component's `imports` array:
- `FormsModule` (for `[(ngModel)]`)
- `InputTextModule` from `primeng/inputtext` (for `pInputText`)
- `LucideAngularModule.pick({ Search, ListFilter, MessagesSquare, Store, Folder, ChevronDown, ChevronRight })`

#### 3e. Minimal local styles

```css
.bp-inbox-v2-thread-pane {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}
.bp-inbox-v2-empty {
  color: var(--color-text-secondary);
  font-size: 14px;
}
```

Nothing else local — all chrome is global.

### 4. Schematic bump

Update `client-angular/src/app/features/messages/inbox-v2.schematic.yaml`:
- `built_so_far` → add `search-row`, `tree-rail-shell`
- `next_to_code` → remove `tree-rail`; next is `filter-drawer` and then data loading.

## Acceptance criteria

1. Navigate to `/inbox-v2`:
   - Hero renders with title "Inbox", subtitle "Project conversations.", **left-aligned** (heroAlign now works from route data)
   - Below hero: search row visible with placeholder "Search threads, suppliers, items..." and filter button on the right (no badge — `activeFilterCount()` returns 0 and the template doesn't render a count yet)
   - Below search: two-column body. Left column = sidebar with eyebrow "Supplier conversations" + `messages-square` icon, empty rail below. Right column = "Select a thread to view." centred placeholder.
2. Type in the search box — value binds (verify by setting a breakpoint or `console.log` in onSearchChange) — no visual change, no errors.
3. Click filter button — toggles `filterOpen` boolean (no drawer opens yet — that's a future prompt).
4. No console errors, no template warnings.
5. Hero alignment now respects `route.data.heroAlign` for routes that set it; the existing page-settings override still works (test by changing the saved page-setting for any other page with heroAlign and confirm it overrides).
6. The shared component remains mountable elsewhere: `<app-messages-inbox-v2 [showSearchRow]="false" [showTreeRail]="false"/>` shows just the empty padded wrapper.
7. `<app-messages-inbox-v2 [showItemPreview]="false"/>` compiles (input declared, not visually consumed yet — fine).

## Out of scope (do NOT add)

- Any data loading (HTTP / service calls / project tree population)
- Search filter logic (the input updates state but doesn't filter anything)
- Filter drawer body (the button toggles `filterOpen` but no `<p-sidebar>` opens)
- Thread pane contents (item-preview-card, message-list, compose-bar)
- Thread selection behaviour beyond setting `selectedItemId` + emitting `threadSelected`

## Reference

- Living spec: `client-angular/src/app/features/messages/inbox-v2.schematic.yaml`
- Marketplace sidebar reference: `client-angular/src/app/shared/components/catalogue-grid/catalogue-grid.component.ts` (lines ~200-250)
- Shared CSS: `client-angular/src/styles.css` (`.bp-cat-body`, `.bp-cat-sidebar`, `.bp-cat-rail`)
- V1 reference for search/filter behaviour (later): `client-angular/src/app/shared/components/messages-inbox/messages-inbox.component.ts`

## After this lands

- `/inbox-v2` shows complete chrome — search + empty rail + empty thread pane placeholder
- Hero is left-aligned via route data
- Update schematic `built_so_far` to `[hero, search-row, tree-rail-shell]`
- Next prompt: filter drawer with the 5 dropdowns (Client / Project / Category / Contact / Status)
