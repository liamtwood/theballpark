# BE-00112 — Decompose taxonomy.service (god-service → 5 modules)

**Shipped:** 2026-11-05, chip `[Dev v2]` (rebuild/org-slice)
**Commits (this session, 5):**
- `37e064ae` — extract quote-request.service (Layer 1)
- `82d8122b` — extract project-match.service (Layer 1)
- `d695afc8` — extract matching.service + collapse its AI onto callHaikuJson (Layer 1 + 2)
- `8d072546` — fix(matching) BE-00147 supplier_directory repoint
- `be4eef86` — extract classification.service + collapse 3 AI sites (Layer 1 + 2); taxonomy becomes the tree-reader
- `687ca7b6` — decompose requestQuotes into named steps (Layer 3)

## What landed
- `taxonomy.service.js` **1691 → 156 lines** — now a pure TREE READER
  (loadTaxonomy / loadChildren / getDimensions / categorySuppliers / eventTypes
  / norm / httpErr). Everything else split into single-concern modules:
  - `quote-request.service.js` — RFQ outreach (requestQuotes + listProjectQuoteRequests)
  - `project-match.service.js` — Brief-tab match persistence + materialize
  - `matching.service.js` — brief → catalogue item matcher
  - `classification.service.js` — AI catalogue classifier (classify/apply/dismiss/tags/suggest/backfill)
- **AI plumbing unified (Layer 2):** matching + classification dropped taxonomy's
  duplicate Anthropic client (getClient/aiCreate/parseJson/HAIKU_MODEL) and now
  call `ai.service.callHaikuJson` — same model (`claude-haiku-4-5-20251001`),
  maxRetries:8, 503 overload mapping, JSON + markdown-fence parse. One Definition.
- **Layer 3:** the 362-line `requestQuotes` is a ~70-line orchestrator over named
  steps (parse / loadOutreachContext / resolveRequirements / loadCanonicalLines /
  debitOutreachBall / claimOrCloneLine + fanOutToSuppliers / markCategoryOutForQuote
  / sendOutreachEmails). SQL moved verbatim; the single OWNER-pool transaction
  boundary (BE-00115) is preserved exactly. Dead `notifyQuoteRequestSuppliers`
  (zero callers) + its `sendEmail` import removed.
- **BE-00147 (folded in):** `matchItems` supplier reads repointed `orgs_public` →
  `supplier_directory` (cross-org RLS bite). Verified dev2: suppliers_scanned 0 → 4.

## Dependency shape (DAG, no cycles)
```
taxonomy.service (tree reader)  ← classification.service (loadTaxonomy/loadChildren/norm)
ai.service.callHaikuJson        ← matching.service, classification.service
project-match.service           ← matching.service (materializeProposedItem)
```
Callers repointed: `routes/taxonomy.js` (classify/apply/dismiss/item-tags/
suggest/backfill → ClassificationService; match → MatchingService; RFQ →
QuoteRequestService; add/remove/hint/materialize → ProjectMatchService;
dimensions/category-suppliers/event-types stay TaxonomyService), `item.service.js`
(classifyAndApply → ClassificationService), `projects.service.js` (matchItems →
matching; dropped dead taxonomy require), `scripts/backfill-subcategories.js`.

## Verification
- matchItems functional smoke (Catering, 193 items): 3→2 sane matches across runs
  (Haiku variance), **suppliers_scanned 0 → 4** after BE-00147.
- Backend health 200 after every commit's reload; module graph loads (routes
  require every split service at boot).
- classifyItem smoke: reaches the DB and stops only at the legacy `tag` table
  (proves the #2→#1 import crosses the module boundary) — see dormancy note.
- quote-request smoke (side-effect-free): validation 400s + loadOutreachContext
  404 (pre-BEGIN, no writes) PASS; wiring verified by inspection.

## Concerns not in spec
### v2dev dormancy — classification + RFQ write paths cannot be e2e-smoked
**Where:** classification.service.js (all fns), quote-request.service.js (requestQuotes)
**What:** the rebuild dev2 DB is missing the tables/columns these paths need:
`tag`, `supplier_item_tag`, `items.subcategory_id`, `items.pending_classification`,
`items.is_active` (classification); `message_items`, `message_item_events`,
`quote_requests`, `balls_transactions` (RFQ write path). These slices haven't
landed in v2dev (classifyAndApply is already a no-op; the active v2 send is
inbox.service). So the moves are byte-faithful restructures of currently-dormant
code — verified by load + validation + read-path + wiring, not end-to-end.
**Severity:** LOW (pre-existing; not introduced by this work)

### categorySuppliers has the same supplier_directory bite as BE-00147
**Where:** taxonomy.service.js categorySuppliers (`JOIN orgs_public` + `i.is_active`)
**What:** reads suppliers via `orgs_public` (own-org RLS-zeroed cross-org) and
filters `i.is_active` (dropped in the rebuild). Will zero cross-org on the flip,
same class as BE-00147. Left verbatim (out of BE-00147's matchItems scope).
**Suggested fix:** repoint to `supplier_directory` + rebuild-correct the active
filter — worth its own BE.
**Severity:** MEDIUM (latent; cross-org read wrong on the flip)

### quote-request.service file size / hand-rolled transaction
**What:** file grew 508→567 (decomposition overhead); there is no documented hard
file line-cap in WORKING_STANDARDS, and the real smell (362-line function) is
fixed, so I did not split steps into a second file. The hand-rolled BEGIN/COMMIT
is intentional on the OWNER pool (BE-00115 — no per-statement audit-GUC wrapper
for withTransaction to preserve); documented at the orchestrator.
**Severity:** LOW

## Chat audit
(chat fills this in — BE-00112 → Done, and update AUDIT_LEDGER behemoth line:
`taxonomy.service` 1614 → 156; new modules; BE-00147 logged.)
