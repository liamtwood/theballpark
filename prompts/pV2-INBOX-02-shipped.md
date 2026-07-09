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

## Slice 3 — final quote + "Message suppliers" + rail roster

**Shipped:** 2026-06-25, chip `[Dev v2] v2.35b`

### What landed
- The Quote rail now lists the **picked suppliers per category** (removable
  chips) under each category band — sourced from the ephemeral roster. The
  store gained name tracking (`RosterSupplier`, `pickedFor`, `nameOf`).
- The rail's **"See Final Project Quote"** CTA now navigates to the
  **Estimate** tab (was a stub toast).
- The Estimate IS the final quote view: when the roster has suppliers, the
  forward CTA becomes **"Message N suppliers"** (+ a secondary "Add more
  suppliers" → back to the fan-out); with no picks it stays "Go with this
  Ballpark". `messageSuppliers` output is stubbed in project-detail (a
  toast) — the gated send is **slice 4**.

### Files touched
| File | Notes |
|---|---|
| client-v2/.../projects/project-outreach.store.ts | name tracking + `pickedFor`/`nameOf`; `toggleSupplier` takes `{id,name}` |
| client-v2/.../projects/project-quote-rail.component.ts | per-category supplier chips (remove) |
| client-v2/.../projects/project-marketplace.component.ts | pass name on toggle; rail CTA → Estimate tab |
| client-v2/.../projects/project-estimate.component.ts | "Message suppliers" CTA + `messageSuppliers` output |
| client-v2/.../projects/project-detail.component.ts | wire `messageSuppliers` (stub toast) |
| client-v2/src/environments/environment.ts | chip → v2.35b |

### Acceptance
- Add suppliers in the fan-out → chips appear per category in the rail,
  removable. ✓ (Liam to QC)
- "See Final Project Quote" → Estimate tab. ✓
- Estimate shows "Message N suppliers" when picks exist, else "Go with this
  Ballpark". ✓
- v2 build clean. ✓

### Iteration — v2.35c (2026-06-25)
**Triggered by QC (Liam):** (1) "Add to Quote" should be disabled once a
supplier is already in the quote; (2) leaving the project and returning
cleared the picks.
- (1) The card CTA is now an inert **"Added to Quote"** state
  (cursor-not-allowed + dimmed); re-clicking does nothing. Removal is via
  the Quote rail chips only — so a stray click can't toggle a supplier back
  off.
- (2) `ProjectOutreachStore` is now **`providedIn: 'root'` keyed by
  projectId** (was provided at project-detail, so it died with the
  component). project-detail points it at the active project via an effect.
  Picks now survive leaving and returning to a project within the session;
  a hard reload still clears (the DB-persistence follow-up covers reload
  survival).

### Iteration — v2.35d (2026-06-25)
**Triggered by Liam:** adding an item should enlist that item's supplier.
- Adding an item to the quote (Items mode `+`) now also adds its supplier to
  that item's category roster — via a new **idempotent `addSupplier`** (a
  second item from the same supplier never toggles them off). The
  `CatalogueItem` carries `supplierId`/`supplierName`/`categoryId`, so no
  extra fetch. The supplier-card add path uses `addSupplier` too; the unused
  toggle method was removed.

## Slice 4 — gated send (`POST /api/inbox/send`) — the producer

**Shipped:** 2026-06-25, chip `[Dev v2] v2.35f`

### What landed
- **`POST /api/inbox/send`** (gated v2 inbox router): the agency fans a
  project's quote out to the picked suppliers. org is the JWT caller; the
  service verifies it **owns the project** before any write (RP-INB1). One
  thread per **(category × supplier)**, seeded `brief_sent` message_items +
  events + quote_requests + the outreach email.
- **Max reuse:** `inbox.service.sendOutreach` builds per-category
  requirements from `project_items` and calls v1's `requestQuotes` — with a
  new **`skip_balls`** flag (no Balls economy in v2 yet; emails kept).
  `messages.category_id` FKs to `project_categories`, so the service
  resolves (or lazily creates) that row per category to keep threads keyed
  per category.
- **"Message suppliers"** now calls it: on success the ephemeral roster
  clears, a success toast reports `N threads across M categories`, and the
  categories flip to `out_for_quote` server-side. Those threads surface in
  the supplier's Inbox (INBOX-01 reader) — **end to end**.

### Files touched
| File | Notes |
|---|---|
| server/src/services/taxonomy.service.js | `skip_balls` flag (balance check / debit / return guarded) — v1 callers unchanged |
| server/src/services/inbox.service.js | `sendOutreach` + `resolveProjectCategoryId` |
| server/src/routes/inbox.js | `POST /send` (Zod) |
| client-v2/.../core/inbox/inbox.service.ts | `send()` + payload types |
| client-v2/.../projects/project-outreach.store.ts | `rosterPayload()` |
| client-v2/.../projects/project-detail.component.ts | real `onMessageSuppliers` (send + clear + toast) |
| client-v2/src/environments/environment.ts | chip → v2.35f |

### API audit — `POST /api/inbox/send`
- ✓ HTTP method semantics — POST, creates threads (201)
- ✓ Input validation — Zod (projectId uuid; roster: ≥1 category, each ≥1 supplier uuid)
- ✓ Authorization — gated router (authenticate + active membership); service verifies `project.org_id === req.user.org_id` (RP-INB1, no client org). Supplier callers can't match a project they own → 404.
- ✓ Status codes — 201 / 400 / 404 (not-found AND not-owner both 404, no existence disclosure) / 401·403 from middleware
- ✓ Response shape — `{ categories, threads, results[] }`
- ✓ Information disclosure — not-owner is 404, identical to not-found
- ✓ Observability — errors flow to the central handler; email failures are fire-and-forget logged (v1)
- N/A Idempotency — re-sending re-creates threads (v1 `requestQuotes` is idempotent only on the "new" item upsert, not the message); see concern below
- ✓ Performance — one query for items, then one `requestQuotes` txn per category (small N)

### Concerns not in spec
#### Per-category atomicity (no all-or-nothing across categories)
**Where:** inbox.service.js `sendOutreach`
**What:** each category's `requestQuotes` is its own transaction (v1 opens
its own BEGIN/COMMIT). If category 3 of 5 fails, 1–2 already committed —
partial send. Acceptable for MVP (categories are independent); the user can
re-send the rest.
**Severity:** LOW

#### No idempotency / double-send guard
**Where:** `POST /api/inbox/send`
**What:** clicking "Message suppliers" twice (or re-entering and sending
again) creates duplicate threads — there's no "already sent" guard. The
roster clears on success, which mitigates the immediate double-click, but
nothing stops a second deliberate send.
**Suggested fix:** dedupe on an existing open thread per (project, supplier,
category), or disable send once `out_for_quote`. Deferred.
**Severity:** MEDIUM

#### Outreach emails fire on send (env-gated)
**Where:** v1 `requestQuotes` email loop, `QUOTE_REQUEST_EMAILS_ENABLED=true`
**What:** a send emails each supplier org's stored address (Liam wants
emails kept). On the shared preview/prod DB, QC sends will email whatever
addresses those supplier orgs carry. **QC note for Liam:** confirm the test
supplier orgs have safe addresses before sending to a real one.
**Severity:** LOW (intended behaviour, flagged for QC awareness)

## QC notes
(Liam)

## Chat audit
(chat)
