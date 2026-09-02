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

## Iteration — v2.208 (2026-09-02): opening radio options (Accept / Decline / Make a change)
- Replaced the persistent chip row with an **opening prompt + radio group** in the
  Assistant's empty state: "Tell me what you'd like to do with {item} — pick an
  option below, or just send me a message." Options: **Accept the cost**,
  **Decline/Cancel** (gated by canAccept/canDecline), **Make a change**.
- Accept/Decline run the existing handlers (via `quickAction` → the inbox);
  **Make a change** just reveals a hint inviting a free-text prompt (and, for a
  supplier, an "open the full builder →" link → Customize). Users can ignore the
  radios and type anything. Removed the `quickActions` input + chip row.

## Iteration — v2.209 (2026-09-02): nested opening options (decline reasons + change types)
- **Decline → a reason step** (role-aware radios): supplier = Not available / Out of
  stock / Can't provide this; agent = Over budget / No longer needed / Going another
  way; plus **Other…** (free text). Picking a reason posts the decline WITH the
  reason (arms `decline` + composes "{item} — Decline/Cancel because {reason}" +
  sends). `decline` output now carries the reason string.
- **Make a change → three sub-options:** **Suggest new price** (opens the propose
  rate entry via `quickAction('suggest')`), **Change item** and **Add extras** (each
  drops a tailored free-text hint to type the rest); supplier also gets "open the
  full builder →". A **← Back** returns to the three top options.

## Iteration — v2.210 (2026-09-02): radios + a single action button; drop builder link
- Applied the pattern consistently: a sub-step shows **radios**, then **one action
  button** takes the action (no fire-on-select). Decline = pick a reason (Other →
  text box) → **Decline / Cancel request** (enabled once a reason is set). Make a
  change = pick Suggest new price / Change item / Add extras → **Continue** (Suggest
  opens the propose entry; the other two drop a hint to type). Each step keeps a
  **Back**.
- Removed the "open the full builder →" link from the Assistant.

## Iteration — v2.211 (2026-09-02): auto-select the first item on load
- The inbox now **auto-selects the first item** (first thread that has one) on load
  instead of landing on thread-level chat, so you drop straight into its
  conversation + Assistant. The pick is still preserved across reloads; it only
  re-defaults when the selection is gone.

## Iteration — v2.212 (2026-09-02): Accept also confirms (Back / Accept)
- Picking "Accept the cost" now opens a confirm step — "Accept the current cost of
  £X?" with **Back** / **Accept** buttons — matching Decline / Make-a-change (no
  fire-on-select). Added `currentTotal` to the rail context for the figure.

## Iteration — v2.213 (2026-09-02): fix description apply, merge not replace, action-only suggestions
- **Description apply fixed:** `set_base_description` now writes via the dedicated
  `updateLineDetails` (PATCH /details) instead of the `saveComponents` rebuild — a
  description change no longer touches components/price (and no longer fails).
- **Merge, don't replace:** the parser now receives the **current description** and
  is told to return the COMPLETE updated text (existing + the change), so
  "add a soup option to the first course" augments the menu instead of wiping it.
- **Suggestions are action-only:** the prompt now forbids meta prompts
  ("Review…", "Share…", "Edit…", "Keep…") — suggestions must map to a concrete
  action (add extra / suggest price / accept / decline), killing the conversational
  spiral.

## Iteration — v2.214 (2026-09-02): echo the change back ("I updated … — is this what you wanted?")
- After applying an action the Assistant now posts a **confirmation turn** showing
  exactly what changed and asking "Is this what you wanted?": the full new
  description (formatted), the new base cost, or the added extra (name · cost ·
  qty/unit); brief lines for accept/decline/suggest/send. Assistant turns now
  render **markdown** (bold, lists) so the echoed description reads properly.
