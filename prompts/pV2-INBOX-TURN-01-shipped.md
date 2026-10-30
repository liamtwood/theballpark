# pV2-INBOX-TURN-01 — Line pill: deal state + conversation turn · SHIPPED

**Branch:** rebuild/org-slice
**Status:** Shipped (awaiting Liam QC on localhost :4202)
**Design:** conversation 2026-10-30 (Liam walked it through to the lock below)

## The decision

A line's status pill carries **two axes**, resolved to **one field** (`line_display_status`) plus a **bold** flag:

- **Deal state** — the last price/accept ACTION: `to_agree` · `quoted` · `new_cost` · `you_accepted` · `they_accepted` · `all_confirmed` · `booked` · `declined`. (Liam relabelled `new_cost` → "Price match requested" himself in the codelist.)
- **Conversation turn** — when the last event on a line is a **message-only** (no price action), the status *is* the turn: **`reply_needed`** (they sent it → on you) / **`replied`** (you sent it → awaiting them).
- **`needsYou` → bold** — the OTHER party sent the last message on a **non-terminal** line, so a reply/action is owed by you. Rendered as a **bold pill**, independent of which code shows — so `new_cost` ("Price match requested") reads **bold** when their counter is the thing awaiting you. Same last-sender read covers both their actions and their plain messages.

Terminal lines (`all_confirmed` / `booked` / `declined`) are never bold.

**Deriver order:** terminal deal states win → message-only turn → deal code.

## Changes

| File | What |
|---|---|
| `server/db/rebuild/0028_line_turn_codes.sql` | adds `reply_needed` / `replied` to `line_display_status` (idempotent). `new_cost` relabel owned by Liam in the codelist. |
| `core/status/line-display-status.ts` | `LineStatusInput`; two new codes + fallbacks; `isTerminal()`; `needsYou(s, viewer)`; `lineDisplayCode` re-ordered (terminal → turn → deal) and emits `reply_needed`/`replied`. Backward-compatible (turn inputs optional). |
| `server/src/services/inbox.service.js` | per-line last-message index (`msgByItem`); each thread item now carries `lastMessageBy` + `lastEventIsMessage` (message newer than last action). |
| `core/inbox/inbox.service.ts` | `InboxThreadItem.lastMessageBy` + `.lastEventIsMessage`. |
| `shared/status-pill/status-pill.component.ts` | optional `[strong]` input → bold label. |
| `inbox-rail.component.ts` | pill `[strong]="needsReply(it)"` (= `needsYou`). |
| `inbox-project.component.ts` | header pill `[strong]="headerNeedsYou()"`. |

## DB

Applied to **dev2** (MCP): relabel `new_cost` + add `reply_needed`/`replied`. Rebuild migration **0028** for fresh envs (preview/prod on promote).

## Scope / follow-ups (not in this ship)

- **Covered now:** inbox conversation rail + conversation header (the `InboxThreadItem` path).
- **Deferred:** Running-budget estimate rows (needs `QuoteLine` to carry last-sender) and the supplier/agent **Messages-landing** item rows (the `supplier-items` / `supplier-summary` feeds don't carry message info yet). Both still show correct deal codes; they just won't show `reply_needed`/`replied` or bold until their feeds carry the turn fields.

## Acceptance (to QC on :4202)

1. Open a project inbox with an item where the other side sent the last **plain** message → pill reads **"Reply needed"** (bold), yours reads **"Replied"**.
2. Their **counter** (new_cost) with no newer message → pill reads **"Price match requested"** **bold** (their action awaits you); your own counter → same label, not bold.
3. Both-accepted / booked / declined → terminal label, never bold.
4. Labels + colours still editable in Settings ▸ Codelists.
