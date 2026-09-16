# pV2-PROJ-UX-01 — Project workspace UX fixes (client feedback)

**Shipped:** 2026-09-16, chip `[Dev v2] v2.465`
**Owner:** CC implemented. Chat authored the spec. Liam QCs on localhost, then promotes to preview.

## What landed
- **#2 Supplier name on the item card** — `estimate-item-row.component.ts` now renders `line().supplierName` as a `bp-meta` line under the title (null-safe, truncated), between the title row and the price meta. Data already on `QuoteLine`; no data-layer change.
- **#3 Back from the Quote document → Ballpark Cost** — `project-detail.component.ts` quote-document `(close)` now runs `docView.set(false); setTab('final')`, so closing the doc (opened from Reports) lands on Ballpark Cost, matching the "Back to builder" intent. `'final'` confirmed as the Ballpark Cost tab key.
- **#4 Tab reorder — Inbox right after About** — live tab order is now **About → Inbox → Ballpark Cost → Marketplace → Reports** (the `inbox` push moved directly after `details`, still `if (!draft)` gated).
- **#5a Successful Message-suppliers send → live Overview** — `onSendBriefs()` now navigates to `tab: 'details'` (About/Overview) on success (was `tab: 'inbox'`). Cancel/failure still don't navigate.
- **#5b Inbox tab attention badge** — the Inbox tab carries `badge: overview.openThreads` (undefined when 0 → no badge), read from the already-fetched project overview (`GET /api/inbox/projects/:id/overview`). So right after messaging suppliers the Inbox tab lights up beside About.

## #1 — FLAGGED, not implemented (per the spec's own guard)
The spec said: replace the cart footer's two buttons with a single "Message suppliers" **only if** the top of the cart view already carries Edit-in-marketplace + Go-with-this-Ballpark; **if not, stop and flag.**

Verified the current tree: the cart view (`!isFinal()`) top has only the "Project Cart" title + event details. **"Edit in marketplace" (`addItems.emit()`) and "Go with this Ballpark" (`goToFinal.emit()`) exist ONLY in the footer** (project-estimate.component.ts ~276/280) — the footer is the only path to both. Stripping them to a single "Message suppliers" would remove the only route to those actions, so per the spec I did NOT change #1.

Also note: the cart (`!isFinal()`) currently has no "Message suppliers" at all — that CTA lives on the FINAL view's Project Costs section. So "cart footer → Message suppliers" would also be a behaviour change (messaging from the pre-final cart).

**Decision needed (Liam):** either (a) leave the cart footer as-is, or (b) add Edit/Go-with to the top of the cart first, then collapse the footer to "Message suppliers" (a follow-up), or (c) confirm the client actually meant the FINAL view.

## Files touched
| File | Notes |
|---|---|
| `client-v2/src/app/pages/projects/estimate-item-row.component.ts` | #2 supplier-name meta |
| `client-v2/src/app/pages/projects/project-detail.component.ts` | #3 close→final, #4 tab reorder, #5b inbox badge |
| `client-v2/src/app/pages/projects/project-estimate.component.ts` | #5a send → Overview |
| `client-v2/src/environments/environment.ts` | chip v2.465 |

## Acceptance
- [x] #2 item card shows supplier name (null-safe, styled to match)
- [x] #3 Back from Quote doc lands on Ballpark Cost
- [x] #4 live tab order About → Inbox → Ballpark Cost → Marketplace → Reports
- [x] #5a successful send routes to Overview; cancel/failure do not
- [x] #5b Inbox tab badge from overview.openThreads
- [~] #1 flagged (precondition not met) — awaiting Liam's call
- [x] v2 builds clean; chip bumped

## Notes for the ship report
- **#1 top-has-both check:** FALSE — the top does not carry the two actions; they're footer-only. Flagged, not stripped.
- **#5b attention signal source:** `overview.openThreads` (from the project overview already fetched for the hero tiles) — the smallest wiring. It counts open threads (not strictly agent-action-required); could be refined to an action-required signal later if desired.

## Concerns not in spec
- **Badge semantics:** `openThreads` includes threads awaiting the supplier, not just the agent — so the badge means "active conversations," not "action required by you." Fine for the client's goal (Inbox lit after sending); flag if a stricter action-required signal is wanted.
- **tab-band model:** no change needed — `TabBandTab.badge?: number` already existed and renders via `.bp-tab__badge`.
- **Draft edge case:** the Inbox tab (and its badge) only exists for non-draft projects; the badge reads `overview` which is only fetched when non-draft — consistent, no draft-time fetch.

## Iteration — v2.466 (2026-09-16)
**Triggered by QC (Liam's #1 call):** in the draft "add new project" flow only two
tabs show (Ballpark Cost + Marketplace), so the cart footer's **"Edit in
marketplace"** button is redundant (Marketplace is already a top tab) — remove it
rather than collapse to "Message suppliers".
**Done:** removed the "Edit in marketplace" button; the footer is now the single
**"Go with this Ballpark"** CTA (promoted to the primary gradient button). Cleaned
up the now-dead `addItems` output (project-estimate) + its binding and the
`addItems()` handler (project-detail).
**Files:** project-estimate.component.ts, project-detail.component.ts.

## Iteration — v2.467 (2026-09-16)
**Triggered by QC (Liam):** #2 (supplier name) should extend to the **marketplace
item cards** too. The card previously showed `supplierCity || supplierName` (city
won, hiding the supplier name).
**Done:** `item-card.component.ts` now shows a `supplierMeta` line — supplier name
with the city appended ("Rocket Food · London"), falling back to whichever exists;
icon changed map-pin → store. Applies everywhere the shared item card renders
(global + in-project marketplace, supplier store).
**Files:** shared/catalogue/item-card.component.ts.

## Iteration — v2.468 (2026-09-16)
**Triggered by QC (Liam):** #3 — Back from the quote document should return to the
**Reports** tab (where it was opened), NOT Ballpark Cost. This reverses the spec's
original assumption; Liam's call wins.
**Done:** reverted the quote-document `(close)` to `docView.set(false)` (reveals
Reports underneath), and relabelled the doc's action-bar button "Back to builder"
→ **"Back"** so it isn't mislabelled. (SOW doc already returned to Reports.)
**Files:** project-detail.component.ts, quote-document.component.ts.

## QC notes
(Liam) — QC round 1: #3,5,6,7,8,9,10 OK; #8 badge logic to be solidified later;
#1,#2 not tested. #4 fixed this iteration (back → Reports).

## Chat audit
(chat)
