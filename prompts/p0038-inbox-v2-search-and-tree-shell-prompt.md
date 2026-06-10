# p0038 — inbox-v2 search row + tree-rail shell (empty structure)

## Goal

Add the next chrome layers to `<app-messages-inbox-v2>`: the search row,
the three-column body shell, and the empty 3-deep tree rail using the
marketplace's existing global classes. **No data is loaded** — the rail
renders zero rows; the right pane shows an empty-state placeholder.

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

### 1. One CSS class added to `styles.css` — the 3rd-level row

Marketplace's rail is 2 deep (cat → subcat). Inbox-v2 is 3 deep (project → supplier → item-thread). Add ONE new class for the third level, alongside the existing rail classes:

```css
/* v1.69x (p0038) — third-level rail row, sits under .bp-cat-rail-sub.
   Used by inbox-v2 to show item-thread rows nested under suppliers. */
.bp-cat-rail-sub-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 36px;  /* +12px indent vs .bp-cat-rail-sub */
  font-size: 12px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  border-radius: var(--radius-button);
  transition: background 0.1s;
}
.bp-cat-rail-sub-sub:hover { background: var(--color-fill); }
.bp-cat-rail-sub-sub.active { background: var(--theme-soft); color: var(--theme-accent); font-weight: 600; }
```

Match the visual rhythm of `.bp-cat-rail-sub` — sit it next to that rule in styles.css.

### 2. heroAlign wiring in app-shell

In `app-shell.component.ts` `updateFromRoute()`, alongside the existing `heroTitle` / `heroSub` reads, also read `heroAlign` from route data and apply it. Today the value only takes effect via page-settings; this lets route-data set the default.

The existing block (around line 846-847) reads:
```typescript
this.routeHeroTitle = data['heroTitle'] || '';
this.routeHeroSub   = data['heroSub']   || '';
```

Add a sibling line that sets the per-route hero-align default. Wire it through the same channel `ConfigService.heroAlign` uses, so the page-setting override still wins. Implementation choice is yours — what matters is: `data: { heroAlign: 'left' }` produces left-aligned hero in absence of any saved page-setting, and a saved page-setting still overrides.

### 3. Component changes — `messages-inbox-v2.component.ts`

#### 3a. New input

```typescript
@Input() showItemPreview = true;
```

No template usage yet. It's declared so future prompts (item-preview-card layer) can read it without breaking the existing API.

#### 3b. State + types

Stub types (declare them, leave fields skeletal):
```typescript
export interface ItemThreadNode {
  itemId: string;
  itemName: string;
  latestSnippet: string;
  timestamp: string;   // pre-formatted relative string for now
  unreadCount: number;
}
export interface SupplierNode {
  supplierId: string;
  supplierName: string;
  threadCount: number;
  itemThreads: ItemThreadNode[];
}
export interface ProjectNode {
  projectId: string;
  projectName: string;
  threadCount: number;
  suppliers: SupplierNode[];
}
```

Component state:
```typescript
searchTerm = '';
filterOpen = false;             // stays false — filter drawer comes later
projectTree: ProjectNode[] = []; // empty for now
expandedProjectIds = new Set<string>();
expandedSupplierIds = new Set<string>();
selectedItemId: string | null = null;
```

Stub handlers (template hooks, no logic):
```typescript
onSearchChange(): void { /* debounced filter — comes with data prompt */ }
toggleProject(id: string): void {
  this.expandedProjectIds.has(id)
    ? this.expandedProjectIds.delete(id)
    : this.expandedProjectIds.add(id);
}
toggleSupplier(id: string): void {
  this.expandedSupplierIds.has(id)
    ? this.expandedSupplierIds.delete(id)
    : this.expandedSupplierIds.add(id);
}
selectItem(id: string): void {
  this.selectedItemId = id;
  this.threadSelected.emit(id);
}
activeFilterCount(): number { return 0; }  // stub — filter drawer comes later
```

#### 3c. Template

Top to bottom:

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
      <span class="bp-search-filter-count" *ngIf="activeFilterCount()">{{ activeFilterCount() }}</span>
    </button>
  </div>

  <!-- Three-column body shell -->
  <div class="bp-cat-body bp-cat-body--cats-left">

    <!-- LEFT: tree rail (gated) -->
    <div class="bp-cat-sidebar" *ngIf="showTreeRail">
      <div class="bp-cat-sidebar-head">
        <lucide-icon name="messages-square" [size]="13" class="bp-cat-sidebar-head-icon"></lucide-icon>
        <div class="bp-filter-title">Project conversations</div>
      </div>
      <div class="bp-cat-sidebar-body">
        <div class="bp-cat-rail">
          <!-- Empty state: rail renders nothing while projectTree is empty -->
          <ng-container *ngFor="let project of projectTree">
            <button type="button" class="bp-cat-rail-item"
                    [class.active]="expandedProjectIds.has(project.projectId)"
                    (click)="toggleProject(project.projectId)">
              <span class="bp-cat-rail-icon">
                <lucide-icon name="folder" [size]="16" [strokeWidth]="1.5"></lucide-icon>
              </span>
              <span class="bp-cat-rail-text">
                <span class="bp-cat-rail-name">{{ project.projectName }}</span>
                <span class="bp-cat-rail-count" *ngIf="project.threadCount">{{ project.threadCount }}</span>
              </span>
              <lucide-icon [name]="expandedProjectIds.has(project.projectId) ? 'chevron-down' : 'chevron-right'"
                           [size]="15" class="bp-cat-rail-chev"></lucide-icon>
            </button>

            <div class="bp-cat-rail-subs" *ngIf="expandedProjectIds.has(project.projectId)">
              <ng-container *ngFor="let supplier of project.suppliers">
                <button type="button" class="bp-cat-rail-sub"
                        (click)="toggleSupplier(supplier.supplierId)">
                  {{ supplier.supplierName }}
                  <span *ngIf="supplier.threadCount">({{ supplier.threadCount }})</span>
                </button>

                <ng-container *ngIf="expandedSupplierIds.has(supplier.supplierId)">
                  <button type="button" class="bp-cat-rail-sub-sub"
                          *ngFor="let thread of supplier.itemThreads"
                          [class.active]="selectedItemId === thread.itemId"
                          (click)="selectItem(thread.itemId)">
                    {{ thread.itemName }}
                  </button>
                </ng-container>
              </ng-container>
            </div>
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

#### 3d. Imports

Add to the component's `imports` array:
- `FormsModule` (for `[(ngModel)]`)
- `InputTextModule` from `primeng/inputtext` (for `pInputText`)
- `LucideAngularModule.pick({ Search, ListFilter, MessagesSquare, Folder, ChevronDown, ChevronRight })`

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
   - Below hero: search row visible with placeholder "Search threads, suppliers, items..." and filter button on the right (badge hidden — `activeFilterCount()` returns 0)
   - Below search: two-column body. Left column = sidebar with eyebrow "Project conversations" + `messages-square` icon, empty rail below. Right column = "Select a thread to view." centred placeholder.
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
