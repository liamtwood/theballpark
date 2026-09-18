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

## THE DECISION (Liam, 2026-09-18) — ignore status on DISPLAY, respect it on CLASSIFY
The fix is a clean split, and it means **nothing ever orphans**:
- **Display IGNORES `is_active` / `deleted_at`.** Render/count a category if it has
  **≥1 live item in its subtree**, *whatever the category's status*. So a live
  item's category always shows — a soft-deleted/inactive category that still holds
  live items renders (item reachable); a category with 0 live items doesn't
  (phantom gone).
- **Classify RESPECTS status.** Only active/live categories are classification
  targets (already done — BE-00101). Dead categories can't collect *new* items.

This resolves both symptoms with **no cascade and no cleanup**: dead "Chairs"
renders because Banquet is live in it (no orphan); Lounge & Breakout hides because
it has 0 live items (no phantom). The status flag governs *what new items can bind
to*, never *what displays*.

(A reclassify UI — the v1 Index-tab port: subcat picker + tags + ✦ Suggest — is a
SEPARATE concern: it lets a user *correct* a bad classification. It is NOT needed
to prevent orphans, since this display rule already does.)

## What the fix must achieve (per TAXONOMY-01)
1. **One consistent query drives both** the rail counts AND the item list — a
   count must equal what actually displays when you click it.
2. **Recursive subtree rollup** — selecting a node returns every item in its
   subtree (macro → subcat → deeper), not just direct matches.
3. **Node visibility driven by live items, status ignored** (the decision above):
   a rail node appears iff it has ≥1 live item in its subtree, whatever its
   `is_active`/`deleted_at`; count = live items in its subtree; 0-item nodes don't
   appear. Scope: org for My Shop, global for the marketplace.
4. **Uncategorised items** (`subcategory_id = NULL`) — roll them up to their
   **parent category** for display (an "Other in F&F" bucket or listed at the
   macro level). Today they vanish, which is why F&F shows "No items" despite
   having 3 subcat-less items.
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
