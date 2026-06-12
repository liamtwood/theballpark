# pV2-06d — Suppliers mode + supplier detail + favourites

**Shipped:** 2026-06-12, chip `[Dev v2] v2.15a`
**Commits:** `81503bc` feat(v2.15a): suppliers mode + supplier detail + favourites
**Spec:** `docs/MARKETPLACE.md` (arc row pV2-06d) + `prompts/pV2-06-angular-architecture.md`

## What landed
- **`<app-tab-band>`** — the hero tab-band primitive (the arc plan's
  "06c-pre"): pills + optional badge, classes in styles.css (RP-05-clean).
  Consumers shipped: marketplace Items|Suppliers + supplier-detail
  Storefront|Store; the project tab band joins later.
- **Server**: GET `/api/marketplace/suppliers` (paginated envelope;
  supplier = org with ≥1 active approved item; `cat` narrows); GET
  `/suppliers/:id` — the storefront projection (identity + contact +
  per-category counts; **financial columns never projected** — verified
  no leak); GET/POST `/favourites` — org-scoped from `req.user.org_id`,
  transactional toggle (`FOR UPDATE` revive-or-flip on the soft-deleted
  unique-ish row). Zod schemas + 3 specs (server 42/42).
- **Marketplace suppliers mode** (`?mode=suppliers`): supplier cards
  (cover, logo-letter, city, item count), item-only filters auto-hidden
  and dropped on switch, same Show-more accumulation; card → `/suppliers/:id`.
- **FavouritesStore** (root): signal sets per type, optimistic toggle
  with revert-on-failure AND adopt-server-truth on race; hearts on item
  cards (stopPropagation vs card-select) + supplier cards + the detail
  hero.
- **`/suppliers/:id`**: Storefront tab (brand panel, category chips →
  Store drill, contact card with tel/mailto/website links) | Store tab
  (the supplier's items via the SAME `/items?supplier=` path — one list
  path; per-category filter + show-all + Show more). Tab + drill in the
  URL (`?tab=store&cat=`).

## Files touched
| File | SHA | Notes |
|---|---|---|
| server marketplace-suppliers.schema(.test).js (new) + marketplace.js | 81503bc | suppliers + favourites endpoints |
| client-v2 shared/tab-band/ (new), shared/catalogue/* (supplier-card new; item-card hearts; grid pass-through; types) | 81503bc | the primitives |
| client-v2 core/marketplace/ (favourites.store new; service suppliers/detail/favourites) | 81503bc | data layer |
| client-v2 pages/marketplace/* (mode), pages/suppliers/supplier-detail (new), routes, icons, styles.css, environment | 81503bc | the surfaces; chip v2.15a |

## Acceptance — 10 / 10 verified live on 4201
- Items|Suppliers tab band on /marketplace; `?mode=suppliers` in URL — ✓
- 12 supplier cards; item-only filters hidden in suppliers mode — ✓
- Heart toggles on supplier card (on → off) with optimistic state — ✓
- API favourites round-trip: toggle on → listed → toggle off → cleared — ✓
- Supplier card → /suppliers/:id; hero name + Storefront|Store tabs — ✓
- Storefront: brand panel + description + category chips + contact card
  (email/phone/website rendered) — ✓
- Category chip → `?tab=store&cat=` → 13 filtered items + "Filtered to /
  show all" — ✓
- Store tab reuses /items?supplier= (no second items path) — ✓ by
  construction + network
- No financial columns in the storefront projection — ✓ checked response
- Build/lint/guard green; client 64/64, server 42/42 — ✓

## API audit checklist
#### `GET /api/marketplace/suppliers`
- ✓ Input validation: Zod (uuid cat, q ≤80, offset); ILIKE escaped
- ✓ Authorization: router-level membership gate
- ✓ Status codes: 200/400/401/403; envelope shape; next(err); GET; one
  query w/ COUNT(*) OVER()
#### `GET /api/marketplace/suppliers/:id`
- ✓ uuid param (400); 404 hides non-supplier orgs; marketplace-public
  projection ONLY (no financials); two indexed queries
#### `GET|POST /api/marketplace/favourites`
- ✓ org_id from req.user only (never body); Zod toggle body (type enum +
  uuid); withTransaction + FOR UPDATE (no double-row race); returns new
  state; 200/400/401/403

## Concerns not in spec
### Storefront categories are TOP-LEVEL (v1 showed subcategories)
**Where:** suppliers/:id categories block
**What:** v1's storefront listed 8 catering SUBcategory chips for Rocket
Food; v2 shows the 1 top-level chip (Catering, 13) — consistent with the
arc-wide subcat deferral. When the subcat surface lands, this block
upgrades with it.
**Severity:** LOW

### Favourites have no unique constraint
**Where:** favourites table
**What:** the toggle guards races with FOR UPDATE on the selected row,
but nothing stops duplicate (org,type,ref) rows arriving from OUTSIDE
this code path (e.g. v1 writes). A unique partial index would make the
invariant structural — needs a migration, deferred for a schema touch.
**Severity:** LOW

### v1 favourites route still ungated
**Where:** server/src/routes/favourites.js (v1 mount)
**What:** same class as the RP-03 categories finding — v1's favourites
endpoints are ungated writes, though org-scoped data only (low blast
radius vs categories). Flag for the same retire-writes treatment on the
next server security pass.
**Severity:** MEDIUM (recommend same option-(a) fix)

## QC notes
**2026-06-12 (Liam):** favourites ACCEPTED ("added favourites, check they
saved when i moved away and came back, same with unlove"); storefront
"looks good (needs styling)" — styling pass awaiting specifics. Two bugs:
(1) view toggle inert in suppliers mode (cards only); (2) supplier Store
tab missing the left + right rails. Both fixed in v2.15b below.

## Chat audit
(chat fills this in — leave the section header so chat finds it)

## Iteration — v2.15b (2026-06-12)
**Triggered by:** Liam's QC (two bugs above) + chat's architecture flag —
"Both should reuse shared/catalogue/* and marketplace-store patterns...
the engine works for items in supplier-detail but the layout shell wasn't
reused."
**Commit:** `5db73dc`
**What changed:**
- `supplier-grid` (new): card/list/table @switch — all 3 view modes work
  in suppliers mode (verified: 12 cards / 12 list rows / table headers).
- `MarketplaceStore` gains the PINNED-SUPPLIER scope (the architecture's
  CatalogueScope): a `:id` route param pins items queries and idles the
  suppliers resource; pinned id folded into filterKey.
- supplier-detail Store tab now PROVIDES MarketplaceStore and mounts the
  SAME category-strip / catalogue-grid / right-rail as the marketplace —
  its hand-rolled mini-store (~70 lines: items/offset/hasMore/selection)
  is deleted. Preview, ?item= selection, Show more, category drill all
  come from the shared pieces now.
- `catalogue-layout` (new): the 3-region grid shell, one definition,
  mounted by both pages.
Verified live: 3 supplier view modes; Rocket Store tab renders
strip(2 rows incl. All) | 13 cards | right rail; card click → preview
"Bowl Food Dinner" in the SHARED rail; strip filter scoped to the
pinned supplier; URL carries ?tab=store&cat=&item=.
