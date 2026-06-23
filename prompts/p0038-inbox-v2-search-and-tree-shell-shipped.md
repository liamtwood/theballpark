# Shipped — p0038 — inbox-v2 search row + tree-rail shell (empty structure)

**Version:** v1.69f
**Shipped:** see commit log
**Prompt:** `p0038-inbox-v2-search-and-tree-shell-prompt.md`

## What changed
- **`shared/components/messages-inbox-v2/messages-inbox-v2.component.ts`** — added the search row + three-column body shell + empty 3-deep tree rail (project → supplier → item-thread) using the marketplace's global `.bp-cat-*` rail classes. Right pane = centred "Select a thread to view." placeholder. No data loaded (`projectTree = []` → rail renders zero rows).
  - New input: `@Input() showItemPreview = true` (declared for the item-preview layer, not consumed yet).
  - New exported stub types: `ItemThreadNode`, `SupplierNode`, `ProjectNode`.
  - State: `searchTerm`, `filterOpen`, `projectTree`, `expandedProjectIds`, `expandedSupplierIds`, `selectedItemId`.
  - Stub handlers: `onSearchChange()` (no-op), `toggleProject()`, `toggleSupplier()`, `selectItem()` (sets `selectedItemId` + emits `threadSelected`), `activeFilterCount() → 0`.
  - Imports: `FormsModule`, `InputTextModule`, `LucideAngularModule`.
  - Local styles only: `.bp-inbox-v2-thread-pane`, `.bp-inbox-v2-empty`.
- **`styles.css`** — added `.bp-cat-rail-sub-sub` (third-level rail row, +12px indent vs `.bp-cat-rail-sub`), next to the existing rail rules.
- **`app-shell.component.ts`** — wired route-data `heroAlign`: new `routeHeroAlign` field, read in `updateFromRoute()`, slotted into `effectiveHeroAlign` **after** the page-setting (so a saved page-setting still wins) and before the global default.
- **`core/icons.ts`** — registered `MessagesSquare` (import + `ICON_REGISTRY`) so `name="messages-square"` resolves.
- **`inbox-v2.schematic.yaml`** — `built_so_far: [hero, search-row, tree-rail-shell]`; `next_to_code: [filter-drawer]`.
- **`environment.ts`** — chip `[Dev] v1.69f`.

## Deviation from spec (raised, not silent)
- **Lucide imports:** the prompt's `LucideAngularModule.pick({ Search, ... })` returns a `ModuleWithProviders`, which Angular **rejects in a standalone component's `imports` array** (TS-992012 / TS2322 — build fails). The codebase's established standalone pattern is the **bare `LucideAngularModule`** with names resolving from the global `ICON_REGISTRY` (action-tile, home-launcher, messages-inbox v1 all do this). Used the bare module and registered the one missing icon (`MessagesSquare`) globally — same end result (those six icons render), compiles cleanly. No other deviation.

## Diff
Net: **+~140 / -~5** — dominated by the v2 component template (search row + 3-deep rail) and the local types; one new CSS class, a 3-line app-shell wiring, one icon registration.

## Verify (per prompt spec)
- ✓ 1. `/inbox-v2`: hero "Inbox" / "Project conversations." **left-aligned** (`bp-hero--left`); search row with placeholder "Search threads, suppliers, items..." + filter button (badge hidden, count 0); two-column body — sidebar (eyebrow "Project conversations" + `messages-square` icon, empty rail 0 rows) | right pane "Select a thread to view."
- ✓ 2. Typing in search binds (`searchTerm` = "tent hire" after input); no visual change, no errors.
- ✓ 3. Filter button toggles `filterOpen` false→true; **no drawer opens** (none in DOM).
- ✓ 4. No console errors, clean `ng build`.
- ✓ 5. Route-data `heroAlign` respected; saved page-setting still overrides (set `/inbox-v2` page-setting `center` → hero centred; clear it → route-data `left` returns).
- ✓ 6. `[showSearchRow]="false" [showTreeRail]="false"` → search + sidebar gone, only the empty padded `.bp-inbox-v2` wrapper remains (verified via forced CD — component is OnPush, no injected cdr).
- ✓ 7. `showItemPreview` input declared (boolean), compiles; not visually consumed yet.

## Notes for next prompt
- The component is OnPush with no injected `ChangeDetectorRef` — fine while inputs drive everything via bindings, but the data prompt that mutates `projectTree` async (HTTP) will need a `ChangeDetectorRef` (or signals/async pipe) to render results.

p0038 flipped to `Done` in `prompts/backlog.md`; schematic `built_so_far: [hero, search-row, tree-rail-shell]`. Hard-refresh — chip reads `[Dev] v1.69f`.
