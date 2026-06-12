# pV2-06-subcats — Subcategories: browse strip + curation drill-down

**Shipped:** 2026-06-12, chip `[Dev v2] v2.16a`
**Commits:** `fdba4e0` feat(v2.16a): subcats browse strip + curation drill-down
**Spec:** Liam's twice-flagged gap (pV2-MARKET-00 QC "i dont see subcat";
pV2-06a QC "no subcats yet") + `docs/MARKETPLACE.md`

## What landed
- **Server**: GET `/categories/:id/subcategories` (active subcats + live
  counts via `items.subcategory_id`); `/categories/all?parent=` curation
  variant (incl. inactive); PATCH relaxed from top-level-only to the
  catalogue namespace so subcats are curatable — the fresh-row return
  picks its count axis by level (category_id vs subcategory_id).
- **Browse** (`/marketplace`): a subcategory chip strip renders above the
  grid when a category is selected — "All {category}" + one chip per
  subcat with its count; chips drive `?sub=` (plumbed since 06a, now
  wired through the store: filterKey + items params + setSubcategory;
  category change clears the drill). Active-chip state via
  `.bp-cat-chip--active`. Empty-string query params normalised
  (`?cat=` edge found during verification).
- **Curation** (`/settings/categories`): chevron expander per top-level
  row → indented subcat rows (Name / Tagline / Visibility / Sort + count)
  on the same optimistic PATCH path; one category expanded at a time.

## Files touched
| File | SHA | Notes |
|---|---|---|
| server marketplace.js | fdba4e0 | subcats endpoint + ?parent + PATCH relax |
| client-v2 catalogue.service.ts | fdba4e0 | subcategories() cached; adminCategories(parent?) |
| client-v2 marketplace-store.ts | fdba4e0 | ?sub wiring + subcategoriesRes + param normalisation |
| client-v2 marketplace-page.component.ts | fdba4e0 | chips strip |
| client-v2 categories-settings.component.ts | fdba4e0 | expander + subcat rows + saveSub |
| client-v2 app.config.ts / styles.css / environment.ts | fdba4e0 | ChevronDown/Right; chip-active + expander classes; chip v2.16a |

## Acceptance — 7 / 7 verified live on 4201
- Catering selected → 11 subcat chips + "All Catering"; counts render — ✓
- Bar Service chip → 3 items, `?sub=` in URL; All → 22, sub cleared — ✓
- Subcat strip absent with no category selected / in suppliers mode — ✓
  by construction (guarded @if)
- Curation: 15 expanders; Catering expands to subcat rows — ✓
- Subcat tagline edited in the UI → persisted (verified via the
  subcategories API) → reverted — ✓
- Inactive subcats visible (dimmed) in curation, EXCLUDED from the
  browse strip — ✓ (active-only endpoint vs ?parent incl. inactive)
- Build/lint/guard green; 64/64 + 42/42 — ✓

## API audit checklist
#### `GET /api/marketplace/categories/:id/subcategories`
- ✓ uuid param (400); membership-gated (router); active-only; counts via
  indexed FK; 200/400/401/403; GET; next(err)
#### `GET /api/marketplace/categories/all?parent=`
- ✓ admin.cross_org_view; uuid parent (400); incl. inactive by design
#### `PATCH /api/marketplace/categories/:id` (scope widened)
- ✓ Same Zod body; namespace guard retained; 404 hides non-catalogue
  ids; fresh-row count axis correct per level

## Concerns not in spec
### Supplier storefront categories block still top-level
**Where:** suppliers/:id Storefront chips
**What:** v1 showed subcategory chips there; the new subcats endpoint
makes upgrading it trivial, but it needs a per-supplier subcat count
variant — deferred to the storefront styling pass Liam already has open.
**Severity:** LOW

### PATCH scope widening
**Where:** marketplace.js
**What:** subcat curation reuses the same permission gate
(admin.cross_org_view) — deliberate; noting because the 404-hiding
surface changed from "non-top-level" to "non-catalogue".
**Severity:** LOW (documented)

## QC notes
**2026-06-12 (Liam):** "works on marketplace, but not supplier store
(feels like not reusing again), it is very slow first time... search
works when subcat is selected" — search×subcat composition ACCEPTED; two
defects (chat audit: RP-06 + unindexed parent_id) fixed in v2.16b below.

## Chat audit
(chat fills this in — leave the section header so chat finds it)

## Iteration — v2.16b (2026-06-12)
**Triggered by:** Liam QC + chat audit (RP-06 confirmed; RP-01-family
index diagnosis — correctly index-shaped this time, the pool fix already
being in place).
**Commit:** `8246a46`
- **RP-06 → CLOSED BY EXTRACTION:** `<app-subcategory-strip>` shared
  primitive (joins view-toggle + catalogue-layout); mounted on the
  supplier Store tab — the shared store already loaded the data, only
  the UI was missing. Ledger row added with the standing rule: store-fed
  UI ships as a primitive mounted on EVERY MarketplaceStore provider
  page, same commit.
- **Slow first load:** `categories.parent_id` + `items.subcategory_id`
  partial indexes via migrate-schemas.js (all three schemas,
  column-existence-guarded — preview/master carry older shapes).
  Applied; EXPLAIN now bitmap-index-scans.
Verified live: Rocket store → Catering → chips render; Bar Service → 2
items (3 globally — pinned supplier scope filtering correctly); ?sub
round-trips; marketplace strip unchanged on the shared primitive.
