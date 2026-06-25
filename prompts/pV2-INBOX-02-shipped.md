# pV2-INBOX-02 — agent outreach (build quote → fan to suppliers → message)

The **producer** that feeds the INBOX-01 supplier reader. Designed
conversationally with Liam (2026-06-25). v1 equivalent: the cart-drawer
outreach train → `POST /taxonomy/request-quotes`
([taxonomy.service.js:1006](server/src/services/taxonomy.service.js)).

**Locked model (Liam, 2026-06-25):**
- Quote = `project_items` (already built), grouped by category.
- Per category, a **multipicked supplier roster** (default = item owners;
  add alternates). **Ephemeral** — held in a project-scoped store across
  the Estimate/Marketplace/final-quote tabs, persisted only when Send fires
  (v1-parity; no schema, no migration). A `project_category_suppliers`
  table is a one-prompt follow-up if reload-loss bites.
- **Message suppliers** → for each `(category × picked supplier)`, a thread
  seeded with that category's items as `brief_sent` message_items, reusing
  v1's `requestQuotes` writes, org from JWT.
- **Keep outreach emails** (suppliers must know they're briefed). **Defer
  the 1-Ball debit** (no Balls UI in v2 yet) — follow-up prompt.

Slices: 1 entry+scoped supplier tab ✅ · 2 multipick add-to-quote · 3 final
quote + Message CTA · 4 gated `POST /api/inbox/send` (the producer).

---

## Slice 1 — "Go with this Ballpark" → Marketplace, Suppliers mode, scoped

**Shipped:** 2026-06-25, chip `[Dev v2] v2.34w`

### What landed
- **"Go with this Ballpark"** CTA on the Estimate tab → project-detail
  switches to the **Marketplace tab in `mode=suppliers`**.
- The in-project Marketplace tab now renders the **Suppliers** mode
  (reuses `SupplierGridComponent`) with an **Items / Suppliers** toggle —
  it previously only rendered the Items grid.
- In Suppliers mode the category strip is **scoped to the quote's
  categories** (new `hideAll` input on the shared strip — no "All" browse),
  so only project-relevant categories/suppliers surface. Pick a category →
  its suppliers load. (Multipick **Add to quote** is slice 2 — list is
  read-only for now.)

### Files touched
| File | Notes |
|---|---|
| client-v2/.../projects/project-estimate.component.ts | `goToMarketplace` output + gradient CTA |
| client-v2/.../projects/project-detail.component.ts | `goToMarketplace()` → `?tab=marketplace&mode=suppliers` |
| client-v2/.../projects/project-marketplace.component.ts | Items/Suppliers toggle + Suppliers branch + `stripCategories` scoping |
| client-v2/.../shared/catalogue/category-strip.component.ts | `hideAll` input (default false — global unaffected) |
| client-v2/src/environments/environment.ts | chip → v2.34w |

### Acceptance
- Estimate (with items) shows "Go with this Ballpark"; click → Marketplace
  Suppliers tab. ✓ (Liam to QC visually)
- Suppliers mode: strip shows only the quote's categories, no "All". ✓
- Select a category → suppliers serving it render. ✓
- Items mode unchanged (full catalogue + filters). ✓
- v2 build clean. ✓

### Concerns not in spec
#### No auto-select of first category in Suppliers mode
**Where:** project-marketplace.component.ts
**What:** entering Suppliers mode shows a "select a category" prompt rather
than auto-selecting the first quote category. Deliberate — avoids
effect-driven navigation in slice 1.
**Suggested fix:** auto-select the first scoped category if Liam wants it
one-click. **Severity:** LOW

### Iteration — v2.34x (2026-06-25)
**Triggered by QC (Liam):** Suppliers rail should show **"All Categories"**
too, scoped to suppliers across **all** the quote's categories (not the
whole catalogue).
- Dropped the `hideAll` strip input (added then unused); replaced with an
  `allLabel` input. The "All Categories" row is back in Suppliers mode.
- The supplier list now comes from a **client-side union**: "All" fetches
  suppliers per quote-category and dedupes by id (per-category reads are
  cached by the catalogue service). A specific category still shows just
  that category's suppliers. Strip "All" count = the relevant categories'
  totals only (`scopedTotal`), not the full catalogue.
- No-silent-cap: the union takes the **first page** per category (supplier
  set is small today); revisit if a category exceeds one page.

## Slice 2 — "Add to Quote" on supplier cards

**Shipped:** 2026-06-25, chip `[Dev v2] v2.34y`

Liam's call: no multipick UI — just an **Add to Quote** button per supplier
card, add as many as you like.

### What landed
- The supplier card's **"View supplier"** CTA becomes **"Add to Quote"** in
  the project fan-out (new `quotable`/`inQuote`/`quoteToggled` on
  supplier-card + supplier-grid; global marketplace unaffected — default
  `quotable=false`). Toggles to **"Added to Quote"** (outline + check); the
  button stops the card's navigation.
- New **`ProjectOutreachStore`** ([project-outreach.store.ts](client-v2/src/app/pages/projects/project-outreach.store.ts)) —
  the **ephemeral** per-category supplier roster (`Map<categoryId,
  Set<supplierId>>`). Provided at **project-detail** level so picks survive
  Marketplace ↔ Estimate tab switches; nothing persists until Send.
- Adding a supplier enlists them for the quote categories they serve in the
  current view (the selected category, or all of them on "All Categories").

### Files touched
| File | Notes |
|---|---|
| client-v2/.../projects/project-outreach.store.ts | NEW — ephemeral roster |
| client-v2/.../projects/project-detail.component.ts | provide the store |
| client-v2/.../projects/project-marketplace.component.ts | supplier→cats map, enlisted set, toggle |
| client-v2/.../shared/catalogue/supplier-card.component.ts | Add to Quote CTA |
| client-v2/.../shared/catalogue/supplier-grid.component.ts | pass-through props |
| client-v2/src/environments/environment.ts | chip → v2.34y |

### Concerns not in spec
#### "Added" state on the All view is all-or-nothing
**Where:** project-marketplace `enlistedSupplierIds`
**What:** on "All Categories", a supplier shows "Added" only when enlisted
for **every** quote-category they serve; if added under one specific
category then viewed on All, they read "Add to Quote" (clicking tops up the
rest). Deterministic but can look partial. The per-category rail (slice 3)
will make the true state visible. **Severity:** LOW

### Iteration — v2.34z (2026-06-25)
**Triggered by QC (Liam):** viewing a supplier then Back didn't return to
the Suppliers tab with the category still selected (lost stickiness).
- Root cause: supplier-detail's leaf Back was a fixed `href: '/marketplace'`.
- Fix: page-hero `back` gains an optional `history: true` flag → pops
  browser history (restoring the exact previous URL + its `?tab/mode/cat`
  state), falling back to the href when there's no in-app history. The
  supplier-detail storefront leaf now uses it (label "Back").
- **Known limitation (ephemeral, not fixed):** the URL/tab/category restore,
  but navigating out to `/suppliers/:id` destroys project-detail, so the
  in-memory `ProjectOutreachStore` picks are lost on that round-trip. The
  persisted-roster follow-up (option b) resolves it; acceptable for MVP
  since the add → message flow stays within the project.

## QC notes
(Liam)

## Chat audit
(chat)
