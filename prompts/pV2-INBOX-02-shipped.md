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

## QC notes
(Liam)

## Chat audit
(chat)
