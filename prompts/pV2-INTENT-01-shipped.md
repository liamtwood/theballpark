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
