# pV2-06 — Marketplace: Angular architecture plan

Status: ARCHITECTURE — the technical companion to `docs/MARKETPLACE.md`
(product canon; if the two disagree, MARKETPLACE.md wins). Input for
chat's prompt drafting + CC implementation. Angular 21 / zoneless /
signals idioms throughout (the locked v2 standards).

## 1. Routes

```
/marketplace                      MarketplacePageComponent  (06a)
/suppliers/:id                    SupplierDetailComponent   (06d)
/quote-checkout/:projectId        QuoteCheckoutComponent    (post-06f prompt)
```

All inside the authenticated shell (requiresOrgGuard). `/marketplace`
replaces today's coming-soon stub; the launcher registry already targets
it for agents + the supplier Storefront hub.

## 2. Folder layout

```
client-v2/src/app/
  pages/marketplace/
    marketplace-page.component.ts      route shell (≤200)
    marketplace-store.ts               route-scoped signal store
    rail/
      right-rail.component.ts          polymorphic host (≤120)
      item-preview.component.ts        (06b)
      category-summary.component.ts    (06e)
      quote-view.component.ts          (06f)
      quote-line.component.ts          (06f)
  pages/suppliers/
    supplier-detail.component.ts       (06d)
  shared/catalogue/                    THE ENGINE — scope-agnostic, reusable
    catalogue-search.component.ts
    category-strip.component.ts
    filter-rail.component.ts           (06c)
    catalogue-grid.component.ts        pure presentation (≤200)
    item-card.component.ts
    supplier-card.component.ts
    catalogue.types.ts
  core/marketplace/
    catalogue.service.ts               HTTP reads (items/suppliers/categories)
    quote.service.ts                   (06f)
```

Engine pieces live in `shared/catalogue/` because supplier-detail (06d)
and the future project-marketplace + `/store` arcs mount the same parts.

## 3. Data layer

**Types** (`catalogue.types.ts`): `CategoryInfo { id, name, count, iconName?, coverUrl? }`,
`CatalogueItem { id, name, supplierId, supplierName, categoryId,
subcategoryId?, basePrice, unit, coverUrl?, description }`,
`CatalogueSupplier { id, name, city, logoUrl?, coverUrl?, categoryIds,
itemCount }`, `RailMode = 'empty' | 'category' | 'item' | 'quote'`.

**Server** (one new gated router, e.g. `server/src/routes/marketplace.js`
mounted on the v2 cookie path):

```
GET /api/marketplace/categories            → CategoryInfo[] (with counts)
GET /api/marketplace/items?cat&sub&q       → CatalogueItem[]
GET /api/marketplace/suppliers?cat&q       → CatalogueSupplier[]
GET /api/marketplace/suppliers/:id         → supplier + categories + items
```

`requireActiveMembership()` (any role per the MARKETPLACE.md access
table), Zod-validated query params (strip), camelCase mapping at the
edge — the organisation.js pattern. Reads are org-agnostic catalogue
data; **no org_id from the client, ever** — visibility rules (own-org
items for suppliers) derive from `req.user`. Filtering happens
server-side from day one (it's a WHERE clause now and spares the
pagination cut-over later); counts come from the categories endpoint.

**Client service** (`catalogue.service.ts`): thin `ApiService` wrappers
returning Observables consumed via `resource()` in the store — same
fetch-into-state standard as Profile/Team. No raw `.subscribe`.

## 4. MarketplaceStore — URL is state

Route-scoped (provided in the route's `providers`, NOT root — two
marketplace contexts must not share state). Pattern:

```ts
// Selection state lives in the URL (shareable, Back works):
//   /marketplace?cat=florals&sub=…&q=lights&view=table&item=<id>
private readonly query = toSignal(this.route.queryParamMap);
readonly categoryId = computed(() => this.query().get('cat'));
readonly search     = computed(() => this.query().get('q') ?? '');
readonly viewMode   = computed(() => asViewMode(this.query().get('view'))); // card|list|table
readonly itemId     = computed(() => this.query().get('item'));

// Writers navigate — they never set signals directly:
setCategory(id: string | null) { router.navigate([], { queryParams: { cat: id, item: null }, queryParamsHandling: 'merge' }); }

// Data: resources PARAMETERISED on the URL signals (auto-refetch on change)
readonly items = resource({
  params: () => ({ cat: this.categoryId(), q: this.search() }),
  loader: ({ params }) => firstValueFrom(catalogue.items(params)),
});

// Rail mode is DERIVED, never stored:
readonly railMode = computed<RailMode>(() =>
  this.itemId() ? 'item' : this.categoryId() ? 'category' : 'empty'); // 'quote' joins in 06f
```

Debounce search input in the component (signal + effect or a small
`debounced()` helper) before writing the query param. `mergeConfig`-style
pure helpers + the mode derivation get unit specs.

### Roundtrip budget & caching (Liam's "are we hammering the DB?" check)

Rule: **selection never fetches; only list changes fetch — through one
cached choke point.**

| Interaction | DB roundtrip? | Mechanism |
|---|---|---|
| Item click → rail preview | NO | Rail hydrates from the in-memory list by id. The items payload carries every field the preview shows (incl. description) precisely so this stays a pure signal flip. |
| View toggle (card/list/table) | NO | Presentation-only signal. |
| Category click | once per (params) per session | `CatalogueService` keeps a Map cache keyed by the query string; revisits are cache hits. `resource()` cancels stale in-flight requests. |
| Search | debounced, settled term only | Component debounces before writing the `q` param. |
| Categories rail + counts | once per page load | Slow-moving; one GROUP BY at mount + `Cache-Control`/ETag so refreshes can 304. |

Worst case = one small indexed query per category per session — same
order as the auth middleware's per-request membership query. If traffic
ever runs hot, the fix lands in ONE place (the service cache / HTTP
headers / server cache), zero component changes.

### Pagination — born paginated (Liam, 2026-06-12)

EVERY list query carries `LIMIT/OFFSET`, including the All landing —
the point of server-side filtering is that every payload is bounded,
not that All is avoided. Page size **48** (one `PAGE_SIZE` constant — generous enough that most
users never page; Liam 2026-06-12), familiar **"Show more"**
button appends the next page (no virtual/infinite scroll). All stays
the DEFAULT landing (discovery + the 06f Quote-rail home state). The
items endpoint returns `{ items, total }` so "Show more" can hide
itself when exhausted and the search count stays truthful. Retires the
"pagination cut-over threshold" open question — there is no cut-over.

## 5. Component contracts (all OnPush, host:-binding, input()/output())

| Component | Inputs | Outputs | Notes / budget |
|---|---|---|---|
| `marketplace-page` | — (injects store) | — | Mounts hero + regions; wires store to engine. ≤200 |
| `catalogue-search` | `value`, `count`, `placeholder` | `valueChange` | Dumb. ≤80 |
| `category-strip` | `categories`, `activeId` | `categorySelected` | Port of category-circles; counts baked. ≤150 |
| `filter-rail` (06c) | `groups`, `active` | `filterChange` | Collapsible groups. ≤250 |
| `catalogue-grid` | `entities`, `viewMode`, `selectedId` | `entitySelected` | PURE: `@switch` on viewMode → card grid / list / table. ≤200 |
| `item-card` / `supplier-card` | entity, `selected` | `clicked` | Tokens + `.bp-card-*` classes only. ≤120 each |
| `right-rail` | — (injects store) | — | `@switch (store.railMode())` → mode component. ≤120 |
| `item-preview` | `item` | — (06f adds quote CTA out) | ≤200 |
| `category-summary` | `category`, `suppliers` | `supplierSelected` | ≤150 |
| `quote-view` / `quote-line` (06f) | quote, line | `remove`, `checkout` | ≤200/≤80 |

Ledger caps respected by construction; anything trending past warn (250)
splits before ship.

## 6. Rendering + zoneless notes

- `@for (e of entities; track e.id)` everywhere; no index tracking.
- Images: `NgOptimizedImage` where dimensions are known; lazy loading on
  cards (144+ tiles). No virtual scroll in 06a — measure first; the v1
  page renders 144 fine. Revisit at real catalogue scale.
- New Lucide icons go in the ONE global pick (app.config).
- All chrome from tokens + the §5 type classes; status/price text via
  existing classes (`.bp-card-title/subtitle`, `.bp-meta`). Style guard
  stays green by never inlining values.
- Empty/loading/error states: resource `isLoading()/error()` per region —
  same pattern as Profile (loading line, warn line; Rule 5 logging in the
  service catch paths).

## 7. Quote layer (06f — shape only, so 06a doesn't paint into a corner)

`QuoteService` (root) + `QuoteStore` keyed by active project:
`GET/POST/DELETE /api/quotes/:projectId(/items/:itemId)` (gated:
agency roles only per the access table; project ownership proved
server-side). The rail's `quote` mode and the card "Add to Quote" CTA
both read the same store, so 06a's components need nothing today beyond
the `railMode` union including `'quote'` and item-preview leaving room
for a CTA slot.

## 8. Test plan

- Store: mode derivation, query-param round-trip helpers, view-mode
  parsing (pure fns — vitest).
- catalogue-grid/item-card: shallow render specs (entities in → cards
  out, selection event).
- Server: Zod schema specs + endpoint authz specs (same harness as
  organisation.schema.test.js).
- Visual QC path per prompt listed in its shipped file (Liam's pass).

## 9. Open items inherited from MARKETPLACE.md

Filter dimension model (pre-06c server look), checkout page definition
(post-06f prompt), pagination cut-over threshold, supplier
"competitive view" semantics for supplier-role browsing.
