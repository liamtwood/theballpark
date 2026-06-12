# pV2-06a — Marketplace browse foundation

**Shipped:** 2026-06-12, chip `[Dev v2] v2.14b`
**Commits:** `b4ffc63` feat(v2.14b): marketplace browse foundation
**Spec:** `docs/MARKETPLACE.md` (arc row pV2-06a) + `prompts/pV2-06-angular-architecture.md`

## What landed
- **Server** — GET `/api/marketplace/items?cat&sub&q&offset` on the gated
  v2 router: born-paginated `{ items, total, hasMore }` (PAGE_SIZE 48 —
  Liam's ruling), active+approved items only (exactly the v1 "144"),
  `ownedByActiveOrg` derived from `req.user.org_id` (never client-sent),
  ILIKE search over name+description with escaped wildcards, Zod query
  schema (uuid cat/sub, q ≤80, offset ≥0) — every value reaches SQL as a
  bound parameter; total via `COUNT(*) OVER()` (one query per page).
- **MarketplaceStore** (route-scoped) — URL is state: `?cat`/`?q`/`?view`/
  `?item` drive everything (shareable links, Back works); writers
  navigate; `linkedSignal` offset snaps to 0 on any filter change; the
  resource loader accumulates pages (page 0 replaces, appends after);
  `railMode` is DERIVED from selection — selection never fetches.
- **CatalogueService** gained the §4 session cache: Map keyed by URL,
  concurrent identical requests share one in-flight promise, failed
  flights evicted, `invalidate()` + bust-on-write (curation PATCH already
  busts it — the stale-tab scenario chat flagged).
- **Engine components** (shared/catalogue/): catalogue-search (300ms
  debounce, emits settled term), category-strip (left rail, All
  Categories + live counts), catalogue-grid (PURE — card/list/table
  `@switch`; entities in, selection out), item-card (image w/ soft
  placeholder, name/supplier/price+unit; first 6 eager for LCP).
- **Page shell** — hero + search row + view toggle (3 pill buttons) +
  three regions; right rail renders placeholder modes (item → 06b,
  category → 06e, quote → 06f; default = "Select a category or item").
- `/marketplace` coming-soon stub replaced by the real page (agent tile +
  supplier Storefront hub tile now land somewhere real).

## Files touched
| File | Lines (Δ) | SHA | Notes |
|---|---|---|---|
| server/src/routes/marketplace.js | +63 | b4ffc63 | items endpoint |
| server/src/schemas/marketplace-query.schema.js / .test.js | +18 / +30 (new) | b4ffc63 | Zod + PAGE_SIZE + 5 specs |
| client-v2 .../catalogue/catalogue.types.ts | +45 | b4ffc63 | item/envelope/view/rail types + asViewMode |
| client-v2 .../catalogue.types.spec.ts | +16 (new) | b4ffc63 | 2 specs |
| client-v2 .../core/marketplace/catalogue.service.ts | +45 | b4ffc63 | session cache + items() |
| client-v2 .../pages/marketplace/marketplace-store.ts | +120 (new) | b4ffc63 | the store |
| client-v2 .../pages/marketplace/marketplace-page.component.ts | +140 (new) | b4ffc63 | route shell |
| client-v2 .../pages/marketplace/rail/right-rail.component.ts | +55 (new) | b4ffc63 | placeholder modes |
| client-v2 .../catalogue/{catalogue-search,category-strip,catalogue-grid,item-card}.component.ts | +300 (new) | b4ffc63 | the engine |
| client-v2 app.routes.ts / app.config.ts / environment.ts | +12 | b4ffc63 | route swap + 4 icons + chip |

All components inside the ledger line budgets (largest: page shell ~140).

## Acceptance — 9 / 9 verified live on 4201 (as Beth)
- Lands on All Categories, 48 cards, "Search 144 items…" live count — ✓
- Show more appends (48 → 96); hasMore flips false at 144 — ✓ (API page 3
  verified: count 48, hasMore false)
- Category click → 13 Florals, URL `?cat=<uuid>` — ✓
- Search "light" → 16 results, URL `?q=light`, debounced — ✓
- View toggle card/list/table, URL `?view=table`, table headers render — ✓
- Item click → card highlights, `?item=` set, rail flips to the item
  placeholder; click again deselects — ✓
- Rail default = quiet empty-state hint — ✓
- Authz: items endpoint member-gated (401 signed out); bad `?cat` → 400 — ✓
- Build + lint + style guard green; client 64/64, server 39/39; v1
  untouched — ✓

## API audit checklist
#### `GET /api/marketplace/items`
- ✓ Method semantics: read-only list
- ✓ Input validation: Zod query schema (400 + flatten); ILIKE wildcards
  escaped; uuid params
- ✓ Authorization: router-level authenticate + requireActiveMembership
- ✓ Status codes: 200 / 400 / 401 / 403 — verified
- ✓ Response shape: { items, total, hasMore } camelCase envelope
- ✓ Information disclosure: platform catalogue by design; ownership flag
  derived server-side
- ✓ Observability: next(err) → central 5xx logger
- ✓ Idempotency: GET
- ✓ Performance: one query/page (COUNT(*) OVER()), LIMIT 48, indexed FKs

## Concerns not in spec
### COUNT(*) OVER() repeats the count per row
**Where:** marketplace.js items query
**What:** the window count costs a full scan of the filtered set per
page. Fine at catalogue scale (≤thousands); at real growth, split into a
cached COUNT or trigram index path.
**Severity:** LOW

### Hidden tabs defer lazy images
**Where:** item-card.component.ts
**What:** Chrome never loads `loading="lazy"` images in hidden/headless
tabs — looked broken in the preview until diagnosed. First 6 cards now
eager (also the right LCP call); real browsers unaffected.
**Severity:** LOW (documented in-code)

### Subcategory strip not in this slice
**Where:** store + page shell
**What:** `?sub=` is plumbed end-to-end (schema, service, store params)
but no UI renders subcategories yet — that's the deferred subcat surface
(QC note on pV2-MARKET-00).
**Severity:** LOW

## QC notes
**2026-06-12 (Liam):** "the basic structure is there, the all and cats
show a card in preview, and select an item get preview, show more works
well, 3 modes works as expected... no subcats yet but looks great for 1st
iteration" — ACCEPTED. One issue: "search is very slow the first time" →
diagnosed + fixed in the v2.14c iteration below (pool grew from zero, so
the first OVERLAPPING request paid a cold TCP+TLS connect to Supabase).

## Chat audit
(chat fills this in — leave the section header so chat finds it)

## Iteration — v2.14c (2026-06-12)
**Triggered by QC:** "search is very slow the first time" + chat's
pV2-MARKET-00 audit finding (ungated legacy /api/categories writes).
**Commit:** see v2.14c
**Search fix:** db/pool.js — `min: 2` + boot warm-up pair. The pool
started EMPTY and grew on demand; the first time two requests overlapped
(debounced search next to anything else), the second paid a cold
TCP+TLS+auth connect (~1-2s). Verified post-fix: two parallel fresh-URL
queries complete in 76ms total.
**Security fix (chat audit 🔴):** routes/categories.js write verbs
(POST/PUT/PATCH/DELETE — zero auth, zero validation) RETIRED per chat's
option (a); GETs stay for v1's browse reads until pV2-11. Removed verbs
now fall through to the gated v2 catch-all → 401 (verified: POST/PUT/
DELETE 401, GETs 200). Accepted v1 breakage (superseded surfaces):
ballpark-settings category admin + category cover-image PATCH.

## QC notes — addendum (2026-06-12)
**Liam:** "logged and back in, search is like lightning now even after a
cold start" — v2.14c search fix VERIFIED by QC.
