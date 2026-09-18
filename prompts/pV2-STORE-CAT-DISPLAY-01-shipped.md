# pV2-STORE-CAT-DISPLAY-01 — Category rail counts vs item list

**Shipped:** 2026-09-18, chip `Dev v2.483` (client) + server.
**Owner:** CC. Chat authored; investigate→propose→approved (Liam via f4/d2) → built.
**Commits:** `e38c65c9` (server owner-aware counts) · `<this>` (client rail re-source + chip).

## Root cause (confirmed)
Three separate count/list contexts:
1. Macro counts ← `GET /api/marketplace/suppliers/:id` (org-scoped, but `approved+active` only).
2. Subcat rail counts ← `GET /api/marketplace/categories/:id/subcategories` — **GLOBAL (no supplier scope)**, `approved+active`, `is_active`-gated, no rollup. **The My Shop rail wrongly used this.**
3. Item list ← `GET /api/marketplace/items` — org-scoped and **owner-aware** (owner sees draft/pending/inactive).
→ Divergence: rail counts were global (phantom subcats from other suppliers) while the list is org-scoped; and the count endpoints filtered `approved+active` while the owner's list shows all statuses → counts ≠ list, "count says N, list shows 0".

## What landed
**Server (`marketplace-suppliers.js`)** — the supplier macro-count and subcategory-count endpoints are now **owner/admin-aware** via `ownerVisibleFilter(req, orgId, alias)`: the store owner (and ballpark admin) counts the whole catalogue (all statuses), matching `/items`; the public sees `live+approved`. Category display stays **status-agnostic** (JOIN on items — a node shows iff it has ≥1 in-scope item, whatever the category's `is_active`/`deleted_at`). The existing **catch-all row** rolls uncategorised (`subcategory_id IS NULL`) items up to their macro.

**Client (`supplier-detail.component.ts`)** — the My Shop store rail now sources subcats from the **org-scoped `supplierSubcategories`** (already loaded as `subcats`), filtered to the selected macro, instead of the global `store.subcategories()`. Real subcats only; uncategorised items surface at the macro level (cat-only list, per the spec's "listed at the macro level"). Scoped to `supplier-detail` — the **global marketplace browse is untouched**.

**Verified** (org eb85e589, owner scope): F&F macro **= 4**; subcats **Seating 1 + Uncategorised 3 = 4** (was inconsistent); phantom subcats (Lounge/Bar/Plinths/Reception, 0 owner items) **gone**.

## Requirements (per the prompt)
1. Count == list — ✓ (rail + list both org-scoped + owner-aware, same predicate).
2. Recursive subtree rollup — ✓ for the current **2-level** taxonomy (subcat + catch-all→macro). See deviation note.
3. Node visibility by live items, status ignored — ✓ (JOIN-based; no category status gate).
4. Uncategorised → parent macro — ✓ (catch-all + macro-level listing).
5. Roll-up by parent_id, not raw category_id — ✓ for 2-level (via category_id/parent_id).

## Deviation from the approved approach (transparent)
The proposal said "one recursive-CTE endpoint." I achieved the **same outcome with a simpler mechanism** — reuse + owner-aware the existing org-scoped `supplierSubcategories` (which already does subcat + catch-all rollup) and point the rail at it — because the taxonomy is currently **strictly 2-level** (items sit at `category_id`=macro with a direct-child subcat or NULL). A recursive CTE would be functionally identical today but more code. All 5 requirements are met for the current model; the recursive generalisation is a no-op now and folds into **TAXONOMY-01** if/when 3-level lands. Flagging in case the recursive infra was wanted pre-built.

## API audit checklist (Rule 10) — endpoints touched
`GET /api/marketplace/suppliers/:id` · `GET /api/marketplace/suppliers/:id/subcategories`
- ✓ Method (GET, read) · ✓ Input (uuid-validated `:id`) · ✓ Authorization (v2 group: authenticate + requireActiveMembership; owner/admin scope derived from `req.user`, never the body) · ✓ Status codes (400 bad id, 404 no supplier) · ✓ Info disclosure (public fields only; owner-only sees own drafts via `req.user.org_id` match) · ✓ Observability · N/A Idempotency · ✓ Performance (added filters are indexed columns; no new fan-out).

## Concerns not in spec
- **Explicit "Uncategorised" rail node** — not added; uncategorised items show at the macro (cat-only). An "Other in {macro}" chip is an easy follow-up if wanted.
- **Global marketplace rail** still uses the global `subcategories` endpoint (correct for public browse) — only the supplier store rail changed.
- **The `/categories/:id/subcategories` global endpoint** keeps its `is_active` gate + no rollup; it's now only used by the public marketplace, where that's acceptable. Unify later if the public browse needs the same rollup.

## QC notes
QC pass (Liam, 2026-09-18): My Shop → Furniture & Fixtures shows **only Seating**
(no phantom subcats). "Limewash Chiavari Chair Hire" is assigned to Seating;
"Banquet Chair Hire" (unassigned / not approved, so not in the marketplace)
still shows under F&F (at the macro). "looks good to me for this fix."

QC round 2 (Liam, 2026-09-18) — full lifecycle accepted: item create + subcat +
tags good; not-approved → My Shop only (not marketplace); approved+inactive → not
in marketplace; approved+active → in marketplace. And: an item classified to a
**deleted** subcat still appears in the marketplace under its **parent** macro
(the deleted subcat node itself, e.g. "Chairs", is not displayed) — **Liam OK with
that** ("if the classification level is deleted it still shows up on the parent
classification"). Matches the display rule + BE-00101 (new items won't bind to a
deleted subcat).

## Chat audit
(chat/d2)
