# pV2-PROJECTS-S3 — Inbox / messaging / negotiation PORT onto the 0022 cluster

**Shipped:** 2026-10-19, chip `[Dev v2] v2.807`
**Branch:** rebuild/org-slice
**Commits:** `<sha>` (server: inbox + message-event services, route, line send-state, 0023 RLS), `<sha>` (client: Inbox nav unlock + chip)

## What landed
- **New `server/src/services/message-event.service.js`** — the append-only EVENT layer + the pure negotiation reducer. `deriveLineState(events)` replays the (per provider × item) event journal into the exact client DTO vocabulary (`brief_sent` / `adjusted_by_{agent,supplier}` / `accepted` / `declined_by_{…}` + `buyerAccepted`/`sellerAccepted`/`*AcceptedAt`). Re-approval is DERIVED (FR-00228): a material event after an accept clears it — proven by 7 unit scenarios incl. "both accept → supplier re-raises → agency must re-approve". `writeEvent` (append-only) + `upsertOverlay` (the per-provider current form, per-unit/flat XOR enforced).
- **Rewrote `server/src/services/inbox.service.js`** onto the cluster (same 8 exports → routes + client DTOs unchanged). Threads DERIVED (no table): grouped by (provider × project_category), `threadId` = the brief message id. `sendOutreach` creates `project_providers` + a brief `messages` row + `message_relations` per not-yet-briefed item (idempotent re-send; first send flips Draft→Active). `reply` writes BOTH an event (journal) AND the overlay (current form) per action — the single-write-path invariant; a bodyless reply = an action, not a bubble. `getAgentThreads`/`getSupplierThreads`/`getAgentInboxSummary`/`getProjectOverview`/`listSupplierProjects` all read from the derived threads.
- **`project-line.service.js`** — parametrised the overlay join (estimate path untouched → golden test unaffected) to add `lineByIdForProvider()` (the inbox line-preview resolves against the PROVIDER's overlay), and derived real **send-state**: a briefed line is `out_for_quote` (leaves the editable cart, read-only in Final), unbriefed stays `to_send`. This is the "read-only-after-sent" behaviour + the estimate "Message suppliers" CTA (item 3) completing.
- **Client** — the project-detail **Inbox nav tab unlocks** once a project is Active (`projNav` → computed; the `@case('inbox')` already rendered `<app-inbox-project>`). No other client change needed: the server emits the identical `InboxThread`/`InboxThreadItem`/`ProjectCard`/overview DTOs, so inbox-project / inbox-rail / inbox-landing / the estimate send flow port unchanged.
- **New `server/db/rebuild/0023_inbox_rls.sql`** — the engaged-provider RLS widenings the model anticipates (0018: "S3 widens this to suppliers engaged via project_providers"): additive `for select` read policies on `projects` / `project_categories` / `project_items` (item scoped to a message relation the provider is party to), a provider read+write policy on `project_item_quotes` (its own overlay), and `org_contact()` — a SECURITY DEFINER (gated to a shared engagement, mirrors `address_locality`) for cross-org SUPPLIER→AGENCY display. **MUST be applied before the supplier-side is testable** (agency side works without it).

## Files touched
| File | Lines (Δ) | Notes |
|---|---|---|
| server/src/services/message-event.service.js | +225 (new) | event writer + overlay upsert + deriveLineState reducer |
| server/src/services/inbox.service.js | rewrite (~640) | 8 exports preserved; cluster reads/writes; thread assembly |
| server/src/services/project-line.service.js | +49 / -14 | overlay join parametrised; lineByIdForProvider; derived send-state |
| server/src/routes/inbox.js | +4 | reply schema accepts installCost/flatTotal (were silently dropped) |
| server/db/rebuild/0023_inbox_rls.sql | +90 (new) | engaged-provider read widenings + overlay write + org_contact() |
| client-v2/.../project-detail.component.ts | +29 / -14 | Inbox nav unlock for Active projects |
| client-v2/.../environments/environment.ts | chip | v2.806 → v2.807 |

## Acceptance — verification done / pending
- **Modules load + client builds** — ✓ `node -e require(...)` clean on all 3 server modules + the route; `ng build` (development) clean, 0 errors.
- **All 16 S3 SQL statements parse against the LIVE v2dev schema** — ✓ (read-only bogus-id harness; catches any dropped-column typo). `lineById` + `lineByIdForProvider` execute.
- **Negotiation reducer** — ✓ 7 scenarios incl. FR-00228 re-approval + agency-counter-clears-supplier + decline-after-accept.
- **Backend health** — ✓ `curl :3002/api/health` → `{status:ok, db:up}` (hot-reloaded by the parent's env).
- **End-to-end (message → supplier sees thread → accept/decline/suggest → overlay + re-approval → inbox home)** — ⏳ PENDING: needs 0023 applied (supplier reads) + a live auth'd agency+supplier pair. Recipe in the hand-over note for a joint smoke with the parent. Liam QCs visually.

## API audit checklist (routes touched: `server/src/routes/inbox.js`)
Only the reply schema changed (added two optional numeric fields); no new endpoints. The existing routes now call the rewritten service.
#### `POST /api/inbox/threads/:threadId/reply`
- ✓ HTTP method (POST, 201) / ✓ Input validation (Zod; threadId UUID-checked; new installCost/flatTotal nonnegative optional) / ✓ Authorization (service re-derives party from the anchor message + project owner; `org_id` from JWT, never body) / ✓ Status codes (400 bad id/input, 404 not-a-party, 201 ok) / ✓ Response shape ({ok, replyId, changes}) / ✓ Information disclosure (not-found == not-yours, same 404) / ✓ Observability (skipped action warns) / N/A Idempotency (append-only reply) / ✓ Performance (one txn).
#### `POST /api/inbox/send`, `GET /api/inbox/projects|summary|projects/:id/threads|overview`
- Unchanged route code; now backed by the cluster service. org_id from JWT; ownership/party re-derived in the service. `send` is one transaction (Rule 1).

## Concerns not in spec

### 0023 RLS migration is a hard dependency for the supplier side
**Where:** server/db/rebuild/0023_inbox_rls.sql
**What:** The supplier-side reads (listSupplierProjects, getSupplierThreads, supplier reply) require the engaged-provider read widenings + org_contact(). Until the parent applies 0023 via the rebuild runner, the supplier path 404s/errors (gated, not silent-wrong). The agency side needs nothing new.
**Suggested fix:** Apply 0023 (parent owns DB writes). Flagged in the hand-over.
**Severity:** HIGH (blocks half the QC gate until applied).

### Cross-org counterparty display — the two directions are asymmetric
**Where:** inbox.service.fetchOrgDisplay + 0023 org_contact()
**What:** Agency→supplier uses the existing `supplier_directory`; supplier→agency needed a NEW gated definer (`org_contact`) because agencies aren't in any directory and orgs RLS is own-org-only. This is a genuine model gap the 0022 DDL didn't cover. I chose the narrow-definer-with-shared-engagement-predicate (mirrors `address_locality`) over a broad owner-run org directory. **Design point for you/Liam to confirm.**
**Suggested fix:** Confirm the definer approach, or swap to an `org_directory` view (I isolated it behind one helper + one function, so either is a small change).
**Severity:** MEDIUM (a design call; current approach works + is the tighter one).

### Per-line estimate status is coarse across multiple providers
**Where:** project-line.service.toQuoteLine
**What:** A line fanned to N suppliers has N negotiation states, but the estimate/Final view shows ONE status. I derive `to_send` (unbriefed) vs `out_for_quote` (briefed) only — the nuanced per-provider state lives on the inbox thread item (correct home). A line declined by ALL providers is NOT marked `declined` in the estimate (the old single-supplier model could). 
**Suggested fix:** If Liam wants a line-level "declined everywhere / partly agreed" rollup in Final, add a derived collapse in a follow-up.
**Severity:** LOW.

### N+1 in the thread assembly
**Where:** inbox.service.assembleThreads (lineByIdForProvider per item) + getAgentInboxSummary (assembleThreads per project)
**What:** The line-preview QuoteLine is fetched per item, and the Messages landing assembles every active project. Fine at QC scale; would want batching for a busy agency.
**Suggested fix:** Batch `lineByIdForProvider` to a list; cache the summary. Deferred — perf, not correctness.
**Severity:** LOW.

### message_reads not written yet
**Where:** (not implemented)
**What:** The table exists (0022, parked read-receipts foundation); no client endpoint reads/writes it and the inbox has no mark-read call. Left as foundation only (matches the UNIFY-01 original, which didn't use per-user reads either).
**Severity:** LOW.

### message-item.service.js left DORMANT
**Where:** server/src/services/message-item.service.js
**What:** Still required by the v1 `brief.js` / `messages.js` routes (which reference culled tables and are themselves dormant on the cluster). Not touched — same pattern as S2 leaving projects.service dormant. The new logic lives in message-event.service.js.
**Severity:** LOW (informational).

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in)
