# pV2-06 — Marketplace arc plan (CC investigation, 2026-06-12)

Status: PLAN — input for chat's pV2-06x prompt drafting. Not a prompt.
Sources: v1 code read (all four surfaces + cart) + live walkthrough on :4200
(/shop, /suppliers/:id Storefront+Store, /projects/:id/marketplace) with Liam.

## The v1 surface inventory (~12,000 lines in scope)

| Piece | Lines | Role |
|---|---|---|
| supplier-list (/shop) | 753 | Global marketplace: Items/Suppliers modes |
| catalogue-grid | 3,955 | THE monolith — search, category strip, 4-group filter sidebar, card grid, right detail panel, ⋯ menus, favourites, cart actions, inline project/category brief+budget+status edits; serves 3 contexts via panelContext |
| item-drawer | 2,210 | Item view/edit drawer |
| cart-drawer | 3,307 | Project Items cart (shell-mounted, service-opened) |
| supplier-detail (/suppliers/:id) | 1,641 | Storefront tab (brand panel, category chips w/ counts, contact card) + Store tab (grid scoped to supplier) |
| project marketplace tab | 585 | Grid in project scope + cart wiring + Recommend + quick actions |
| category-context-panel | 923 | Build-tab category briefs (projects arc, NOT marketplace) |
| image-upload-panel | 724 | Item/supplier/category images (deferred) |
| satellites (category-circles, project-picker) | 333 | Already extracted |

Server: items.js / categories.js / favourites.js / suppliers reads are
reusable DATA but v1's /api is ungated — v2 needs gated (cookie +
membership) + Zod read endpoints, same pattern as config/organisation.

## v2 architecture — one engine, three scopes, one cart

```
CatalogueScope = marketplace | supplier-store(supplierId) | project(projectId)

MarketplaceStore(scope)        signal store, route-scoped; search / category /
                               filters / selection mirrored into query params
        │
   ┌────┴──────────────────────────────────────────────┐
   │  THE ENGINE (scope-agnostic, read-only)            │
   │  catalogue-search · category-strip · filter-rail   │
   │  catalogue-grid (pure) · item-card / supplier-card │
   │  detail-panel · item-drawer (view)                 │
   └────────────────────────────────────────────────────┘
        consumed by three thin route shells:
        /marketplace            (agent global; Items|Suppliers tab band)
        /suppliers/:id          (Storefront | Store tab band)
        /projects/:id/marketplace (project tab band; cart mode on)
```

Design rules that undo the monolith:
1. **The engine stays read-only.** v1 routed ~12 project-specific outputs
   (briefs, budget, status, estimate, scope toggles) through the grid. In
   v2 those belong to the PROJECT SHELL around the engine (sidebar slots /
   context components). The grid never knows what a brief is.
2. **Cart = §9 drawer + CartStore.** Two lists (SELECTED / WISHLIST from
   project_items.selection_type) + totals (per-attendee units cover/head ×
   guest_count) + promote/remove. Card +/♡ badges and the grid-header cart
   icon subscribe to the same store.
3. **Every component under the ledger caps** (component warn 250 / alarm
   400). catalogue-grid is 10× over — decompose, don't port.

## Locked rulings (Liam)

- **ONE cart per project — no per-category carts** (2026-06-12). v1's
  CartDrawerService category-context scoping (drawer title + filtered list
  per category) is RETIRED. Category narrowing happens in the grid;
  the cart drawer always shows the whole project's selected + wishlist.
- Agent /marketplace is read-only browse. Item EDITING + image uploads
  belong to the supplier My Shop arc (= the supplier-store scope with an
  edit flag — same engine, one flag, two roadmap items in one build).

## New shared primitive required first

**Hero tab-band** (with optional per-tab badge): three confirmed consumers
— global Items|Suppliers, supplier Storefront|Store, project tab band
(Inbox unread badge). Small prompt BEFORE 06c, same way page-hero preceded
the pages.

## Prompt arc (dependency-ordered)

| # | Prompt | Depends on |
|---|---|---|
| 06a | Browse engine + global /marketplace: gated reads (items/suppliers/categories + counts), MarketplaceStore, page shell, search, category strip, grid + cards | — |
| 06b | Item drawer (view) + favourites (gated endpoint, ⋯ menu skeleton) | 06a |
| 06c-pre | Hero tab-band primitive (+ badge) | — |
| 06c | Supplier detail: Storefront + Store tabs on the scoped engine | 06a, 06c-pre |
| 06d | Filter rail: 4 dimension groups (price / category attrs / supplier / event) + live counts | 06a |
| — | *Projects arc (separate): project CRUD, project_categories, project_items, estimate endpoints* | — |
| 06e | Project marketplace tab: project scope (category rail from project_categories), add/remove, card +/♡ | projects arc, 06c-pre |
| 06f | Cart drawer: CartStore, selected/wishlist, totals (unit rules), promote/remove — ONE per project | 06e |

Deferred OUT of the arc: image-upload panels, category admin,
Recommend (AI endpoint port), outreach hooks, category-context-panel
(projects/Build arc), item editing (My Shop arc).

## Open questions for chat before drafting

1. **project_items.selection_type contract** — keep v1's
   'selected'/'liked' as-is, or normalise wishlist? Cart drawer, card
   badges, and estimate all hang off it; lock before 06e/06f.
2. Filter/attribute data model — the category-specific dimension filters
   are the gnarliest data piece; worth a server-side schema look before
   06d freezes.
3. Pagination/server-side counts — v1 loads all 144 items client-side;
   fine at this scale, decide where the cut-over is.
4. Hub-depth watch item (pV2-05) may interact with where /marketplace
   lands for suppliers.
