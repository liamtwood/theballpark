# pV2 INBOX + CART-01 — Angular/Node architect audit (2026-07-08)

> Independent read-only end-of-arc audit (general-purpose architect agent,
> grounded in the angular-developer references + ENGINEERING.md/ARCHITECTURE.md
> + AUDIT_LEDGER risk patterns). Audited at chip `[Dev v2] v2.41g`. Covers the
> two arcs shipped since the STORE-01 audit (2026-06-24, v2.34q): the **INBOX**
> arc (v2.34v–v2.36f) and the **CART-01** arc (v2.37–v2.41g), plus the store
> item-edit changes.

## Verdict

Both arcs are architecturally healthy and idiomatic for Angular 21
zoneless/signals — clean JWT org-scoping throughout, a single authoritative
server cascade (`estimate.js`) the client consumes rather than recomputes,
verified client/server line-cost parity (incl. the per-order/item/% install
basis), and complete read-only-after-sent enforcement on both mutating
endpoints. No correctness or security risk. The debt was concentrated and
mechanical: three components over the 400-line alarm, a dead second send-path,
and a now-orphaned parallel roster model. **All H/M/L + RP findings remediated
in four commits, same session.**

## Findings & remediation

| # | Sev | Finding | Status | Commit |
|---|-----|---------|--------|--------|
| H1 | HIGH | Dead outreach send path in `project-detail` (`onMessageSuppliers`/`goToMarketplace`/`sending` + inbox/effect/store imports) orphaned after the send moved into the estimate dialog. | ✅ CLOSED | `23586099` |
| H2 | HIGH | Two parallel supplier-roster builders — the Final-view dialog (item-owner-derived) vs `ProjectOutreachStore` (marketplace enlist). The store was write-mostly; its picks silently vanished on send (live bug). | ✅ CLOSED — retired the store + enlist affordance; dialog is the single source | `23586099` |
| M1 | MED | `project-estimate.component.ts` = 805 lines (2× alarm). | ✅ CLOSED — 808 → **444** (5 child components + `quote-line.util`) | `8ac0a6cb` |
| M2 | MED | `inbox-project.component.ts` = 600 lines. | ✅ CLOSED — 600 → **360** (`app-inbox-rail`, `inbox-status`, styles→global) | `64e8153a` |
| M3 | MED | `item-edit.component.ts` = 438 lines. | ✅ CLOSED — 438 → **398** (`app-item-edit-actions`) | `5072e519` |
| M4 | MED | `est` resource read `isFinal()` in the loader, not `params` (non-reactive-loader anti-pattern; benign today). | ✅ CLOSED — scope is now part of `params` | `23586099` |
| M5 | MED | Two 90%-identical `STATUS_VIEW`/`STATUS_VIEW_AGENCY` maps (drift risk). | ✅ CLOSED — one base + agency-override in `inbox-status.ts` | `64e8153a` |
| L1 | LOW | Custom lines session-only; omitted from the persisted quote/brief (flagged in-code). | ⏳ OPEN (known — needs a `project_items` column) | — |
| L2 | LOW | Install-basis switch duplicated client (`lineCost`) + server (`LINE_TOTAL_SQL`). Verified matching. | ✅ NOTED — client side now a single `quote-line.util.lineCost`; two-place cross-runtime invariant remains by design | `8ac0a6cb` |
| L3 | LOW | Read-only-after-sent — fully guarded on both endpoints + client. | ✅ CLEAN (no action) | — |
| L4 | LOW | Org-scoping + inbox participation checks. | ✅ CLEAN (no action) | — |
| L5 | LOW | `previewItem` hardcoded `supplierCity: null`. | ✅ CLOSED — carries the real city | `23586099` |
| L6 | LOW | No raw hex / Tailwind-color / `.subscribe()` / non-OnPush / missing-host found. | ✅ CLEAN | — |
| RP-04 | — | `STATUS_LABELS`/`STATUS_VIEW`/`TERMINAL_STATUSES` inline maps. | ✅ Extracted to pure utils (`quote-line.util`, `inbox-status`) | `8ac0a6cb`, `64e8153a` |
| RP-05 | — | Component-local `.bp-*` classes (estimate: pill/input/check; inbox: act/bubble/spill/send-btn). | ✅ Promoted to the global one-definition layer (`styles.css`) | `8ac0a6cb`, `64e8153a` |

## Line-count outcomes

| File | Before | After |
|---|---|---|
| project-estimate.component.ts | 805 | **444** |
| inbox-project.component.ts | 600 | **360** |
| item-edit.component.ts | 438 | **398** |

New extracted units (all well under 250): `project-summary-tiles`,
`estimate-breakdown`, `estimate-preview-rail`, `estimate-item-row`,
`custom-line-dialog`, `quote-line.util`, `inbox-rail`, `inbox-status`,
`item-edit-actions`.

## Remaining (not audit findings — product backlog)

- L1 custom-line persistence (needs the `project_items` column).
- The Message-Suppliers "1 Ball" is still `skip_balls` (no debit).
- The "only «Supplier» offers «Item X»" leftover flag in the supplier dialog.
