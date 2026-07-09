# pV2-ESTIMATE-SINGLESOURCE-01 — one cascade for the "client total"

Kill the drift: the project "client total" (Ballpark) was computed in two
places with identical cascade logic. Consolidate to one server compute.
(Liam, 2026-07-03 — closes task_fa03ae45.)

## Shipped
**2026-07-03, chip `[Dev v2] v2.37`**

### The drift, before
1. **Server** `projects.service.js cardBallpark()` — inline `subtotal
   ×(1+cont)(1+margin)(1+VAT)`, feeds the agent project card's Ballpark.
2. **Client** `project-estimate.component.ts` — the same cascade in signals,
   feeds the Estimate tab headline + breakdown rows.

Two copies of the formula + the 10/20/20 defaults → they could diverge.

### The fix — "single server compute" (not persistence)
Chose the **compute-on-read** branch over a persisted `total_client_cost`
column. Persisting would need write-path fan-out across add / remove / qty /
rate-change **and** a migration, and would reintroduce exactly the staleness
class we're fixing (the existing `total_client_cost` is stale/0 for precisely
that reason). The subtotal is a cheap `SUM` subquery — computing on read is
always correct and needs no schema change.

- **NEW `server/src/services/estimate.js`** — `computeEstimate(subtotal,
  {contingencyPct, marginPct, vatPct})` returns the full breakdown; house
  defaults 10/20/20 when a rate is null. **The formula lives ONLY here.**
- **Card** — `cardBallpark()` now calls `computeEstimate(...).clientTotal`
  (keeps the null-when-unquoted behaviour at the card layer).
- **NEW `GET /api/projects-v2/:id/estimate`** → `projects.getEstimate()`
  returns the server-computed breakdown (subtotal from the live
  `SUM(qty × base_price)`, run through the one cascade).
- **Estimate tab** — deleted its client-side cascade signals; now consumes
  the server breakdown via an `est` resource. Qty edit stays optimistic on the
  line, then `est.reload()` pulls the authoritative totals (qtyCommit is
  once-per-edit, so one round-trip — fine).

### Verified
- Unit: `computeEstimate` == old inline math (65,480.98); null rates →
  10/20/20; subtotal ≤ 0 → 0.
- Live DB (project ea61cb60): `getEstimate().clientTotal` **50,022.72** ==
  `card.ballparkCost` **50,022.72** — exact match through the one function.
- `ng build` + server require both clean.

### Files
| File | Change |
|---|---|
| server/src/services/estimate.js | NEW — the one cascade |
| server/src/services/projects.service.js | cardBallpark uses it; +getEstimate; export |
| server/src/routes/projects-v2.js | +GET /:id/estimate |
| client-v2/.../core/projects/project.types.ts | +EstimateBreakdown |
| client-v2/.../core/projects/project.service.ts | +estimate(projectId) |
| client-v2/.../pages/projects/project-estimate.component.ts | consume server breakdown; delete client cascade |
| client-v2/src/environments/environment.ts | chip → v2.37 |

### Notes / not done
- **`projects.total_client_cost` stays deprecated** — still written only by
  the legacy v1 `project.service.js recalcTotals` (from v1 `project_categories`),
  unread by v2. Left as-is; a future checkout/priced-rollup (pV2-06f) can
  repurpose it as a real persisted snapshot if reporting needs it.
- **Final Quote tab is intentionally NOT on this cascade** — it shows RAW
  supplier costs (base + install, no margin/VAT), which is correct.

## QC notes
(Liam)

## Chat audit
(chat)
