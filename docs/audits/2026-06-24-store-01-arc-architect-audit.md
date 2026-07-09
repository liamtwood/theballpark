# pV2-STORE-01 — Angular/Node architect audit (2026-06-24)

> Independent read-only end-of-module audit (general-purpose architect agent,
> grounded in the angular-developer references + ENGINEERING.md/ARCHITECTURE.md
> + AUDIT_LEDGER risk patterns). Triage recorded in
> `prompts/pV2-STORE-01-shipped.md`. Audited at chip `[Dev v2] v2.34q`.

## Verdict

**Ship-with-fixes.** The arc is architecturally strong: authorization is correctly server-derived, `org_id` is never trusted from the body, the state machine is coherent across client and server, RP-06 is genuinely closed (all three `MarketplaceStore` consumers wire the shared filter band + `changed → reloadItems`), and the migration block is idempotent and guarded. **One real correctness bug (F-1): the `rejected` codelist value is seeded `is_active: false`, but the admin route writes `approval_status: 'rejected'` — so a rejected item's status pill loses its "Rejected" label, red colour and icon, falling back to the raw lowercase code on neutral chrome.** Everything else is LOW/MED hygiene or watch items.

## Findings

| ID | Sev | Category | Location |
|---|---|---|---|
| F-1 | **HIGH** | State machine / data-UI mismatch | `db/codelists-seed.js:102` + `services/codelist.service.js:68` |
| F-2 | MED | Bloat / Alarm cap | `store/item-edit.component.ts` (454), `routes/marketplace.js` (456) |
| F-3 | MED | Authorization status-code semantics | `routes/store-items.js:25,52,77` |
| F-4 | LOW | Reactivity smell (resource loader reads signals non-reactively) | `store/item-edit.component.ts:333-360` |
| F-5 | LOW | Dumb-card boundary widened | `catalogue/item-card.component.ts:167-285` |
| F-6 | LOW | Schema/types drift (stale "deferred" comments) | `core/store/store-item.service.ts:7-9` + schema |
| F-7 | LOW | Rule 10 — explicit body-size limit not set | `server/src/index.js:67` |
| F-8 | LOW | Currency symbol hardcoded, not codelist-driven | `store/item-edit.component.ts:322-326` |
| F-9 | LOW | `/store/items/:id` no error branch (blank form on 403) | `app.routes.ts:175` + item-edit template |

## Detailed findings

### F-1 — `rejected` status renders as raw code, not a styled pill — HIGH
**Where:** `server/src/db/codelists-seed.js:101-102`; data source `server/src/services/codelist.service.js:68-72`; consumers `status-pill.component.ts`, `item-card.component.ts:52`, `item-edit.component.ts:180`.
**What:** `item_approval_status` seeds `rejected` with `active: false` (comment: "No consumer writes 'rejected' yet"). No longer true — `admin-items.js` writes `approval_status: 'rejected'` on reject and the filter band offers a "Rejected" filter. The pill's only source is `GET /api/codelists/:list/values`, which filters `WHERE is_active = true`, so `rejected` is absent → the pill falls back to the raw lowercase code on neutral chrome (no red, no label, no icon).
**Why it matters:** A core moderation state ships with a broken pill.
**Fix:** Flip `rejected` to active. The seed upserts `ON CONFLICT DO NOTHING`, so an explicit `UPDATE ... SET is_active=true` (seed + live) is needed, not just removing the flag.

### F-2 — Two files over the Alarm cap — MED
**Where:** `item-edit.component.ts` = 454 (alarm 400); `marketplace.js` = 456 (alarm 300).
**What:** This arc landed on both. Ledger rule: Alarm requires extraction before the next ship on that file.
**Fix:** `marketplace.js` → split the `/suppliers*` endpoints into `routes/marketplace-suppliers.js` (mirror the favourites split). `item-edit.component.ts` → extract the right-hand "Image Approval Process + Status" aside and/or the form-row block.

### F-3 — Owner endpoints return 403 (not 404) for another org's item — MED
**Where:** `routes/store-items.js:25` (GET/:id), `:52` (PUT), `:77` (`ownItemOr`).
**What:** Cross-org reads return 403 "Not your item" — an existence oracle. Rule 10: "fetch another org's resource by id returns 404 (not 403)."
**Fix:** Collapse the not-owned case into 404. (UUIDs aren't guessable, so low blast radius — but it's a named Rule 10 deviation.)

### F-4 — `resource()` loader branches on `isModerator()/isViewer()` non-reactively — LOW
**Where:** `item-edit.component.ts:333-360`. `params` tracks only `itemId`; mode signals read inside the async loader aren't reactive deps. **Safe today** (mode is stable for the page lifetime — role/org switch reloads the app; `?view` change re-navigates). Latent, not active.
**Fix:** Comment the stability assumption, or fold mode into `params`.

### F-5 — item-card injects Router + StoreItemService + ConfirmService + AuthService — LOW (note)
**Where:** `item-card.component.ts`. The card is no longer purely presentational. Acceptable (mutations are row-local; `changed` keeps the host responsible for refresh; all three hosts wire it). Note for the next consumer: the `(changed)` wiring is the thing to check.

### F-6 — Stale "deferred" comments contradict the shipped fields — LOW
**Where:** `core/store/store-item.service.ts:7-9` and `schemas/store-item.schema.js:4-6` both say install_cost/location_coverage/included_services are "deferred / no columns yet" — they're present now.
**Fix:** Delete the stale sentences.

### F-7 — No explicit `express.json({ limit })` — LOW
**Where:** `server/src/index.js:67`. Default 100kb (bounded, so no active risk). Rule 10 wants an explicit limit.
**Fix:** `express.json({ limit: '1mb' })`.

### F-8 — Currency symbol hardcoded, bypassing the currency codelist — LOW
**Where:** `item-edit.component.ts:322-326`. `currencySuffix()` maps GBP/USD/EUR via ternary; the `currency` codelist already carries `symbol` as data. Non-GBP/USD/EUR suppliers see the raw code.
**Fix:** Resolve symbol from `codelists.list('currency')`. Defer if multi-currency suppliers aren't in scope.

### F-9 — `/store/items/:id` has no error branch (blank form / spinner on 403) — LOW
**Where:** `app.routes.ts:175` + item-edit template. Server enforces (403 on non-owned), but the template has no `error()` branch → a hand-typed/stale non-owned URL shows a blank editable-looking form. Normal path is safe (card always appends `?view=1` for non-owned).
**Fix:** Add an `@else if (itemRes.error())` not-found/no-access branch (mirror supplier-detail).

## Risk-pattern re-check
- **RP-01 (cold-path latency):** clean — owner/admin filters are added WHERE clauses, no extra round-trips; single-query `COUNT(*) OVER()`.
- **RP-04 (inline arrays mirroring a codelist):** new-instance (LOW) — `statusOptions` in filter-band + the F-8 currency ternary mirror codelists (display-side; the status filter is functional). Candidate `item_approval_status`/`item_tier` codelist options.
- **RP-05 (component-local `.bp-*`):** clean — only BEM-element/non-semantic local utilities + tokens.
- **RP-06 (feature misses /suppliers Store tab):** **clean — genuinely closed.** All three MarketplaceStore consumers mount the shared filter band (status/active gated by `showStatusFilters()`) and wire `(changed)="reloadItems()"`.
- **RP-09 (literal hex in codelist meta):** clean — `item_approval_status` uses token refs.

## Bloat watch
| File | Lines | Cap | Status |
|---|---|---|---|
| `store/item-edit.component.ts` | 454 | 250/400 | Over alarm (F-2) |
| `routes/marketplace.js` | 456 | 200/300 | Over alarm (F-2) |
| `services/item.service.js` | 293 | 200/350 | Warning |
| `marketplace-store.ts` | 280 | 250/400 | Warning |
| `catalogue/item-card.component.ts` | 286 | 250/400 | Warning (97 → 286 this arc) |
| `routes/store-items.js` | 120 | 200/300 | OK |
| `routes/admin-items.js` | 47 | 200/300 | OK |

## Architecture conformance (verified)
- ✓ `org_id` from `req.user` only (`.strip()` drops body org_id).
- ✓ Non-owner/non-admin cannot see draft/pending/rejected/inactive (`ownerScope`/`adminScope` gates; else forced active+approved).
- ✓ Public `GET /items/:id` returns approved+active only.
- ✓ Rule 4 — `adminScope` reads `req.user.role`, overwritten with live DB truth by `requireActiveMembership` before handlers run.
- ✓ Approved-edit lock (409) + activate-requires-approved (409) — both layers.
- ✓ Approve sets approved + inactive; supplier activates separately.
- ✓ Supplier may only set draft|pending; admin approved|rejected — enforced both layers.
- ✓ Migration idempotent + guarded rename; currency COALESCE to org default; no dangling max_price/min_price in runtime code.
- ✓ Cache: every mutation taps `catalogue.invalidate()`; all grids `reloadItems()` on `changed`.
- ✓ Confirm infra mounted once in shell; pTemplate-inside-@if fix present.
- △ `duplicate()` hand-rolled transaction (Rule 1 prefers `withTransaction`) — documented, GUC correctly re-established; minor accepted deviation.
- ✗ Rule 10 — 403 not 404 cross-org (F-3); explicit body limit unset (F-7).
