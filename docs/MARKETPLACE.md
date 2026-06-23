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

**`/marketplace` is the same for every role.** Same data, same view, same
browse. Differentiation is per-item, not per-role.

| Role | `/marketplace` | Add to Quote | Checkout | Edit / delete own items |
|---|---|---|---|---|
| `agency_admin` | ✓ browse | ✓ | ✓ | — (no items) |
| `agency_member` | ✓ browse | ✓ | ✓ | — (no items) |
| `supplier_admin` | ✓ browse | — | — | ✓ on items owned by their org |
| `supplier_member` | ✓ browse | — | — | ✓ on items owned by their org |
| `ballpark_admin` | ✓ browse | — | — | ✓ on any item (cross-org) |

**Ownership-derived affordances** — edit / delete buttons render on
item cards + previews when `item.supplier_org_id === active_org_id` (or
the active user is `ballpark_admin`). No separate competitive-view
endpoint, no per-role filtering of the catalogue. The same items render
for everyone; the chrome differs by ownership.

Item / supplier EDITING flows lives at `/store` (supplier catalogue arc);
add-item lives there too. Category management at `/settings/categories`
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
EVERY list query paginated from day one — page size 48 (most users never page), "Show more"
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
| **pV2-06f** | **Right-rail cart mode + checkout page** — panel renders Quote list (default state when "All" selected) with Remove buttons, "Checkout" CTA → new `/quote-checkout/:projectId` page (flat route — focused flow, deliberately OUTSIDE the future projects tab shell; aligned 2026-06-12, was inconsistently `/projects/:id/checkout` here). `QuoteService`, "Add to Quote" / "Added to Quote" CTA states. End of marketplace arc; checkout page itself is a separate prompt. |

## Future product surfaces (deferred, with shapes sketched)

Recorded so the architectural shape is on the queue when these arcs land —
saves re-deriving from scratch.

### Supplier "hidden storefront" tier (paid feature)

**Customer signal (Liam, 2026-06-12 customer session):** suppliers may
prefer storefronts that hide competitors. Customer himself unsure. Liam's
ruling: "better for us if they compete — let 'em look. Maybe offer a
'hidden tier' at a cost."

**Architectural shape:**
- Default behaviour stays **B** (architecturally honest — same engine, same
  rendering, competitors visible on storefront)
- "Hidden mode" = supplier-org feature flag (`suppliers.show_competitors_on_store BOOLEAN DEFAULT true` or wherever org metadata lives). When false:
  - Storefront suppresses the suppliers list
  - Category summary card scopes its count to that supplier only
  - This is exactly the behaviour CC originally shipped — gets recycled as the paid feature, not the default
- **Variation is data-driven, not code-driven** — engine still renders identically; it just reads a flag and conditionally narrows scope. One Definition holds.

**Wires into billing arc when it lands:**
- `budget_tier` codelist already exists for agency-side; supplier-side equivalent (`supplier_subscription_tier` or similar) needs to land
- "Hidden visibility" becomes one entitlement in a tier-feature matrix
- Once 2-3 tier features exist (hidden / featured placement / extra items / custom styling / analytics), the tier-feature mapping itself likely wants to be a codelist or join table — not hardcoded

### Other deferred surfaces

- **pV2-06f — Quote + Checkout** — parked at the projects boundary. Right-rail Quote mode + "Add to Quote" / "Added to Quote" CTA states + `QuoteService` + new `/quote-checkout/:projectId` page. Lands when projects arc starts (needs project entity to anchor the quote against).
- **Storefront styling polish** — informal pass; not blocking
- **v1 favourites gating** — feature-parity check from closing audit
- **`/store` supplier-side catalogue management** — ownership-derived edit/delete affordances + add-item flow; future arc
- **Recommend / "you might also like"** — surfaces the marketplace can grow once item-level signal accrues

## Audit reference

See `docs/AUDIT_LEDGER.md` for the per-file audit state. Relevant rows:

- `client-v2/src/app/pages/settings/categories/categories-settings.component.ts` — 129 lines, audited 2026-06-12 (chat), SHA `b87508e`, `✓ clean` — TYPE-01 role classes used, edit-field primitive, optimistic save with rollback (Rule 5)
- `server/src/routes/marketplace.js` — 184 lines, audited 2026-06-12 (chat), SHA `26210f6` — properly gated (`requireActiveMembership('admin.cross_org_view')`), Zod-validated, ownership server-derived, parameterized queries
- `server/src/services/category.service.js` — 96 lines, `2a0457f`
- `server/src/schemas/category-admin.schema.js` — 18 lines, `d235576`

**Risk patterns surfaced during this arc** — full detail in `docs/AUDIT_LEDGER.md`:

- **RP-01 (cold-path latency)** — surfaced as slow-first-search; root cause was pg pool growing on demand (not non-indexed ILIKE). Closed at v2.14c by `min: 2` floor + boot warm-up pair. Learning logged: when first-request is slow with pg/Supabase, check pool growth before reaching for index hypotheses.
- **RP-03 (legacy v1 routes ungated)** — `routes/categories.js` exposed POST/PUT/PATCH/DELETE without any auth. Closed at v2.14c by deleting the 4 write verbs (GETs remain until pV2-11). Router fall-through now delivers 401. Same pattern likely affects other v1 routers; sweep candidate.
- **RP-05 (component-local `.bp-*` definitions)** — 8 marketplace classes violated the one-definition rule; closed at v2.14f. All moved to `styles.css §Marketplace utilities`. `check-style-guards.js` extended to fail builds on any new component-local `.bp-*` selector. Legacy BEM files (edit-field, home-launcher, launcher-tile, page-hero) on shrink-only allowlist.

## Version history

| Version | Date | What changed | Ship | QC | Audit |
|---|---|---|---|---|---|
| **v2.14a** | 2026-06-12 | **pV2-MARKET-00** — Categories backend + `/settings/categories` ballpark-admin curation table. v2 marketplace router (`/api/marketplace/*`) gated, Zod, ownership-derived. Subcategory curation deferred until pV2-06a. | `bb57393` | accepted | ✓ clean — RP-03 surfaced (closed v2.14c) |
| **v2.14b** | 2026-06-12 | **pV2-06a** — Browse foundation. Server `GET /api/marketplace/items` (born-paginated `{items, total, hasMore}`, PAGE_SIZE 48). `MarketplaceStore` (route-scoped, URL-is-state, `linkedSignal` for offset reset, railMode derived). Engine in `shared/catalogue/` — catalogue-search, category-strip, catalogue-grid (PURE; `@switch` card/list/table), item-card. `CatalogueService` session cache with concurrent-flight dedup + failed-flight eviction + mutation bust. | `b4ffc63` | accepted | ✓ clean — RP-05 surfaced (closed v2.14f) |
| **v2.14c** | 2026-06-12 | **RP-01 + RP-03 closures.** Pool `min: 2` + boot warm-up (slow-first-search fix). Ungated legacy category write verbs deleted. | `508612d` | search-cold verified instant; deletion verified 401 on writes | ✓ clean |
| **v2.14d** | 2026-06-12 | Marketplace hero driven by `/settings/pages` (hero only; v1's other marketplace settings deliberately ignored). | `fc2659a` | accepted | ✓ clean |
| **v2.14e** | 2026-06-12 | **pV2-06b** — Right-rail item preview becomes real. Image + name + price/unit + supplier + category + description + close. Pure preview over loaded row (zero `/items` fetches on selection verified). | `d10ec58` | accepted | ✓ clean — RP-05 grew here (closed v2.14f) |
| **v2.14f** | 2026-06-12 | **RP-05 closure** — 8 marketplace `.bp-*` declarations moved to `styles.css`; style guard extended to fail any component-local `.bp-*` definition; legacy BEM allowlist (shrink-only) for 4 pre-existing files. | `c11dfc3` | guard plant-fail-revert drilled | ✓ closed by prevention |
| **v2.14g** | 2026-06-12 | **pV2-06c** — Filter row (price / tier / supplier). Combined filters narrow server-side. | `89b27e1` | accepted — Rocket Food walk verified search × cat filter combine correctly (catering → 13 results all Rocket Food, venue → 0) | ✓ clean |
| **v2.15a** | 2026-06-12 | **pV2-06d** — Suppliers mode + `/suppliers/:id` supplier detail + favourites. Favourites persist across navigation (cache bust on write verified). | `81503bc` | two defects flagged (view toggle stuck on cards in suppliers mode; supplier-detail single-column instead of 3-rail) | superseded by v2.15b |
| **v2.15b** | 2026-06-12 | **pV2-06d QC fix** — Both defects addressed via proper extraction (not branch): new `<app-supplier-grid>` mirrors catalogue-grid's `@switch` for card/list/table; new `<app-catalogue-layout>` is the 3-region shell (ONE definition, `ng-content` slots); MarketplaceStore extended with `pinnedSupplierId()` scope so supplier-detail mounts the SAME store class via `:id` — ~70 lines of mini-store duplication deleted. | `5db73dc` | accepted ("just need subcat and styling next") | ✓ clean with two non-blocking flags: supplier-detail at 224/250 lines; `viewMode="card"` hardcoded on supplier-detail's grid |
| **v2.17b** | 2026-06-12 | **Marketplace module CLOSED.** Three things in one ship: (1) supplier-store category-card scoping fix — was showing global count (Catering·22) instead of supplier-scoped (·13); rail now takes a `categoryOverride` so each surface feeds its own count + tagline. Liam's QC blank was actually a dev-server stale-chunk (hard refresh) — but chasing it exposed the real per-supplier-count bug underneath. (2) End-of-module closing audit done, saved to `docs/audits/2026-06-12-marketplace-module-closing-audit.md` — 6 findings all accepted + fixed same-day (URL-builder consistency, silent pinned-suppression [predicted Liam's QC confusion verbatim], sizedImage observability, keyboard edge on chevron). (3) RP-05 + RP-06 confirmed clean by the closing audit; verdict: "structurally sound and production-ready." | `c70cf3e` | hard-refresh required first; then Rocket's store → Catering → card reads "Catering · 13 items" | ✓ end-of-module audit clean. **Module close summary: 7 prompts shipped, ~20 QC/audit iterations.** pV2-06f (Quote + checkout) deferred to projects arc boundary. |
| **v2.15c** | 2026-06-12 | **pV2-06d architect-audit pass** — angular-architect skill returned 9 findings; CC triaged with rationale. **7 fixed:** `<app-storefront-panel>` extracted (supplier-detail 224→172); `<app-view-toggle>` extracted as shared primitive (Store tab toggle now works with `?view=` bound — chat + architect cross-validated finding); defensive resource skip until `:id` resolves; cache keys param-sorted (genuine future fragility); favourites cross-tab race window documented; navigation failure logging added (closes chat's earlier LOW flag too). **2 rejected with rationale:** "stale suppliers on mode toggle" misreads `resource()` (mode = params dependency, flips re-run loader; same-params from session cache by design); "partial-response mutation" mechanically impossible (`await` resolves only with complete bodies). Rebuttals captured in shipped file. **Architect's done-well list independently validated** load-bearing choices: route-scoped DI + pinned scope, `linkedSignal` offset reset, URL-is-state consistency, cache eviction rules, zoneless cleanliness, born-paginated envelope. | `05217c0` + `5917228` | accepted | ✓ clean. 64/64 client + 42/42 server green. Two audit lenses (chat pattern eye + architect correctness eye) converged on the same M7/M8 extractions — meaningful signal that those were the right fixes. |

## When to update this doc

- New region or right-rail state added → update Layout
- v1 file's treatment changes (e.g. something we said "deferred" gets pulled in) → update mapping
- A pV2-06 prompt ships → bump Version History + add audit pointer
- Permission gate changes → update Who can use it
