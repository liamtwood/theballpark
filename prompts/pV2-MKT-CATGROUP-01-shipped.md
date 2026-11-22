# pV2-MKT-CATGROUP-01 — Group the marketplace + storefront by top-level category

**Shipped:** 2026-11-22 (rebuild/org-slice) — Liam QC'd on dev2, approved.
**Commit:** `<sha on push>` (server + client + migration 0068)

## What shipped
The marketplace browse, the supplier storefront, My Shop, and the marketplace
**suppliers** view now group their cards into **top-level category sections** (the
category's own icon + name, a count, ordered by the category's `sort_order`).

- **Items** (marketplace browse / storefront / My Shop): grouped by each item's
  top-level category. Items classify at any depth (a Lighting item sits under AV),
  so the section is the **root** of that chain.
- **Suppliers** (marketplace suppliers view): each supplier appears **once**, under
  its **primary** top-level category — the one it stocks most items in (ties → lower
  `sort_order`). No duplication across categories.

## Server
- **`0068_category_top_fn.sql`** (new) — `category_top(uuid)`: a recursive walk UP
  from any category to its root, returning `(id, name, icon_name, sort_order)`.
- **`marketplace.js`** (`/items`) — `LEFT JOIN LATERAL category_top(i.category_id)`
  adds `top_category_id/name/icon/sort` to each item row + projection
  (`topCategoryId`, `topCategoryName`, `topCategoryIcon`, `topCategorySort`).
- **`marketplace-suppliers.js`** (`/suppliers`) — a correlated subquery returns each
  supplier's **derived** top-level categories (DISTINCT, each with its item count),
  ordered **primary-first** (count DESC), as `topCategories[]`.

## Client
- **`catalogue.types.ts`** — `CatalogueItem.topCategory{Id,Name,Icon,Sort}`,
  `CatalogueSupplier.topCategories[]`.
- **`catalogue-grid.component.ts`** — a `[groupByTopCategory]` input + a `sections`
  computed; the card view renders one section per top-level category (header when
  grouping), sorted by `sort_order`. One card loop, no duplication.
- **`supplier-grid.component.ts`** — same pattern, but each supplier goes into its
  **primary** category section only (`topCategories[0]`).
- Enabled on marketplace browse (items + suppliers), storefront, and My Shop; left
  OFF on the constrained project-marketplace dialog.
- **`app.config.ts`** — registered `CircleDashed` (Prop Hire's icon) — lucide's
  `pick()` is curated, and an unregistered category icon throws at render.

## Supplier categorisation decision
Suppliers have no category field; a supplier's categories are **derived** from its
items' top-level categories (Liam's call — zero upkeep, always truthful). The
suppliers view uses the **primary** (most-items) one so each supplier shows once.

## Verification
- `category_top` verified: lighting → AV (sort 3), armchairs → Furniture (5),
  florals → Floristry (8). Yahire → Furniture (220) / Catering (165) / Prop Hire (36)
  → primary Furniture. Backend healthy after each edit; client compiles clean.

## Notes
- Grouping is ON unconditionally on the enabled surfaces (shows the category header
  even when one category) — can be gated to "no category selected" later if wanted.
- Category icons must be in the registered lucide `pick()` set; a new category icon
  needs registering (or it throws). A safe-icon fallback is a possible follow-up.
