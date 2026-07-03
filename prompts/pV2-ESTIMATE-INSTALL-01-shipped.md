# pV2-ESTIMATE-INSTALL-01 — install checkbox + 3-button footer (Project Quote)

QC iteration on the Project Quote / Estimate tab (Liam, 2026-07-03):
"if there is an installed cost assume they want it installed, display as a
check box (gray if there is no installed price). At the bottom 3 buttons,
Add more items (gradient), Message 2 Suppliers, Add more Suppliers."

## Shipped
**2026-07-03, chip `[Dev v2] v2.38`**

### What landed
- **Per-line Install checkbox** on each expanded quote line. Checked +
  enabled when the catalogue item has an install price; **greyed + disabled**
  when it doesn't. Install is **assumed on** by default — the checkbox lets
  the agent opt a line out.
- **Install feeds the Ballpark.** Opting a line in/out reloads the
  server-computed cascade (`est.reload()`), so the whole breakdown + headline
  update. The one cascade (services/estimate.js) still owns the math.
- **Card ↔ Estimate stay single-sourced.** The card's subtotal now also
  includes install-by-default, so `card.ballparkCost == estimate.clientTotal`
  at the default (verified: £527,440.32 both). Opt-outs are in-session only —
  the card shows the default all-installed Ballpark.
- **3-button footer:** **Add more items** (gradient → Marketplace items mode),
  **Message N Suppliers** + **Add more Suppliers** when suppliers are picked
  (else **Add Suppliers**).

### Files
| File | Change |
|---|---|
| server/.../projects.service.js | card `quote_subtotal` +install; `getEstimate(…, uninstalledItemIds)` |
| server/.../routes/projects-v2.js | `GET /:id/estimate?uninstalled=<uuid,…>` |
| client-v2/.../core/projects/project.service.ts | `estimate(id, uninstalledItemIds)` |
| client-v2/.../pages/projects/project-estimate.component.ts | Install checkbox, install-aware lineCost, 3-button footer, `addItems` output, `.bp-check` |
| client-v2/.../pages/projects/project-detail.component.ts | `addItems()` → Marketplace items mode |
| client-v2/src/environments/environment.ts | chip → v2.38 |

## ⚠️ Needs your call — install is multiplied by quantity
`lineCost = (base + install) × qty` — this **matches the Final Quote tab**
(kept consistent on purpose). But it means a per-head line's install is
multiplied by the head count: **Bowl Food Dinner install £6,000 × 50 =
£300,000**, which pushed this project's Ballpark from ~£50k to **£527k**.
That reads wrong — installation is usually a **one-time per-line fee**, not
per-unit.

Two ways to go, your call:
- **(A) Flat per line** — `base × qty + install`. Sane for a one-off install
  fee. I'd change **both** the Estimate and Final Quote tabs together to keep
  them aligned (~10-min change).
- **(B) Keep × qty** — leave as-is; the £6,000-on-catering figure is just odd
  test data, real install-priced items are one-per-project structures.

I did **not** unilaterally change the already-QC'd Final Quote formula — say A
or B and I'll apply it in one commit.

## Iteration — delete/trash icon (chip v2.38a)
Added a **trash-2 icon button** to each quote line (right of the cost).
Removes the line via `removeQuoteItem` — optimistic drop from `rows`, revert +
toast on failure, then `est.reload()` so the Ballpark drops with it. Hover →
danger colour. Uses the already-registered `Trash2` icon.

## QC notes
(Liam)

## Chat audit
(chat)
