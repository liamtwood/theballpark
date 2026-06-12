# Angular-architect audit — Marketplace module CLOSING audit

**Run:** 2026-06-12, independent background agent (read-only), per the
end-of-module audit process (CLAUDE.md). Covers everything since the
mid-module audit (`2026-06-12-marketplace-arc-angular-architect-audit.md`):
subcats (tree rail + curation drill-down), chevron collapse, sizedImage,
taxonomy indexes, rail category-summary mode, shared primitives.
**Triage:** all six findings ACCEPTED and fixed in v2.17b (same-day) —
none rejected this round. Prior audit's rejected findings (C2/H4) were
explicitly excluded and not re-raised.

## Findings → fixes (v2.17b)

| # | Finding | Verdict |
|---|---|---|
| C1 (self-rated MEDIUM) | `adminCategories(parent)` interpolated the uuid into the URL — the one builder not using URLSearchParams | FIXED — URLSearchParams like every other read |
| H1/LOW | Conditional-params style drift between subcategoriesRes and categorySuppliersRes | Noted; logic confirmed sound |
| M1 | Pinned-scope supplier-list suppression was silent — "a future dev won't know it was deliberate" | FIXED beyond the ask: the rail gained a `categoryOverride` input and the supplier store now passes its PER-SUPPLIER category (count 13, not the global 22 — a real display bug Liam's QC brushed against); suppression documented |
| H2/LOW | `sizedImage()` swallowed URL-parse failures silently | FIXED — console.warn on parse failure (DB-sourced URLs; garbage should be loud) |
| M2 | categorySuppliers loader discards the envelope (first page only) without saying so | FIXED — intent comment; no-silent-caps note already in the 06e ship report |
| M3 | Chevron keydown.enter could double-activate via the parent button (keyboard-only edge) | FIXED — preventDefault + stopPropagation in the active branch |

## Compliance confirmations
- **RP-05** (no component-local `.bp-*` definitions): CLEAN.
- **RP-06** (store-fed UI on both MarketplaceStore provider pages): CLEAN.
- Prior-audit fixes (stable cache keys, nav logging, empty-id skip) holding.

## Agent's done-well list (abridged)
Tree rail linkedSignal correctness; conditional resource skips;
route-scoped pinned DI; cache eviction rules; sizedImage safety;
optimistic saves with revert; URL-is-state throughout; pure presentation
components; a11y baseline; born-paginated envelope.

## Module-health verdict (agent, verbatim)
"The Marketplace module is structurally sound and production-ready. …
The architecture cleanly separates concerns, reuses primitives across
surfaces, and maintains URL-is-state throughout. Audit H3/H4 rejections
from v2.15c stand unchanged — no new evidence they're bugs. Ready for
QC/launch."

## Module status at close
Shipped: MARKET-00, 06a, 06b, 06c, 06d, 06-subcats, 06e (+ ~20 QC/audit
iterations). Gated on the projects arc: 06f (Quote) + checkout page.
Parked: storefront styling pass, per-supplier subcat narrowing, v1
favourites ungated writes (MEDIUM), image uploads, item editing (/store),
Recommend, attribute filters (need /store-created data).
