# BE-00105 — Client line-total ignored volume tiers (mirror drift)

**Shipped:** 2026-09-19, chip `Dev v2.487`, commit `77c97a07`. **Owner:** CC (f2).
Logged by ballpark-11 (Bug, P2). Root cause diagnosis was theirs; fix is CC's.

## Root cause
The estimate line total is computed **client-side** — `quote-line.util.ts`
`lineCost()`, a hand-mirror of the server `LINE_TOTAL_SQL`. v2.485 added the
volume-tier branch to the **server** util (`line-total.util.js:28-37`) but not to
this client mirror, so the browser kept pricing `base × qty`; the qty stepper
recomputes locally and never reaches the server, so tiers never applied. The
`QuoteLine` DTO also had no `priceTiers` field — the client wasn't even sent the
tiers. (Anti-pattern #1 drift: a duplicated formula where only one copy moved.)

## Fix
**Server** (`projects.service.js`)
- `QUOTE_LINE_JOIN` selects `i.attributes -> 'price_tiers' AS price_tiers` —
  **live** item attributes, matching how the SQL tier read works (not
  snapshotted onto project_items). Null for custom lines (no item join).
- `toQuoteLine` maps `priceTiers: row.price_tiers ?? null`.

**Client**
- `project.types.ts` — new `PriceTier {min,max,price}` + `QuoteLine.priceTiers`.
- `quote-line.util.ts` — `unitPrice(l)` = the matching tier at the current qty,
  else base; `tierPriceFor()` picks the band containing qty (max null = open top,
  highest matching min wins) — mirrors `line-total.util.js:28-37`. `lineCost()`
  now uses `unitPrice()`. **Both files carry a KEEP-IN-SYNC note** pointing at
  each other so the mirror can't silently drift again.
- Per-unit **displays** switched to `unitPrice` so `unit × qty` reconciles with
  the tiered total: `estimate-item-row.displayUnit`, `quote-document` rate column
  (+ `unitRate` helper), `project-estimate` option rows (+ `optUnit` helper).
- `project-quote-rail` indicative subtotal now routes through `lineCost()` — it
  was a **second** client mirror doing raw `base × qty`, ignoring install *and*
  tiers (fixed in passing).

## Scope checks (other client-side totals)
- **customize-dialog** — its running total is the component **buildup** sum
  (`rows × cost × qty` + margin via `revisedFromParts`), NOT a `lineTotalSql`
  mirror. Volume tiers are marketplace list-pricing on the parent item, not the
  supplier's buildup component costs → no tier drift. Left as-is.
- **estimate-breakdown** — server-driven (consumes the cascade), no client
  line-total. No change.
- **inbox Original/Revised** — server-computed via `message-item.service`
  (`lineTotalSql`); already tier-aware. No change.

## Acceptance
- [x] Estimate line total applies the tier by qty; qty stepper re-prices live.
- [x] Verified vs QC line (Limewash, project a5af6593): qty 101 → 2.99 → £301.99
      ×1.2 = **£362.39**; qty 50 → 3.40 → **£204.00** (server join confirmed it
      now returns price_tiers to the client).
- [x] Per-unit displays reconcile with tiered totals across estimate, quote doc,
      options.
- [x] Build clean; server nodemon reloaded (PID confirmed).
- [~] Liam QCs on localhost.

## Flag for ballpark-11 / Liam (precedence question, NOT fixed here)
The mirror is faithful to the server: `COALESCE(tierPrice, base)` — a matching
tier **overrides** the base, including a **negotiated** `price_current`
(server `lineTotalSql` does the same via `COALESCE(tierPrice, price_current)`).
So on a tiered item, the inbox "New cost" negotiation preview
(`inbox-project.ts:903`, `lineCost({...line, basePrice:newRate})`) shows the tier
price, not the supplier's typed rate — because the server would too on save.
If a *negotiated* per-unit should win over list tiers, that's a shared
server+client precedence change (flip to `COALESCE(price_current, tierPrice)` or
gate tiers to un-negotiated lines) — a separate ticket, not mirror drift. Left
consistent for now.

## QC notes
(Liam)

## Chat audit
(chat/0d/ballpark-11)
