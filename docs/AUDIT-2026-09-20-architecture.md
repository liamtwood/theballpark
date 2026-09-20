# Architecture Audit — 2026-09-20 (the major change since v2.375)

**Date:** 2026-09-20 · **Method:** read-only, two-brain (CC synthesis + two independent survey agents: server + client) · **Reference:** WORKING_STANDARDS §"Audit Checklist — Architectural Anti-Patterns" (8 classes; caps 250 WARN / 400 ALARM).
**Scope:** the major change shipped since the last formal audit ([`AUDIT-2026-09-10-standards-architecture.md`](AUDIT-2026-09-10-standards-architecture.md), client-v2 @ v2.375): **pV2-PRICING-SSOT-01** (line-pricing SSOT) and **EP-00020** (tenant-isolation / RLS security infra), plus the store-item measure/volume + classification arc and the recent inbox/marketplace fixes. The Sept-10 baseline still holds for older client code and is not re-run here.

Report-local IDs are `AUD-NN`; existing tracker tickets are referenced by number, not re-litigated.

## Headline

The new **primitives are clean** — `owner-pool`, `request-context`, `with-transaction`, `authz.js`, `line-pricing.js`, `migrate-rls.js` are all small, single-purpose, and test-backed; the pricing SSOT genuinely eliminated the client's local line-formula mirrors (no surviving `base×qty`/tier math on a `QuoteLine`). The debt is in **how they're wired in**, in three clusters:

1. **Flip-safety gaps the SQL smoke can't see** (AUD-01, AUD-02) — GUC-setting is an opt-in allow-list that misses v2-used routes, and several services hand-roll `pool.connect()` without the org GUC. Both fail-closed (broken feature, not a leak) but break real v2 flows at the `DATABASE_URL` flip. **Verified live.**
2. **"Escape-RLS" + transaction standards are hand-applied and incompatible at the owner-pool boundary** (AUD-03…06) — the one mandated txn helper can't serve bootstrap paths, so 7+ sites hand-roll; audit attribution is lost on all owner-pool writes.
3. **Second pricing rules live outside the SSOT, hand-applied** (AUD-07…12) — client margin-markup, the install inverse, and component-row sums are each duplicated per consumer; the shared module's `.d.ts` is a hand-synced contract; there is **zero client-side test** of the pricing input mapping.

Plus the standing **behemoth** problem (pre-existing, now worse: `inbox-project.component.ts` at 1077 lines, 2.7× the alarm cap).

---

## Part 1 — Findings (ranked)

### AUD-01 (HIGH, flip-critical) — `requestContext` is an opt-in allow-list that omits v2-used routes
**Class #5 (allow-list when default-on is correct).** `requestContext` (pins a client + sets `app.current_org_id/user_id/is_admin` from the JWT) is mounted only via `v1Gate`, the two `/api/admin` mounts, and the v2 router. Other `/api` mounts have none. **Verified:** the v2 client calls two ungated ones — `/api/config` (4 sites) and `/api/ai` (3) — so post-flip they run with `app_current_org() = NULL` → `config` (own-org `orgs` join) denies/returns nothing; page-settings + any tenant-touching ai path break. The flip gate is the direct-SQL persona tests, which never exercise Express paths, so the gate passes while these break. (Estimates/messages/favourites/orgs = 0 v2 call sites — v1-only, lower concern.) **Fix:** invert — mount `requestContext` once after `authenticate` globally (no-op without `req.user`), explicit opt-out list (auth/onboarding/dev).

### AUD-02 (HIGH, flip-critical) — hand-rolled `pool.connect()` on the RLS pool doesn't set the org GUC
**Class #2 / #7.** `item.service.duplicate` (:252, sets only `current_user_id`), `project-item.service.js:158`, `taxonomy.service.js:397/:507`, `routes/brief.js:136/:264`, `routes/messages.js:101` each open a fresh `pool.connect()` (not the request-pinned client) with no org GUC. **Verified:** `duplicate` is the v2 `/store/items/:id/duplicate` route — post-flip its INSERT hits `items_insert WITH CHECK(org_id=app_current_org()=null)` → **denied**, even though "add item" (pinned-client path) worked in the smoke. Same-file proof of drift: `item.service.saveComponents` uses `withTransaction`; `duplicate` hand-rolls. **Fix:** route every RLS-pool txn through `withTransaction` (see AUD-05); ban raw `pool.connect()` in services.

### AUD-03 (MED) — `requestQuotes` runs its whole ~360-line body on the owner pool (over-broad RLS bypass)
**Class #7.** `taxonomy.service.js:1042` `const pool = ownerPool` shadows the module pool for the entire function. Only ~3 ops are genuinely cross-tenant (supplier-email reads; the `balls_transactions` ledger write). The rest — `project_items`/`messages`/`quote_requests` creation on the caller's own project — is ordinary tenant work RLS is meant to scope; running it as owner removes the DB backstop, leaving one route-level `assertOwnedByActiveOrg` as the only guard (the exact single-guard risk EP-00020 set out to kill). **Fix:** narrow owner use to the email read + ledger write; run the tenant writes via `withTransaction`, or the txn-local `app.is_admin='t'` elevation `materializeProposedItem` already models.

### AUD-04 (MED) — marketplace item-visibility is a duplicate source of truth (8+ definitions), already drifting
**Class #1.** `is_active AND approval_status='approved' (AND deleted_at IS NULL, AND kind…/parent_item_id…)` is hand-written at `marketplace.js:33-36,163-166,203+218,287-290`, `marketplace-suppliers.js:29(helper),43,83`, `item.service.js:414-415`, and a 4th copy as RLS `items_read` (migrate-rls.js:141). **Live drift:** the `/items` grid excludes components/child options; the supplier count queries (`marketplace-suppliers.js:43,83`) don't → rail counts over-count vs the grid they're meant to match (the same "counts vs list disagree" class the SELECT_CATEGORIES comment warned against). **Fix:** extract one `marketplaceItemVisibleSql(alias)` fragment (the `lineTotalSql` model); every marketplace query references it. (Related to BE-00117; the drift bug is distinct + fixable now.)

### AUD-05 (MED) — `withTransaction` is coupled to the RLS pool → forces the AUD-02/AUD-06 duplication
**Class #7.** `db/with-transaction.js:24` hardcodes `pool.connect()` and takes no pool arg, so the one mandated helper structurally can't serve owner-pool multi-write paths (onboarding, balls, requestQuotes) — each hand-rolls BEGIN/COMMIT. **Fix:** `withTransaction(fn, { pool = rlsPool })` (or export `ownerTransaction`); then "no raw BEGIN in services" becomes enforceable everywhere.

### AUD-06 (MED) — audit attribution is lost on every owner-pool write
**Class #2.** `db/owner-pool.js` has no ALS-aware `query` wrapper (unlike `pool.js`), so onboarding org+membership, team-invite stub, OAuth user upsert, the balls ledger, and the whole RFQ stamp `created_by/updated_by = NULL` — the identity/financial rows you'd most want attributed. **Fix:** give owner-pool the same ALS-aware wrapper (or a shared `attributedQuery`).

### AUD-07 (MED) — client margin-markup is a second pricing rule, hand-applied outside the SSOT
**Class #1 + #2.** `markup = 1 + (marginPct||0)/100` is re-declared in `project-quote-rail:126`, `project-estimate:517`, `quote-document:478`, then `lineCost(l)*markup()`/`unitPrice(l)*markup()` hand-written at ~8 display sites. The module is pure cost by design, so "client price = cost × (1+margin)" has no single home. Customize already rounds it differently (`revisedFromParts`) than the display path → surfaces can disagree by £1. **Fix:** `clientUnitPrice(l,marginPct)`/`clientLineTotal(l,marginPct)` wrappers in `quote-line.util.ts`; ban bare `* markup()` in templates.

### AUD-08 (MED) — `@ballpark/line-pricing` sharing: hand-synced `.d.ts` + undeclared build coupling
**Class #1.** The module contract exists twice — `line-pricing.js` + a hand-maintained `line-pricing.d.ts` ("keep in step"). The golden test asserts JS==SQL (both server-side); it never exercises the client bundle or the `.d.ts`, so adding a field to the `.js` and forgetting the `.d.ts` = the client silently computes old behaviour, uncaught. Build coupling: the tsconfig alias escapes to `../server`, undeclared in any workspace — a `client-v2`-only build/CI context fails hard. **Fix:** promote to a real workspace package (`packages/line-pricing`, types emitted from JSDoc via `tsc --emitDeclarationOnly`); stop-gap = a build assertion that the import resolves + a note that the `.d.ts` is unguarded.

### AUD-09 (MED) — no client-side test of the pricing wrappers / input mapping
14 spec files; none reference `lineCost`/`unitPrice`/`lineTotal`/`line-pricing`/`priceTiers`; no spec under `pages/projects/`. The server golden test proves the *formula*; the *client-specific* logic is the **input mapping** (`pricingInput`'s `negotiated→priceCurrent`, `honourFlat`), and it's entirely unasserted — a regression of SSOT rule 2a (feed tiers on a negotiated line) fails nothing. **Fix:** `quote-line.util.spec.ts` asserting the mappings against fixtures, mirroring the golden cases.

### AUD-10 (MED) — golden test binds only 3 enumerated surfaces; parity not structurally guaranteed
**Class #4.** `line-pricing.golden.test.js` hard-codes `estimate`/`revised`/`original`. The two impls' tier-gating differs structurally (SQL includes the tier branch only when `base` is passed; the JS module considers `priceTiers` whenever current/ref are null). A new caller with `base+ref` / `current`-only / tiers-on-a-ref-surface exercises an untested combination and could diverge silently. **Fix:** drive the matrix from the actual production arg-sets + a guard that fails if a call site uses an arg-shape absent from the matrix; document the tier-gating asymmetry at both functions.

### AUD-11 (MED) — install-inverse + component-row sums duplicate shared formulas
**Class #1/#4.** (a) `inbox-project.rateForLineTotal` (:543) hand-inverts `lineCost`'s install switch to back-solve a rate — a new `installUnit` basis added to the module + SQL + golden test wouldn't reach it. (b) The component "Σ included cost×qty" is copy-pasted across **5** files with **divergent inclusion guards** (`customize-dialog:490`, `custom-line-dialog:283`, `agent-rail:716`, `shuttle:156`, `inbox-project:843`) → the same composition totals differently per surface. **Fix:** move the inverse beside the forward formula (or a round-trip test); extract `componentsCostTotal(rows, predicate)` into `quote-line.util.ts`.

### AUD-12 (LOW) — duplicate "declined?" + duplicate ALS identity, minor drift smells
- Inbox declined predicate written two ways: `inbox-project:507` `startsWith('declined')` vs `inbox-status.ts:82` explicit OR — a new `declined_*` code is caught by one, missed by the other. Extract `isDeclinedInboxStatus()` (the inbox analogue of the good `isDeclined`/`isDeclinedSql` pair). **Class #1/#6.**
- Two ALS identity owners: global `user-context.js` (spoofable `x-bp-user-id` header) still coexists with `request-context` (JWT). Vestigial post-EP-00020; retire once AUD-01 makes `requestContext` global (rollout step 6). **Class #1/#3.**

### AUD-13 (LOW) — RLS behavioural tests skip pre-flip + cover a subset of archetypes
`rls-personas`/`rls-auth-bootstrap` `t.skip` unless `WEB_APP_DATABASE_URL` set; `rls-coverage` proves grant==policy but not correctness. Persona matrix exercises only `items`/`projects`/`project_items`/`orgs` — untested: the `VIA_PI` junctions, `estimate_items`, `project_item_suppliers`, `user_orgs` anti-self-escalation, the INSERT-only `feedback`/`guestlist_signup`, `supplier_item_tag`, `orgs_public`. **Fix:** extend the matrix; add ≥1 route-level RLS integration test (also closes the AUD-01 blind spot).

### AUD-14 (LOW, data-quality) — store-item tier bands unvalidated
`item-edit.component.ts:540-549` writes `price_tiers` with the correct shape (read/write match — no key mismatch) but no `min<max` / overlap / order check. The module resolves overlaps ("highest matching min wins"), so no crash, but contradictory bands price surprisingly. **Fix:** validate/sort on save.

---

## Part 2 — Standing 8-class checklist scan (merged)

- **#1 Duplicate source of truth** — FOUND: marketplace-visibility predicate 8+ copies, drifting (AUD-04); client margin-markup 3 defs (AUD-07); `.d.ts` hand-synced contract (AUD-08); component-sum 5 copies + install-inverse (AUD-11); inbox declined 2 ways + 2 ALS identity sources (AUD-12). *Good example handled right:* the `isDeclined`/`isDeclinedSql`/`DECLINED_STATUS_PREFIX` trio.
- **#2 Shared standard, hand-applied** — FOUND: `withTransaction` mandated but hand-rolled 7+ sites (AUD-02); owner-pool "escape RLS" hand-applied across 7 modules with 3 different mechanisms + `pool`/`ownerPool` name-rebinding that hides RLS scope from a reader (AUD-02/03/06); `* markup()` at ~8 sites (AUD-07); 3 hand-built `LinePricingInput`s.
- **#3 Overloaded token/key** — MINOR: the ALS store has three writers / two identity sources (AUD-12). Otherwise none.
- **#4 Behavioral drift across structural reuse** — FOUND: golden test binds 3 surfaces but tier-gating differs (AUD-10); project-estimate applies markup two ways (row component vs inline option rows); category-card totals reconstructed vs server headline (rounding).
- **#5 Allow-list when default-on** — FOUND, the central flip risk: `requestContext` opt-in per mount, misses v2 routes (AUD-01). *Acceptable allow-list:* `grantedTenantTables()` — backstopped by the coverage test + fail-closed.
- **#6 Read/write key mismatch** — none active. GUC names + `price_tiers`/`installed`/`flatTotal` write→read→module all agree. Latent: GUC names + storage keys not centralized as typed constants.
- **#7 Container-coupled logic** — FOUND: `withTransaction` hardcoded to the RLS pool (AUD-05); `requestQuotes` privilege coupled to running the whole function on owner (AUD-03).
- **#8 Mutating affordance in read-only context** — none found in the audited server/client surface (BE-00104 already closed; authz + RLS write policies are the server-authoritative gate).

---

## Behemoth files (>400 ALARM)

**Server** (excl. tests/one-shot seeds): `migrate-schemas.js` 2686 (BE-00095), `taxonomy.service.js` 1614 (BE-00112), `projects.service.js` 1348, `inbox.service.js` 847, `project-item.service.js` 449, `item.service.js` 434, `routes/projects-v2.js` 424. *New RLS infra is all small (owner-pool 46, request-context 49, with-transaction 49, authz 36) — well-decomposed.*

**Client:** `inbox-project.component.ts` **1077** (2.7×), `customize-dialog.component.ts` 872, `project-estimate.component.ts` 865, `agent-rail.component.ts` 723, `item-edit.component.ts` 591, `quote-document.component.ts` 495. First extraction: pull the inbox pricing/negotiate helpers into `inbox-line-pricing.util.ts` (also closes AUD-11a).

## Test coverage

Server: pricing golden test (good, but AUD-10 gap) + RLS coverage/persona/auth-bootstrap (skip pre-flip, subset — AUD-13). Client: **zero** pricing/mapping tests (AUD-09). No route-level RLS integration test (AUD-01 blind spot).

## Cross-refs

BE-00112 (taxonomy god-service — AUD, F8/behemoth), BE-00117 (API route standardization — AUD-04 related; + the client supplier-path inconsistency the peer flagged). Baseline: AUDIT-2026-09-10.

## Recommended sequence

1. **Before any further flip / preview rollout:** AUD-01 (requestContext default-on) + AUD-02/AUD-05 (pool-parameterized `withTransaction`, ban raw `pool.connect`) + one route-level RLS integration test.
2. Then AUD-06 (owner-pool attribution), AUD-03 (narrow requestQuotes), AUD-04 (visibility SQL fragment).
3. Pricing hardening: AUD-07 (markup wrapper), AUD-09 (client spec), AUD-08 (workspace package), AUD-10 (golden matrix from call sites), AUD-11 (extract sums/inverse).
4. Behemoth splits (inbox-project first) + AUD-12/13/14 as touched.
