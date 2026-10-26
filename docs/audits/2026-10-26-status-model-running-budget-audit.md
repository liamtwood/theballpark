# Status-model + Running-budget slice — audit (2026-10-26)

Branch `rebuild/org-slice`. Two read-only audits, split by lane, consolidated here:
- **Spec/data-model + security** — `bp-v2.65- designer` (vs DATA-MODEL-REDESIGN line-cluster/status/message_events decision log + design memory; RLS on 0020/0022/0023).
- **Code/architecture** — this session (vs docs/ENGINEERING.md, Angular v2 standards, runtime reachability, client/server parity).

**Scope.** The *code* changes audited are this session's status-model + Running-budget work (commits `b66c9636 → 0b449da3`, 4 hand-edited files + the new shared deriver):
`server/db/rebuild/0007_codelists_seed.sql`, `client-v2/.../project-estimate.component.ts`, `.../project-detail.component.ts`, `.../inbox/inbox-project.component.ts`, and (consolidation) `.../core/status/line-display-status.ts` + `.../quote-line.util.ts` + `.../inbox/inbox-status.ts`.
The *security* findings below live in the line/inbox migrations + services (`0020`/`0022`/`0023`, `message-event.service`) that **predate this session** — surfaced by auditing the slice end-to-end, not introduced by these commits.

**Net: ship-quality slice.** Spec conformance is STRONG — the status model is faithful to the locked design (axes split correctly, acceptance DERIVED from the event journal, side authoritative + forge-protected, FR-00228 adjust-clears-accept correct, append-only enforced at RLS). One MEDIUM security finding (**M1**) is the one to fix before the slice is "done". The label-drift the code audit found (**M2**) is **fixed**.

---

## Findings (consolidated, ranked)

### MEDIUM

**M1 — `project_item_quotes_provider` RLS doesn't pin `org_id` (security/integrity; designer). OPEN.**
`0023:57-65` gates the provider write on the engagement (`provider_org_id`) but NOT on `org_id` (which must stay the agency). A supplier writing as `web_app_user` can set a quote row's `org_id` to an arbitrary org → the agency's org-scoped `_all` policy (`0020`) no longer matches → the agency loses access to its own quote row (orphaned/invisible). That's RLS relying on app discipline to keep `org_id`=agency — against the acquisition-grade bar (DB-enforced, not app-enforced).
*Fix:* add `AND project_item_quotes.org_id = pp.org_id` to the USING + WITH CHECK (`pp.org_id` is the agency on the provider row). **Decision (Liam):** fix now (pre-"done") vs schedule — recommended before "done".

**M2 — three drifted copies of the accept→label logic (code audit). FIXED `0b449da3`.**
The "both sides accepted" state rendered as "All confirmed" (Running budget) but "Both accepted" (`quote-line.util.statusLabel` + `inbox-status.statusPill`) — three copies of the derivation, already drifted (exactly the inbox-vs-budget "what's the truth?" Liam hit mid-session). Consolidated to ONE deriver `acceptanceCode(buyer,seller,viewer)` (consumes the server-derived accept flags; sole Both/You/They computation) + ONE label source (`line_display_status` codelist via `LineDisplayStatusService`, shared `LINE_DISPLAY_FALLBACK`). All surfaces now read "All confirmed"; the Running budget stays codelist-editable. No change to `deriveLineState`/`message_events`/RLS.

### LOW-MEDIUM

**LM1 — `clearedBy` not reset after a re-accept (correctness; designer). OPEN.**
`deriveLineState`: an `adjust` sets `clearedBy`; a later re-accept by the cleared side restores the accept but never clears `clearedBy`, so a line can be `bothAccepted=true` with a stale `clearedBy`. The Running-budget pill is safe (checks bothAccepted first → `all_confirmed`), but any surface rendering the clearing reason off `clearedBy` without a bothAccepted guard shows a spurious "re-approval needed" note after a re-accept.
*Fix:* reset `clearedBy=null` when the cleared side re-accepts (`message-event.service`).

**LM2 — vocab-mix in `activeSummary` (clarity; designer #3). RESOLVED — not a bug.**
`project-estimate.activeSummary` tests `l.status === 'booked'` and `l.status === 'quoted'`. These are NOT two server axes (`line_status` vs `quote_status`): in the client, `l.status` is `QuoteLineStatus` — a SINGLE derived display axis whose values include both `booked` and `quoted` (`quote-line.util` `STATUS_LABELS`). Both branches are valid values of one axis; no cross-vocab conflation. No change.

### LOW

**L1 — `messages_update` can reassign the counterparty (security; designer #4). OPEN.**
`0022:78-80` lets a party UPDATE a message while remaining a party — permitting a change to the other party's `from/to_org` (reassign the thread). App likely doesn't expose it. *Consider:* make `from_org`/`to_org` immutable on update.

**L2 — `project_item_quotes_provider` is `FOR ALL` incl. DELETE (design; designer #5). OPEN.**
A provider can hard-DELETE its quote overlay. If the app soft-deletes (`deleted_at`), narrow to SELECT+INSERT+UPDATE to match convention.

**L3 — `project-estimate.component.ts` over the line-count cap (code audit). NOTED.**
Already well over the 400 standard; this session added net to it. Partially mitigated by extracting the shared deriver to `core/status/line-display-status.ts`. The supplier-card header + status-pill logic remains an extraction candidate (a `supplier-card` sub-component) — defer unless Liam wants it now.

**L4 — `line_display_status` loads even in draft (code audit). NOTED / acceptable.**
The label resource loads on init even in draft, where the pill never renders. Now behind a `providedIn:root` service (loads once, shared across Running budget + inbox + estimate rows via the CodelistService cache) — cheap; leaving it warms the cache for the active view.

### CONFORMS ✓ (designer, spec + security)

Status axes split correctly (`line_status`=lifecycle, `message_item_status`=sole negotiation vocab on `message_events`, provider wholesale `pending/booked/cancelled`, quote `pending/quoted/accepted/declined`); buyer/sellerAccepted DERIVED by replaying events; **side authoritative** (`from_org==agency?buyer:seller`, `inbox.service:229`) and **forge-protected** (`messages_insert` WITH CHECK pins `from_org=current_org`, `0022:77`); **FR-00228 correct** (modification = `adjust` that clears the other side's accept, chat writes no event so never clears, definitional changes ride `adjust`); **append-only enforced at RLS** (no update/delete policy on `message_events`); `project_items_provider_read` scopes to BRIEFED items only (`0023:44-48`, minimal exposure); `org_contact` definer hardened (search_path pinned, revoke PUBLIC, engagement-gated). Dormant transitions (provider/quote/line status at insert defaults) are display-safe — the UI derives from events, not the dormant columns — intentional for S3, wired in S4.

**DB parity ✓ (code audit).** All 5 status codelists live in v2dev (`jwerngwvensmmhwrcgul`) match `0007_codelists_seed.sql` exactly (values, type, default, consumers); `line_display_status` correctly has no consumer (derived). A rebuild re-run reproduces what's live.

**Verify-point CONFIRMED (designer).** `agencyOrgId = projects.org_id` (`inbox.service:181`) — the PROJECT's agency, absolute, not the viewer's (`:182` 404s a non-owner agency viewer). So the side derivation (`from_org===agency?buyer:seller`) is perspective-independent — a supplier viewer gets the same buyer/seller attribution. Sound.

Designer closed its side: conformance strong; standing security/correctness findings = M1, LM1, L1, L2 (below). #3 withdrawn (resolution confirmed). The consolidation (M2) validated as a pure state→code→label mapper — `deriveLineState` stays the sole source of acceptance STATE.

---

## Fix status

| # | Sev | Owner | Status |
|---|---|---|---|
| M1 | MEDIUM | DB/RLS (`0023`) | **FIXED** `97d80f4c` (live + migration; org_id pinned) |
| M2 | MEDIUM | client | **FIXED** `0b449da3` |
| LM1 | LOW-MED | `message-event.service` | **FIXED** `00e145ef` |
| LM2 | LOW-MED | — | RESOLVED (not a bug) |
| L1 | LOW | DB/RLS (`0022`) | **FIXED** `97d80f4c` (party-immutability trigger) |
| L2 | LOW | DB/RLS (`0023`) | **FIXED** `97d80f4c` (no provider DELETE) |
| L3 | LOW | client | NOTED (defer) |
| L4 | LOW | client | NOTED (acceptable) |

**Sweep applied 2026-10-26** (`97d80f4c` DB/RLS, `00e145ef` service): all four
standing findings fixed — live on v2dev (`jwerngwvensmmhwrcgul`) and in the
rebuild migrations (`0022`/`0023`). Backend restarted clean (health 200). Only
L3/L4 remain, both NOTED/defer (no action). Slice is clear.
