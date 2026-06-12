# Marketplace (`/marketplace`)

One-pager. Customer-facing browse + quote-building surface. For deeper
detail see the pV2-06 ship reports + audit ledger.

## What it is

The customer-facing browse: agents land here, navigate category → supplier
→ item, build up a Project Quote (running list + estimated total), then
checkout to a separate quote-finalize page that contacts suppliers.

## Why we needed it

The marketplace is the product's value loop — it's how agents find
suppliers and assemble project quotes without the legacy email-thread
chaos. v1 had a working version, but as ~8,300 lines across a 3,955-line
catalogue-grid monolith. v2 decomposes it into single-responsibility
pieces sitting on the locked TYPE-01 + edit-form + role-class
foundations.

## Who can use it

| Role | `/marketplace` | Add to Quote | Checkout |
|---|---|---|---|
| `agency_admin` | ✓ browse | ✓ | ✓ |
| `agency_member` | ✓ browse | ✓ | ✓ |
| `supplier_admin` | ✓ browse (their listings + competitive view) | — | — |
| `supplier_member` | ✓ browse | — | — |
| `ballpark_admin` | ✓ browse + curate (categories live in `/settings/categories`) | — | — |

Item / supplier EDITING lives elsewhere — supplier-side at `/store` (the
catalogue arc); category management at `/settings/categories`
(ballpark-admin only).

## Layout — five regions

```
[ <app-page-hero> "Marketplace" / subtitle ]
[ search bar + filter chips ]
[ left rail: cat list w/ counts ] [ middle: items — card / list / table (toggle) ] [ right rail: polymorphic ]
```

**Right rail is polymorphic, keyed by left-rail selection + middle click:**

| Selection state | Right rail shows |
|---|---|
| "All Categories" (default) | **Project Quote** — running total (£) + supplier count + added items (with Remove) + "See Final Project Quote" CTA. *Quote lands pV2-06e; until then the default is a quiet empty-state hint.* |
| A specific category selected | **Category summary** — cat description + list of suppliers in that category |
| An item card clicked | **Item preview** — image + supplier + price + description + "Add to Quote" button (or "Added to Quote" muted state) |

**No drawer in v2.** The right rail IS the preview surface for ALL THREE
modes — item preview, category summary, AND the Project Quote (cart).
v1's `cart-drawer` becomes the default right-rail state in v2 — same
content, different surface. Drawers reserved for `<app-edit-section>`
write flows elsewhere (Profile, settings).

## v1 → v2 mapping

The decomposition. v1 file → how it contributes to v2.

| v1 file | Lines | v2 treatment |
|---|---|---|
| `features/suppliers/supplier-list/supplier-list.component.ts` (the `/shop` orchestrator) | 753 | **Port pattern, simpler shape.** Becomes `marketplace-page.component.ts` — route shell that mounts the five regions. No per-cat cart, no item editing — both deleted. Target ≤200 lines. |
| `shared/components/catalogue-grid/catalogue-grid.component.ts` (the monolith) | 3,955 | **Decompose, don't port.** Split into: `<app-catalogue-search>` (search box), `<app-category-strip>` (left rail), `<app-filter-rail>` (filter chips), `<app-catalogue-grid>` (pure grid, ≤200 lines), `<app-item-card>`, `<app-supplier-card>`. Cart-by-cat plumbing deleted. |
| `shared/components/item-drawer/item-drawer.component.ts` | 2,210 | **Deprecated.** No drawer in v2 marketplace. Item view goes to the right-rail item-preview pane. Item edit lives in `/store` (supplier arc, future). |
| `shared/components/category-context-panel/category-context-panel.component.ts` | 923 | **Deferred.** Belongs to the Projects / Build arc (per-cat brief editing in project context), not marketplace. Will land when Projects arc starts. |
| `shared/components/image-upload-panel/image-upload-panel.component.ts` | 724 | **Deferred.** Admin-ish; lives in `/store` (supplier item editing) and `/settings/categories` (cat images). Not in marketplace arc. |
| `shared/components/category-circles/category-circles.component.ts` | 333 | **Port directly.** Already extracted satellite; becomes `<app-category-strip>` with counts. |
| `shared/components/marketplace-project-picker/marketplace-project-picker.component.ts` | — | **Port simplified.** Keep as `<app-active-project-chip>` — sets the active project context (one quote per project). No per-cat scope. |
| `core/services/category.service.ts` | — | **Port + gate + Zod.** Server reads currently ungated in v1; v2 needs `requireActiveMembership()` + Zod schemas. |
| `core/services/supplier.service.ts` | — | **Port + gate + Zod.** Same treatment. |
| `core/services/item.service.ts` | — | **Port + gate + Zod.** Same treatment. |
| `core/services/cart-drawer.service.ts` | — | **Replaced by `QuoteService`.** Cart-per-cat → single Quote per project; simpler shape. New endpoints: `GET /api/quotes/:projectId`, `POST /api/quotes/:projectId/items`, `DELETE /api/quotes/:projectId/items/:itemId`. |
| `core/services/marketplace-project.service.ts` | — | **Simplified.** Becomes `MarketplaceStore` (route-scoped signal store) — view state + selection + search + filters + active project, mirrored into query params for shareable URLs. |
| `server/src/routes/items.js` + `categories.js` + `favourites.js` + `suppliers.js` | — | **Port + gate + Zod read endpoints.** Same pattern as `/api/config` and `/api/organisations`. |

**v2 NEW or relocated (the architectural shifts):**

- `MarketplaceStore` — route-scoped signal store; URL is state (`?cat=florals&view=cards&item=…`). No direct v1 equivalent.
- `<app-right-rail>` — polymorphic panel (QuoteView / CategorySummaryView / ItemPreviewView). v1's `cart-drawer` content moves here as the default Quote state; item-drawer content moves here as the item-preview state; cat-context content (partial) moves here as the cat-summary state. **Surface change, not net-new** — same data, different chrome.
- `<app-quote-line>` — single row in the Quote view (image + name + £ + Remove). v1's cart-drawer line item with the per-cat header removed.
- `.bp-btn-grad--added` (or disabled variant) — the muted state for "Added to Quote". v2 addition; v1 didn't have a per-item "added" affordance on the cards.
- `/quote-checkout/:projectId` — separate finalize page. v1 had inline checkout; v2 splits it out for cleaner navigation. Separate prompt arc.

## What's deferred from this arc

- **Item editing** — supplier-side, /store arc, future
- **Category management UI** — ballpark-admin, /settings/categories, separate prompt (pV2-MARKET-00a or similar)
- **Image upload panels** — both for items + categories, deferred to whoever owns the writing context
- **Category-context-panel** (per-cat brief editing in project context) — Projects/Build arc
- **Favourites endpoint** — pV2-06b
- **Filter dimension model** — the gnarliest data piece; worth a server-side look before pV2-06c is drafted

Resolved (2026-06-12, Liam + CC): server-side filtering at the DB, with
EVERY list query paginated from day one — page size 24, "Show more"
appends, All stays the default landing. Selection never fetches (rail
preview hydrates from the loaded list); list fetches go through one
cached service choke point. Detail in pV2-06-angular-architecture.md.

## Prompt arc

CC locked this plan at commit `90ffa3b` (2026-06-12). Panel modes ship as
their own prompts; skipping v1's item-drawer (2,210 lines) + cart-drawer
(3,307 lines) cuts ~5,500 lines from the arc scope.

| Prompt | Scope |
|---|---|
| **pV2-MARKET-00** | Categories backend + minimal ballpark-admin UI (`/settings/categories`) |
| **pV2-06a** | **Browse foundation** — gated server reads, MarketplaceStore, page shell with hero, search, category strip, middle card/list/table view toggle. Right-rail empty/default until panel modes land. |
| **pV2-06b** | **Right-rail item mode** — panel renders item preview when an item is clicked (image, supplier, price, description). No "Add to Quote" CTA yet (that's 06f). |
| **pV2-06c** | Filter rail — dimension groups + live counts |
| **pV2-06d** | Suppliers mode + supplier detail — supplier cards, `/suppliers/:id` route, favourites |
| **pV2-06e** | **Right-rail category mode** — panel renders cat summary + that category's supplier list when a category is selected (v1's `category-context-panel` port, simplified). |
| **pV2-06f** | **Right-rail cart mode + checkout page** — panel renders Quote list (default state when "All" selected) with Remove buttons, "Checkout" CTA → new `/projects/:id/checkout` page. `QuoteService`, "Add to Quote" / "Added to Quote" CTA states. End of marketplace arc; checkout page itself is a separate prompt. |

## Audit reference

See `docs/AUDIT_LEDGER.md` for the per-file audit state. Marketplace
components will land here as the pV2-06 prompts ship.

## Version history

| Version | Date | What changed | Ship | Re-audit |
|---|---|---|---|---|
| — | — | (Empty; pV2-MARKET-00 / pV2-06a have not landed yet) | — | — |

## When to update this doc

- New region or right-rail state added → update Layout
- v1 file's treatment changes (e.g. something we said "deferred" gets pulled in) → update mapping
- A pV2-06 prompt ships → bump Version History + add audit pointer
- Permission gate changes → update Who can use it
