# Architect audit — Projects + Quantity + Recommend arc (v2.22 → v2.28)

**Date:** 2026-06-15
**Scope:** the unaudited surface since the dialogs audit (2026-06-13) — the projects list/detail/estimate/marketplace, the quote rail + qty-input, the quantity/serves/recommend backend, card-grid alignment, the category snapshot, and the quote add/undelete fix.
**Method:** two independent read-only auditors (general-purpose agents) — one Angular-21 client rubric (ENGINEERING §5 + signal/resource idioms), one server hygiene rubric (ENGINEERING rules 1–10 + anti-pattern checklist). Run via the `angular-developer` skill standards.

## Verdicts

- **Client:** no HIGH findings. Standalone + OnPush + `inject()` + `input()`/`output()` + `host:` everywhere; zero `@Input`/`@Output`/`EventEmitter`, `*ngIf`/`*ngFor`, raw `.subscribe()`, `any`, or raw colours. All 10 hygiene rules + v2 component standards satisfied. Findings are MEDIUM/LOW robustness/correctness. Called out as exemplary: the qty-input `linkedSignal` draft + mousedown-preventDefault race-dodge; the optimistic-update discipline (snapshot → mutate → revert → toast) across marketplace + estimate; the projects-new create→recommend error handling.
- **Server:** architecturally clean — `org_id` discipline flawless (every service fn takes `orgId`, every route uses `req.user.org_id`, schemas never accept it), no logic/SQL in routes, all queries parameterised, migrations idempotent, the `addItem` soft-delete **revive is race-safe** (`SELECT … FOR UPDATE` on the (project,item) row). Two HIGHs, both infra-adjacent (recommend pool fan-out; the pool connect-handler deprecation warning).

## Triage

### Fixed now (this pass)

| ID | Finding | Fix |
|---|---|---|
| **SRV-H1** | `recommend()` ran `addItem` (a transaction each) inside the parallel `Promise.all` → up to N×categories concurrent transactions vs an unset pool `max` (10) → exhaustion/wedge risk | Split into **Phase 1 parallel match** (the slow Haiku calls, no pg held) → **Phase 2 sequential add**. Keeps the ~9s speed; removes the fan-out. Verified 8.7s / items added. |
| **SRV-M1** | `:id`/`:itemId` slots unvalidated → malformed id hit Postgres → 500 with DB-shaped message (wrong status + info disclosure) | `router.param('id'/'itemId')` UUID guards → clean **400**. Verified. |
| **SRV-L3** | revive left stale `deleted_by` on the now-live row | revive sets `deleted_by = NULL` |
| **SRV-L1** | single-write fns (`updateItemQuantity`/`removeItem`) lacked the Rule-1 "no transaction because…" comment | comment added |
| **CLI-M4** | estimate quote-items resource had no `error()` branch → a failed load rendered as "No items in the quote yet" (misleading) | added `@else if (lines.error())` branch |
| **CLI-M6** | category-grouping reducer duplicated in estimate + rail (dup source of truth for the grouping key) | extracted `groupByCategory()` + `QuoteGroup` into `project.types.ts`; both consume it |
| **CLI-L6** | `allItemsCount()` was a method re-reducing per CD | → `computed()` |

### Deferred (with rationale)

| ID | Finding | Rationale |
|---|---|---|
| **SRV-H2** | pg `DeprecationWarning: client.query() while already executing` — auditor's best guess is the redundant `pool.on('connect')` `SET search_path` (search_path is already in the pool `options` string), amplified by recommend's fan-out | **Non-fatal warning.** The fix edits shared `pool.js` (affects v1 + v2 + every query) and must be verified that options-based `search_path` holds on Supabase's pooler before removing the handler. Tracked as a separate infra-hardening item; not fixed blind. The H1 fix removes the amplifier. |
| **SRV-M3** | project list has no `LIMIT`/pagination | org project counts are small today; add keyset pagination before an org grows large |
| **SRV-M4** | `express.json()` has no explicit body limit; `rawBriefText` 50k + `parsedBrief` (`z.unknown()`) ride the implicit 100kb | the 100kb default already caps; an explicit limit + a top-level `parsedBrief` shape is a config-pass nicety |
| **SRV-M2** | `addItem` returns `null` for both not-owned and unknown-item → one ambiguous 404 | intentional + documented; no security impact |
| **SRV-L2** | a `head`-unit item that also has `serves` divides by serves (pack-size wins over per-head) | confirmed intended ("pack size wins"); no item is both today |
| **CLI-M3 / M5** | form/rows are signals seeded inside a resource loader → latent clobber if the component is reused across project ids mid-edit | route id is stable for the component's lifetime today; `linkedSignal`-from-resource is the cleaner expression — deferred as non-urgent refactor |
| **CLI-L4** | quote rail hardcodes `'GBP'` while estimate uses `cur()` → mismatch for non-GBP orgs | most orgs are GBP; thread `currency` through marketplace → rail in a follow-up |
| **CLI-L5** | optimistic qty discards the server's returned `QuoteLine` (server normalisation wouldn't reflect) | server doesn't clamp today; low divergence risk |
| **CLI-M7 / L1 / L2 / L7 / L8** | `now()` staleness; `$any()` template casts; future card-link nesting guard; cosmetic typings | cosmetic / no current defect |

## Commits
- Server fixes + client fixes: see the v2.28b commit (`550c499f`) recorded in pV2-QUANTITY-01-shipped.md iteration).

Cross-link: [pV2-QUANTITY-01-shipped.md](../../prompts/pV2-QUANTITY-01-shipped.md).
