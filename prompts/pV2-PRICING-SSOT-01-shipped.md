# pV2-PRICING-SSOT-01 — One bulletproof place for line pricing (SHIPPED)

**Shipped:** 2026-09-19, chip `Dev v2.488`. **Owner:** CC (f2). Greenlit by Liam
(relayed via ballpark-11). Bundles **BE-00105** (already fixed v2.487, re-based
on the module here) and **BE-00106** (qty from cart) as Part E.

## End state
- **1 canonical module** — `server/src/services/line-pricing.js` (pure CommonJS
  + `line-pricing.d.ts`). `effectiveUnitPrice()` / `lineTotal()` = Part A.
- **Client imports it directly** — `@ballpark/line-pricing` tsconfig path alias
  (`allowedCommonJsDependencies` in angular.json); `quote-line.util.ts` is now
  thin wrappers (`unitPrice`/`lineCost`) over it. No hand-rolled copy remains.
- **1 SQL translation** — `line-total.util.js` `lineTotalSql`, kept only for
  set-based queries, headered "MECHANICAL MIRROR … do not edit without the
  module + golden test."
- **1 golden contract test** — `line-pricing.golden.test.js` runs the module and
  the SQL over a 20-case matrix and asserts equality (DB-backed; skips only if
  no DIRECT_URL). **21/21 green**; full server suite **69/69**.

## Sharing mechanism (CC's call — why this one)
Server runs `node --test` (plain CommonJS, no TS, no build) and deploys from
`server/`. So the canonical file is a **CJS `.js` under `server/`** (present at
server runtime; the golden test require()s it). The client **bundles it at build
time** via the path alias (types from the `.d.ts`; esbuild inlines the `.js`), so
the client deploy needs nothing extra. One physical implementation, three
consumers (client bundle, server require, golden test) — zero copies to drift.

## Part A — the definition (with the 2a change, confirmed by Liam)
Effective per-unit precedence — a human price wins over the guide; a tier only
ever modifies the guide base:
`priceCurrent (negotiated) ?? priceRef (briefed/Original) ?? tierUnit(guide) ?? base`
then `× qty` + install (per_order flat / percentage of base / per_item × qty);
`flat_total` overrides on flat-honouring surfaces. Tiers are reachable ONLY when
both priceCurrent and priceRef are null — the pure guide/estimate case.

**Behaviour changes (both server + client, golden-verified):**
- **2a** — a negotiated `price_current` now SUPPRESSES list tiers (was
  `COALESCE(tier, price_current)` → tier wrongly won).
- **2b** — the inbox **Original** (`price_ref`) no longer re-tiers over the
  frozen brief (`message-item original_total`). Fixed.
- **No change** on non-tiered, non-negotiated lines (golden anchors + matrix).

## Part D — consumer enumeration
**Server (SQL mirror, golden-covered):** `line-total.util.js` (rewritten to named
args `{current,ref,base,flat}`; tier considered only when a guide `base` is
supplied); callers updated — `projects.service` `LINE_TOTAL_SQL`
(`{current:price_current, base:base_price, flat}`), `inbox.service` `quote_total`
(`{current,ref,flat}`), `message-item.service` `original_total` (`{ref}` — no
tier) + `revised_total` (`{current,ref,flat}`). `projects.service` quote-line now
also returns `negotiated` (price_current IS NOT NULL) + `flat_total` +
`price_tiers` so the client wrapper can apply 2a.
**Server single-line:** `lineById`/`toQuoteLine` return the raw columns; the total
is computed by the shared module (client) — the module is exercised server-side
by the golden test (the oracle). No route hand-rolls a total.

**Client (now via the module):** `quote-line.util.ts` (wrappers),
`estimate-item-row`, `project-estimate` (options), `quote-document`,
`project-quote-rail` (subtotal), `inbox-project` (`lineTotalAt` + the New-Cost
preview passes `negotiated:true` so a typed rate isn't tier-overridden),
`agent-rail` (`reseedTotal` → module; dropped local `withInstall`).
**Verified-inherits (call `lineCost`):** `line-preview`, `estimate-preview-rail`.
**Server-driven (no local total):** `sow-document`, `estimate-breakdown`,
`item-preview` (total is an input), `line-editor` (no total).
**Excluded (component buildup, not a line-total mirror):** `customize-dialog`,
`custom-line-dialog`, `inbox-project`:828 — supplier-entered component costs, not
catalogue list pricing; tiers don't apply. Confirmed.

## Part E — line-update id contract (BE-00106)
The one key for every per-line mutation is **`project_items.id`**.
- Finding: the SERVER already keyed BOTH `PATCH` and `DELETE /items/:id` by the
  row id (`updateItem`/`removeItem` — `WHERE id = $2`). The peer's note that
  DELETE keyed by item_id was outdated; **no server change needed**.
- Client fix: `project-quote-rail` now emits `l.id` for `qtyChanged` (was
  `l.itemId` → the 404 "Item not in quote", BE-00106) AND for `removed`;
  `onQtyChange` matches optimistic on `l.id`; new `onRemoveLine(rowId)` deletes by
  row id. The marketplace CARD toggle (`onQuoteToggle`, item_id space) now
  RESOLVES item→row before delete — which also fixes a latent silent no-op
  (card-remove was passing item_id to the row-id endpoint). Contract named in
  `project.service` (`setQuoteItemQuantity`/`removeQuoteItem`).

## Acceptance
- [x] One canonical module; `quote-line.util.ts` thin wrappers; no other client
      base×qty/tier logic (grep clean; buildup sums excluded + recorded).
- [x] SQL kept for set queries only, headered as a mechanical mirror.
- [x] Golden test asserts SQL == module across the matrix; fails on divergence
      (21/21; full suite 69/69).
- [x] 2a precedence identical on server + client (golden `negotiated` case;
      client passes `negotiated`).
- [x] BE-00105 preserved: qty 1 → £3.75, 50 → £204, 101 → £362 (~20% margin;
      golden anchors raw 3.75 / 170 / 301.99).
- [x] BE-00106 fixed: cart qty change succeeds (rail emits row id); estimate tab
      unchanged.
- [x] No behaviour change on non-tiered/non-negotiated lines; no new columns.
- [x] Client build clean; server tests green.
- [~] Liam QCs end-to-end on localhost.

## Not built (flagged, per spec)
- Whole-deal total override (2k+3.6k+5k for 8k) — deal-level, above per-line;
  the module does NOT assume line totals sum to the quote total. Roadmap.

## QC notes
(Liam)
**QC pass 1 (Liam, 2026-09-19, v2.488).** Marketplace read-only confirmed (own
item view-only, click = read-only, pencil = edit — BE-00104). Cart qty→101 saves
(BE-00106). Tier math verified end to end: qty 101 @20% = £362; @0% = £302; qty
100 = £299 (100+ band); qty 49 = £184 (1–49 band). All correct.
Two issues raised → fixed in **v2.489**:
1. Clicking the qty field on the Ballpark Cost row opened the item preview — the
   qty control's click bubbled to the row's `select`. Added
   `(click)="$event.stopPropagation()"` on `<app-qty-input>` (estimate-item-row;
   defensively on the cart rail too).
2. The Project Quote cart rail showed unit price + qty but no per-line total.
   Added a marked-up, tier-aware per-item total (`railTotal` = lineCost × markup)
   and made the unit tier-aware (`railUnit` = unitPrice × markup) so unit × qty
   reconciles and the items sum to the marked-up headline Subtotal.

**QC pass 2 (Liam, 2026-09-19, v2.490).** Clicking the "Installed?" checkbox on a
Ballpark Cost row opened the item preview (whole-row click). Per Liam: only the
**name + image** should open the item. Removed the host row `(click)` +
`cursor-pointer`; the image and name are now the open affordance (click + Enter,
role=button, aria-label). Controls (qty, Installed?, remove) no longer open the
preview. (Also confirmed the £250/£350/£600 line was correct — goods + install;
labelling left as-is.)

## Chat audit
(chat / ballpark-11)
