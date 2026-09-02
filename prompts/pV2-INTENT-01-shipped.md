# pV2-INTENT-01 — natural-language actions on a line ("treat the message as a prompt")

**Shipped (foundation):** 2026-09-02, chip `[Dev v2] v2.205`

Turn a short typed message about ONE quote line into **suggested, confirm-first
actions** the user taps to apply. v1 action allowlist:
`set_base_cost`, `set_base_description`, `upsert_extra` (create/update a component),
`accept_cost`, `decline`.

## This slice — the reusable backend (no UI yet)
- **`server/src/services/intent.service.js`** — `parseIntent(message, context)` on
  **Haiku 4.5** (mirrors `ai.service`: JSON-only system prompt, 429/529 handling,
  robust parse). Output is **whitelisted + coerced** server-side (`sanitize`) — the
  model's JSON is never trusted verbatim; unknown/ill-formed actions are dropped;
  empty message or no clear command → `{actions:[]}`.
- **`POST /api/projects-v2/:id/items/:itemId/parse-intent`** (`IntentSchema`,
  message ≤ 2000 chars, advisory context). **Interprets only — never mutates.**
- **Client:** `IntentAction` / `IntentContext` types + `ProjectService.parseIntent`.
- **Shared math:** `revisedFromParts(baseCost, costTotal, marginPct)` in
  `quote-line.util` — the ONE revised-line-total formula; Customize's `withMargin`
  now calls it (was inline) so the builder and the apply path can't drift.

## Safety model (holds for the UI too)
- **Confirm-first** — every action is a suggestion the user applies; nothing
  auto-runs (esp. accept/decline).
- **Only the sender's OWN composed message is parsed** — never the counterparty's
  incoming message (prompt-injection boundary).
- Applies through the **existing authenticated endpoints** (`saveComponents` /
  item accept-decline), which re-check permission; the parser has no write path.

## Next — the UI (agreed direction)
- A **reusable agent component** (a rail like the estimate/customize rail) that
  takes a line context, sends the message to `parseIntent`, renders the suggested
  actions as chips, and applies them. Mountable on multiple pages (inbox first).

## Iteration — v2.206 (2026-09-02): the conversational agent rail (UI) + inbox mount
- **`<app-agent-rail [context] (changed)(accept)(decline)(suggestCost)(sendMessage)>`**
  — a reusable chat panel: you message it about the selected line; it shows a short
  reply, **action chips** (Apply / Send, confirm-first), and **next-step suggestion
  chips**. Parser extended to return `{reply, actions, suggestions}` and two new
  actions: `suggest_cost` (a counter-offer total) and `draft_message` (the agent's
  drafted "ask" to the supplier — e.g. "ask for wine pairing / a discount").
- **Role-aware:** the rail only surfaces actions the viewer may take — supplier gets
  the buildup edits (applied in place via `saveComponents` + the shared
  `revisedFromParts`), agent gets `draft_message` / `suggest_cost`; both get
  accept/decline (gated on a non-terminal line). Buildup edits update the
  components AND the line total; negotiation moves are emitted to the inbox host
  (existing `accept` / `decline` / `itemAction adjust` / `send`).
- **Mounted** as a third column in the inbox (xl), on the selected line, hidden
  while Customize owns the pane. Reusable elsewhere by handing it an
  `AgentRailContext`.

## Iteration — v2.207 (2026-09-02): move the line actions into the Assistant chips
- Removed the standing action bar from the conversation (the "£X / head · install ·
  × qty · total" breakdown + Accept / Suggest / Request / Decline / Customize
  buttons). Those are now **quick-action chips in the Assistant rail**
  (`quickActions` input + `(quickAction)` output on `app-agent-rail`), calling the
  EXISTING handlers (`accept` / `startPropose` / `requestInfo` / `decline` /
  `toggleCustomize`) — role-aware (Customize supplier-only), hidden on terminal
  lines. Message composer stays at the bottom of the conversation.
- The Suggest-new-cost **rate entry** still lives in the conversation but now shows
  ONLY when proposing (opened by the Assistant's "Suggest new cost" chip).
