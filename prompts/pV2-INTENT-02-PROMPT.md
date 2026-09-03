# pV2-INTENT-02 — The Inbox Assistant: what's built + the conversational-buildup plan

**Audience:** a fresh Claude Code session picking up the Ballpark v2 inbox "Assistant".
**Repo:** `C:\projects\ballpark` (branch `dev`). Client = `client-v2` (Angular 21, zoneless/signals). Server = `server` (Node/Express + Supabase Postgres).
**How Liam works:** QC on localhost (`ng serve :4201` + server `:3001`, NOT the deployed dev). Build client via `npm --prefix /c/projects/ballpark/client-v2 run build`; bump `client-v2/src/environments/environment.ts` `versionChip`; append an iteration to the relevant `prompts/pV2-*-shipped.md`; commit + push `origin/dev` (a post-commit hook auto-logs — never run it manually). **Server changes need a `preview_stop`/`preview_start` bounce; client rides HMR.** Additive nullable columns are fine after a quick confirm (`ALTER … ADD COLUMN … ` + they read NULL for existing rows). Heavy migrations need an explicit ask.

---

## PART 1 — What the Assistant is today

The **Assistant** is a conversational rail on a single inbox quote line. It replaces a wall of buttons with: a persistent intro, a guided menu (radios + one action button), and a running history log — plus a free-text composer that is parsed by an LLM into structured actions.

### 1.1 Frontend

- **`client-v2/src/app/pages/projects/agent-rail.component.ts`** — the reusable rail (`<app-agent-rail>`).
  - **Input:** `context = input.required<AgentRailContext>()` — `{ projectId, lineId, itemName, baseCost, unit, quantity, currentTotal, currentUnitCost, installCost, installUnit, installApplies, deliveryDate, acceptedAt, currentDescription, componentNames, role: 'agent'|'supplier', currencyCode, canAccept, canDecline }`.
  - **Outputs:** `changed`, `accept`, `decline(reason)`, `suggestCost({ unitCost, total, message, installed })`, `sendMessage(text)`, `quickAction(key)`, `editClientDescription`.
  - **Layout (v2.240):** persistent intro at top → the interactive **menu** (`showOptions`) → **history log** (`turns`) below → composer pinned to the bottom. `step` signal drives the menu: `'root' | 'accept' | 'decline' | 'change' | 'suggest'`. Concluded actions push a history turn (`conclude(kind, detail?)`) with a bold "Accepted/Declined/Sent · <time-ago>"; a sent update keeps its message text in the log.
  - **Guided flow:** radios + a single action button (not fire-on-select), EXCEPT `Make a change` sub-picks auto-advance (`pickChange`). `Back` anywhere returns to the menu (never a dead end).
  - **Suggest-new-price form:** New cost / Qty / Unit (picklist, right-aligned) / Install checkbox → live **Total**; Total is a comma-grouped **text** input (`fmtTotal`/`onTotalInput`) and is editable. **Rule:** New cost filled → per-unit; edit the Total → it clears cost + install and becomes a **flat** total. Reopen seeds from stored values (`currentUnitCost`, `currentTotal`).
  - **Typed path:** `send()` → `projects.parseIntent(...)` → actions filtered by `permitted(a)` → rendered as chips (Apply/Send) + suggestion pills.
  - **`autoApply` (OFF by default):** fast-tracks ONLY the supplier's own **buildup** edits (`set_base_cost` / `set_base_description` / `upsert_extra`, all reversible in Customize) — **negotiation always confirms** (accept / decline / suggest / send). It's an opt-in convenience for the supplier's own line, NOT a licence to auto-commit LLM output; under `autoApply` a misparse changes the supplier's own line until they fix it in Customize.
  - **Role gate (`permitted`)**: `set_base_cost` / `set_base_description` / `upsert_extra` are **supplier-only**; the agent gets `draft_message` (it "asks", the supplier "applies"). `accept_cost`/`decline` gated by `canAccept`/`canDecline`; `suggest_cost`/`draft_message` allowed for both.
  - **Buildup apply (`applyBuildup`)**: supplier edits go through `projects.saveComponents(...)` (the shared revised formula).

- **`client-v2/src/app/pages/inbox/inbox-project.component.ts`** — the host. Mounts `<app-agent-rail>` as a third column; builds `agentContext` (computed); handles the outputs: `onAgentAccept`, `onAgentDecline(reason)`, `onAgentSuggestCost(payload)`, `onAgentSend(text)`, `onAgentQuick(key)`. `itemAction(itemId, action, price?, text?, installCost?, flatTotal?)` posts a negotiation reply. Also mounts the **Customize** dialog and the header **Details** icon (opens Customize; v2.238/239, both roles).

- **`client-v2/src/app/pages/projects/customize-dialog.component.ts`** — the buildup editor ("Customize"/"Details"). Base row (rate × qty), component rows grouped by category, margin, an **"included"** toggle per row, a live **Total** seeded from `currentPrice` so `base + upgrades = current`. Base rate = `baseUnitPrice` input = `price_ref` (deliberately never re-derived — a re-derivation was a base-cost-drift SEV1). "Send New Cost" emits the rolled-up total as a negotiation move.

### 1.2 Server

- **`server/src/services/intent.service.js`** — `parseIntent(message, context)` on **`claude-haiku-4-5-20251001`** (`@anthropic-ai/sdk`; `ANTHROPIC_API_KEY` in root `.env` — never print it). `buildSystemPrompt` is **role-aware** (`agent (the buyer)` vs `supplier (the seller)`). Returns `{ reply, actions[], suggestions[] }`. Action types: `set_base_cost`, `set_base_description`, `upsert_extra` (supplier edits), `accept_cost`, `decline`, `suggest_cost`, `draft_message` (agent asks). `sanitize()` whitelists/coerces and **loops the actions array** — multiple actions per reply already supported. Route: `POST /api/projects-v2/:id/items/:itemId/parse-intent` (`server/src/routes/projects-v2.js:275`).
  - **Auth today:** behind the v2 `authenticate` middleware, but the handler is a **pure transform** — it **ignores `:id`/`:itemId`, reads no DB**, and only feeds the caller's own `message` + client-supplied `context` to the LLM (real writes re-check org on their own endpoints — see the route comment). So there's no data-scoping gap *now*.
  - **⚠ Auth when Part 2 lands:** the moment state-awareness makes this route **read** the line/thread state to build the prompt, it MUST re-derive `org_id` from the JWT and verify the caller participates in `:id` and may see `:itemId` **before** reading it — otherwise the Assistant becomes a cross-org data-leak vector (RP-11 / Rule-10 per-endpoint org check). Non-negotiable.

- **Negotiation + threads** — `server/src/services/inbox.service.js`: `sendOutreach` (fan-out per category, only `status IS NULL` lines), `getSupplierThreads` / `getAgentThreads` (group messages per category[/supplier], resolve items via **`getByMessages(all-brief-ids, { sentOnly:true })`**), `reply` (posts a bubble + per-item actions; `adjust` carries `{ price, installCost, flatTotal }`). `toThreadItem` exposes `priceRef/priceCurrent` (LINE totals), `unitPriceRef/unitPriceCurrent` (per-unit), `flatTotal`, install basis, per-side accept.

- **Line state** — `server/src/services/message-item.service.js`: `transitionItem` (writes status + the price columns; `price_current` and `flat_total` are a **mutually-exclusive pair** — setting one NULLs the other), `getByMessage`/`getByMessages` (thread items; `sentOnly` keeps only briefed lines so un-sent buildup children don't leak), `recordDecision`.

- **The ONE line formula** — `server/src/services/line-total.util.js`: `lineTotalSql(priceExpr, { flat })`. `{ flat:true }` wraps it `COALESCE(pi.flat_total, per_unit×qty+install)`. Used by inbox Revised, thread quote_total, and `projects.service` `LINE_TOTAL_SQL` → inbox, quote AND Customize all read the same number.

- **Buildup persistence** — `server/src/services/projects.service.js`: `saveComponents(orgId, projectId, parentLineId, components, revisedPrice, marginPct, parent{…})` reconciles child components (`parent_id`) and rolls base+components+margin into the parent `price_current`. `listComponents` reads them back for the dialog.

### 1.3 Pricing / data model (`project_items`)

Per-unit: `base_price` (snapshot), `price_ref` (briefed per-unit / "Original"), `price_current` (negotiated per-unit / "Revised"). Flat override: **`flat_total`** (nullable; when set, `price_current` is NULL and it wins the line total). Install: `install_cost` + `install_unit` (`per_order`|`per_item`|`percentage`), line value overrides catalogue via `COALESCE(pi.install_cost, i.install_cost)`. Buildup: `parent_id` (component child), `margin_pct`, `kind`. **Options:** `option_of_line_id` (an alternative the customer picks — surfaces in the Quote's Options panel). Send state: `status` (NULL = cart/to-send; `brief_sent`/`adjusted_by_*`/`accepted`/`declined_*`). `quantity`, `unit`.

### 1.4 Recent ships (context)

- v2.238/239 — header **Details** icon opens Customize (both roles).
- v2.240 — Assistant layout: persistent intro → menu → history; itemised "Sent" keeps its message; Accept is a menu step.
- v2.241 — reopen Suggest with the stored per-unit cost; unit right-aligned.
- v2.242 — **`flat_total`** override: per-unit vs flat line pricing, mutually exclusive, honored by the shared formula (see `project_flat_total_pricing` memory).
- v2.243 — inbox: items added to an **existing** category after first outreach now show (thread reads items from ALL its briefs, not just the lead), `sentOnly` keeps briefed lines.

### 1.5 Gotchas (read before editing)

- **`.bp-card` cascade:** `.bp-card` (styles.css) hard-sets `display:block` + `overflow:hidden` and beats equal-specificity Tailwind utilities. Use an inline `style="display:flex"` / `style="overflow:visible"` to win. (Bit us at v2.189, v2.220.)
- **Lock-gating:** the `/items/:itemId` PATCH (qty/installed) **409s** an out-for-quote line. The negotiation `reply`/`adjust` and the `/details` PATCH are NOT gated — do install/price changes through the **adjust**, not the PATCH.
- **Components vs lines:** a buildup child (`parent_id` set) with `status = NULL` is *not* a thread line; `sentOnly` hides it. Only briefed lines (`status IS NOT NULL`) list.
- **Assistant is stateless today:** `parseIntent` sees only the current typed message + `context` — it has NO memory of the thread/negotiation state. (This is the crux of Part 2.)

---

## PART 2 — The plan: the conversational-buildup loop

**Goal:** let both sides build up and agree a line's contents through plain conversation, with the deterministic guided flow (radios + confirm) doing anything that changes money/state. The AI only does the **fuzzy front door** (draft a request, propose candidate components); the **guided flow commits**. Customize becomes the *view* of what the conversation assembled.

### 2.1 The loop

| # | Who | What happens |
|---|-----|--------------|
| 1 | **Agent** | Requests an extra ("add insurance") → drafted as a message **tagged to the line** |
| 2 | **Supplier** | Assistant intro is **state-aware** ("The agent asked about insurance…") → guides ("can you provide it? options? cost?") → a plain answer builds the component(s) — as **options** (choose one) or **add-ons** (both) → laid out in Customize → offers to send |
| 3 | **Agent** | State-aware intro → the options shown as **guided radios** (pick one / decline both) → the pick **builds + "includes"** the component in the price |
| 4 | **Agent** | **Itemised accept**: base + chosen option = total, editable summary message, Yes / No / Decline |
| 5 | **Supplier** | State-aware intro ("*\<name\>* selected full insurance and accepted £3,500 — what do you want to do?") → Accept the cost / Cancel the request / Make a change |

Worked example: Totem £1,500. Supplier offers **weather/natural-disaster @ £500** OR **cancellation-any-reason @ £2,000** as two OPTIONS. Agent picks cancellation → Revised = £3,500 → itemised accept (Totem 1,500 + Insurance Full 2,000 = 3,500) → supplier sees "\<name\> accepted £3,500".

### 2.2 Backlog (in `shared.backlog`, area `inbox-assistant`, env `dev`)

1. **[high] Tag the agent's request to the selected line.** Today the agent's `draft_message` posts as a **General (untagged)** thread message. Carry the selected `lineId` as `taggedItemId` on the reply (`InboxReplyBody.taggedItemId` already exists) so it filters under the item. *Small, unblocks everything — do first.*
2. **[high] Supplier Assistant: request-aware guidance + multi-component + state-aware intro.** (a) Feed the pending agent request + latest thread state into `buildSystemPrompt` so the intro summarises it. (b) A multi-`upsert_extra` example in the prompt (`actions[]` + `sanitize` already loop). (c) After the answer, lay pieces out in Customize + confirm "want me to send the customer these options?". **Distinguish options (alternatives, `option_of_line_id`) vs add-ons (both, `parent_id`).**
3. **[high] Agent Assistant: guided option pick → include-via-response → itemised accept.** Show supplier options with the existing radio pattern (pick one / decline both). The pick flips the chosen option to **"included"** (counted in the price); declined stays out. Then an **itemised** accept confirm (base + option = total + editable message + Yes/No/Decline) — an upgrade of the current total-only confirm.
4. **[medium] Dedicated free-text "Add extras" input.** A special field where the agent types "I need 6 tablecloths" / "wine for 100, max £10pp". Scoped to the ITEM, the AI extracts: component name, qty, a price in mind (target / per-head cap), or "wants the options", and drafts the item-scoped request.

### 2.3 Principles / guardrails

- **Deterministic-first.** The LLM *suggests*; the guided radios + a confirm step *commit*. A misparse must never silently change a line. (The one exception is the opt-in `autoApply` — OFF by default — which fast-tracks only the supplier's own reversible buildup edits, never cross-party negotiation.)
- **Reuse the built flow.** Accept/decline/change radios, `conclude`, the confirm step, `itemAction`, `saveComponents`, the shared `lineTotalSql` — extend, don't reinvent.
- **State-awareness is the backbone — but the scope is all in the DB.** The one genuinely new capability is giving the Assistant the line's + thread's current state so both intros are contextual. This is a **read**, not new storage. The AI's scope comes from two existing tables, both already carrying item / status / description / cost:
  - **`project_items`** = the LINE (negotiated snapshot): `name`, `status`, `description`, `price_ref`/`price_current`/`flat_total`, `quantity`, `unit`, install basis — the LIVE truth. **Components (`parent_id`) and options (`option_of_line_id`) are `project_items` rows too** — same table, same columns (`name`/`status`/`description`/cost/`quantity`/`unit`) — one recursive line-tree. So the AI reads the parent **and** its components **and** its options uniformly from a single query; no special shape per level.
  - **`items`** = the CATALOGUE canonical (`name`, `description`, `base_price`, install) — the reference the line was cloned from.
  - Plus thread history: `messages`, `message_item_decisions` (last accept per side), `status` transitions (last action per side).

  So widen `parseIntent`'s `context` from today's thin slice (`itemName`/`baseCost`/`unit`/`quantity`/`componentNames`/`currentDescription`/`role`) to this DB-derived line state. Line = live truth; catalogue = reference. **Assemble the state summary in CODE** (from `status` / `message_item_decisions` / `messages`) — do NOT ask the LLM to summarise the thread, or you reintroduce the drift the deterministic-first rule exists to prevent. This server-side read is also where **org-scoping is enforced** (verify participation before reading a line's state into the prompt — see §1.2 ⚠).
- **Options vs add-ons is the trap.** "2 insurance options" = pick ONE (`option_of_line_id`), not two add-ons stacked. The AI must classify; the confirm step must make it visible before committing.
- **Customize is the escape hatch.** Whatever the conversation assembles must be viewable AND fixable in Customize — it's the deterministic manual editor of last resort. So everything the Assistant writes goes to the SAME `project_items` (base / components / options / `included` flag) that Customize reads and edits, through the SAME shared formula. If the AI gets something wrong, opening Customize and fixing it by hand must Just Work and stay consistent everywhere. Never invent an Assistant-only representation Customize can't see.
- **Ask when unsure.** If the parse is low-confidence or the request is ambiguous (options vs add-ons, missing qty/price, which item), the Assistant ASKS a clarifying question instead of guessing or committing. Prefer a short clarify turn (or a guided radio) over a wrong write — the confirm step is the floor, a clarifying question is better still.

### 2.4 Suggested build order

1. Tag the request to the line (backlog #1).
2. Feed thread state into the supplier prompt → state-aware intro + request-aware guidance (backlog #2a).
3. Multi-component creation from one reply, options-vs-add-ons classification (backlog #2b/c).
4. Agent-side guided option pick → include (backlog #3, first half).
5. Itemised accept confirm (backlog #3, second half).
6. Dedicated extras inputs on both sides (backlog #4).

Ship each behind a confirm, QC on localhost, and it stays basic in practice even though the loop reads long.
