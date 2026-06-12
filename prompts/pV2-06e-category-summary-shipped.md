# pV2-06e — Right-rail category-summary mode

**Shipped:** 2026-06-12, chip `[Dev v2] v2.17a`
**Commits:** `91ab2f8` feat(v2.17a): rail category-summary mode
**Spec:** `docs/MARKETPLACE.md` (arc row pV2-06e — the v1
category-context-panel port, simplified)

## What landed
- `rail/category-summary.component.ts` (new, ~50 lines): the rail's
  CATEGORY mode — name, tagline, item count, and the suppliers serving
  the category (logo letter + name + item count → `/suppliers/:id`
  links).
- Store: `categorySuppliersRes` — cached first-page suppliers read,
  **skipped in the pinned-supplier scope** (design call: listing OTHER
  suppliers inside one supplier's store would be wrong — there the rail
  shows the category header only) and when no category is selected.
- right-rail CATEGORY case goes real (placeholder copy gone); item
  preview still overrides; closing the preview returns to the summary.

## Acceptance — 5 / 5 verified live on 4201
- Catering selected → rail shows "Catering", count, and 3 suppliers with
  matching counts (ProBuild 5 / Rocket Food 13 / The Food Crowd 4) — ✓
- Supplier rows link to storefronts — ✓ (routerLink)
- Item click → preview overrides; close → back to the summary — ✓
- Pinned scope (Rocket store, ?cat=Catering): header renders, supplier
  list SUPPRESSED — ✓
- Build/lint/guard green; 64/64 + 42/42 — ✓

## Concerns not in spec
### Subcategory selection keeps the parent summary
**Where:** railMode derivation
**What:** with ?sub= set the rail still shows the PARENT category's
summary (railMode has no 'subcategory'). Defensible (the drill context is
visible in the rail tree) but a subcat-specific summary could follow if
QC wants it.
**Severity:** LOW

### Rail supplier list caps at the first page (48)
**Where:** categorySuppliersRes
**What:** a category served by >48 suppliers would silently truncate the
rail list. Impossible at current scale (12 suppliers total); noted per
the no-silent-caps rule.
**Severity:** LOW

## QC notes
**2026-06-12 (Liam):** marketplace card ACCEPTED ("displays including the
subtitle from cats table"); reported the card "does not appear on store".
Fresh-session verification showed it DOES render there (his blank =
the recurring dev-server stale-chunk; hard refresh cures) — but the check
exposed a REAL bug underneath: the store rail showed the GLOBAL count
(22) instead of the supplier-scoped count (13). Fixed in v2.17b.

## Chat audit
(chat fills this in — leave the section header so chat finds it)

## Iteration — v2.17b (2026-06-12)
**Triggered by:** Liam's QC + the module CLOSING audit (all 6 findings
accepted — docs/audits/2026-06-12-marketplace-module-closing-audit.md).
**Commit:** see v2.17b
- Pinned-scope category card now shows THIS supplier's count: right-rail
  gained a categoryOverride input; supplier-detail passes its
  per-supplier category (count from sup.categories, tagline from the
  global rail list). Verified: "Catering · 13 items" in Rocket's store.
- Closing-audit fixes: adminCategories → URLSearchParams; sizedImage
  warns on parse failure; first-page-only comment on
  categorySuppliersRes; chevron preventDefault (keyboard double-activate
  edge).
