# pV2-STORE-CAT-DISPLAY-01 — Category rail counts vs item list (investigate + propose)

**Type:** client-v2 + server (supplier store / marketplace browse) · **INVESTIGATE
+ PROPOSE, don't build yet.** CC investigates, returns findings + a proposed fix
for review; f4/Liam approve the approach before you build.
**Owner:** CC. Chat authored from QC on 2026-09-18. Aligns to
`pV2-TAXONOMY-01-prompt.md` (roll-up rendering, recursive rollup, active-only).

## Symptom (QC on the supplier store, org eb85e589)
Selecting **Furniture & Fixtures** shows the subcat rail with counts —
`Seating 1 · Lounge & Breakout 1 · Bar & Counter Units 1 · Plinths & Pedestals 1
· Reception / Registration 1`, macro count `2` — **but the item list shows "No
items." / "0 items".** Counts appear for subcats that display nothing, the macro
count (2) doesn't equal the subcat sum (5), and selecting a cat returns nothing.

## Data reality (verified, same org)
Furniture & Fixtures has **4 live items**: `Limewash Chiavari Chair Hire →
Seating (pending)`, and `Banquet Chair Hire / Podium / Desk Rental → subcat
(none)`. **Lounge & Breakout / Bar & Counter Units / Plinths / Reception have
ZERO live items for this supplier** — so their rail count of `1` is a phantom.
Also: **33 of 46 items have `subcategory_id = NULL`** (most items are
uncategorised); a few historical items point at inactive/deleted subcats (new
ones are fixed by BE-00101).

## Suspected root cause (confirm)
The **rail counts and the item list are computed in *different contexts*** — e.g.
counts from a global / all-supplier / all-status source, or the rail is built
from the category tree (showing subcats that have no live items in context),
while the item list is org-scoped + current. So the count context ≠ the display
context → phantom counts and "count says N, list shows 0".

## THE CORE PROBLEM (Liam, 2026-09-18) — items in "limbo"
An item should never point to a category that isn't displayable. Right now,
deleting/deactivating a category **strands** the items classified to it — they
point at a dead node and go orphaned ("just limbo"). A category's `is_active` /
`deleted_at` correctly governs the **classifier VOCABULARY** (what *new* items can
bind to — BE-00101), but the **items already on it are left in limbo.**

**Two resolutions — Liam's lean is B:**
- **A — tolerate on display:** render any category (even inactive/deleted) that
  still has ≥1 live item; hide categories with 0 live items. A band-aid — it
  surfaces removed categories in the UI.
- **B — resolve on delete (PREFERRED):** deleting/deactivating a category
  **unclassifies** its items (`subcategory_id → NULL`, the item rolls up to its
  parent category) or **reclassifies** them to a live target — so **no item ever
  points to a dead node.** Plus a **one-off cleanup** for existing limbo items
  (unclassify them to their live parent). Display then only ever deals with live
  categories.

CC: evaluate A vs B (Liam prefers **B** — cleaner, no dead categories in the UI),
confirm feasibility (a category-delete/deactivate hook that resolves its items;
the uncategorised-rollup display; the existing-limbo cleanup), and propose.

## What the fix must achieve (per TAXONOMY-01)
1. **One consistent query drives both** the rail counts AND the item list — a
   count must equal what actually displays when you click it.
2. **Recursive subtree rollup** — selecting a node returns every item in its
   subtree (macro → subcat → deeper), not just direct matches.
3. **No phantom nodes:** a rail node appears only if it has live items in context
   (count = live items in its subtree); nodes with 0 live items don't appear.
   Scope: org for My Shop, global for the marketplace. (Under **B**, dead
   categories won't appear because they'll have no items after resolution; under
   **A** they'd appear only while they still hold live items.)
4. **Uncategorised items** (`subcategory_id = NULL`, incl. those freed by B) —
   roll them up to their **parent category** for display (an "Other in F&F"
   bucket or listed at the macro level). Today they vanish, which is why F&F shows
   "No items" despite having 3 subcat-less items. This is what makes B safe —
   unclassified items stay visible under their macro.
5. **Roll-up by `parent_id`, never group by raw `category_id`** (TAXONOMY-01) — so
   an item at any depth counts/displays under every ancestor consistently.

## Deliverables (propose, then we approve)
- Root cause confirmed: where the rail count is computed vs where the item list
  is queried, and exactly why they diverge (the two code paths).
- A proposed fix that unifies them (one query/source), recursive + active-only +
  correctly scoped, handling uncategorised items.
- Note any data cleanup needed (existing items on inactive/deleted subcats;
  re-point to a live ancestor).
- Scope/size estimate + which components/queries change. **Hold the build for
  approval.**

## Not in scope
The 3-level "Chairs under Seating" restructure (TAXONOMY-01 trigger-relax slice) —
this is only about making counts + rollup + active-only display *correct* on the
current taxonomy.
