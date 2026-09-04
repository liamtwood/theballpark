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

## Iteration — v2.215 (2026-09-02): wrap-up — "anything else?" + send an editable update
- After a buildup change the Assistant asks **"Anything else you'd like to change?"**
  and offers **Send them an update** → drafts an editable message from the session's
  change log ("Hi — I've updated Italian Dinner: updated the description; added Wine
  pairing at £15 per head. Let me know if that works.") → the user edits it and hits
  **Send** (posts to the conversation via the existing composer path).

## Iteration — v2.216 (2026-09-02): "Auto-apply" toggle (let the Assistant do it)
- Added an **Auto-apply** toggle in the Assistant header (default OFF = confirm-first,
  tap Apply). When ON, parsed **buildup edits** (base cost / description / extra)
  apply automatically after the message — **accept / decline / suggest / send still
  ask** (never auto-run irreversible/negotiation moves). Mirrors Claude's
  "let the assistant do it".

## Iteration — v2.217 (2026-09-02): send arrow inside the message field
- The Assistant composer sits at the bottom of the rail (as before); the **up-arrow
  send** now lives INSIDE the message field (absolute bottom-right, disabled until
  there's text) and the separate Send button is removed. Enter still sends.

## Iteration — v2.218 (2026-09-02): composer pinned to the dead bottom + visible send arrow
- The rail card now **fills the column** (`flex-1`), so the composer pins to the
  dead bottom (Claude-style) instead of sitting under short content.
- Fixed the send button: the arrow was invisible (`--theme-accent-contrast` gave no
  contrast on the pink) — now **white** at strokeWidth 2.5; added `resize-none` so
  the textarea's resize handle no longer pokes through the circle.

## Iteration — v2.219 (2026-09-02): actually pin the composer — fix the flex chain
- v2.218's `h-full` didn't resolve because the inbox `aside` was `xl:block` (no
  height context). Made the aside `xl:flex xl:flex-col` and the rail card `flex-1`,
  so the card fills the column, the messages area grows, and the composer pins to
  the dead bottom.

## Iteration — v2.220 (2026-09-02): the ACTUAL fix — .bp-card display:block beat flex
- Root cause found: `.bp-card { display: block }` (styles.css:785) overrode the
  Tailwind `flex` utility (equal specificity, later in source — same cascade trap
  as the v2.189 overflow one). The rail card was laying out as block, so the
  composer just stacked after the content with empty space below. Fixed with inline
  `style="display: flex"` on the card (inline beats the class); flex-col + flex-1
  now work and the composer pins to the dead bottom.

## Iteration — v2.221 (2026-09-02): richer Accept confirm (radio == typed) + message blink
- **Accept confirm** now reads "Accept **£19,140** with delivery <event date> and
  send a confirmation message?" with **Back / Accept** — and the **typed** path
  ("accept", "approved", "good for me") routes to the SAME confirm turn instead of
  just applying + "I've done it". Added `deliveryDate` (formatted project event
  date) to the rail context.
- On Accept the confirmation posts to the conversation (existing accept handler) and
  the **newest bubble blinks twice** (`.bp-blink` ring flash, works over the
  gradient bubbles) via `blinkMsg` + `$last`.

## Iteration — v2.222 (2026-09-02): fix the message blink
- The blink wasn't firing: the ring used `color-mix(… transparent)` (likely
  invalid → no visible shadow) and the 1.8s flag could expire before the accept
  reply+reload mounted the new bubble. Switched to a **solid `var(--theme-accent)`
  ring** and widened the window to **3.5s** so the freshly-mounted bubble runs the
  animation.

## Iteration — v2.223 (2026-09-02): auto-scroll to the newest message (blink now visible)
- The conversation never auto-scrolled, so a new message (incl. the accept
  confirmation) landed below the fold — you saw neither the message nor its blink.
  Added a `#msgScroll` ref + an effect that scrolls to the bottom whenever
  `visibleMessages()` changes (any send / accept / reload). The newest bubble is
  now in view, so its ring-flash is visible.

## Iteration — v2.224 (2026-09-02): highlight instead of animate (reliable)
- The keyframe flash never showed reliably (mount/reload timing, and the bubble's
  own box-shadow). Swapped `.bp-blink` for a **static solid accent ring**
  (`box-shadow … !important`) held for the ~3.5s window — no animation timing to
  misfire, and !important beats the bubble's shadow. The newest bubble now clearly
  rings after Accept.

## Iteration — v2.225 (2026-09-02): high-contrast highlight (was pink-on-pink)
- The held ring used `--theme-accent` (pink) over the pink "You" bubble → invisible.
  Switched to a **high-contrast dark `outline` (--color-text)** with offset, which
  reads on any bubble and sits on top (not affected by the bubble's own shadow).

## Iteration — v2.226 (2026-09-02): the actual blink bug — wrong handler
- Root cause: the accept confirm emits `quickAction('accept')` → `onAgentQuick`, but
  `blinkNextMessage()` was only in `onAgentAccept` (the `(accept)` output path, never
  hit by the confirm flow). So the blink flag was never set. Added
  `blinkNextMessage()` to the `onAgentQuick` 'accept' case. (v2.223–225's scroll +
  high-contrast outline were still needed for it to be visible.)

## Iteration — v2.227 (2026-09-02): don't leave them in limbo + smaller buttons
- After Accept/Decline concludes, the Assistant now shows a **bold outcome line with
  time-ago** ("**Accepted** · just now" → "5 mins ago" → "2 days ago") and then
  **re-shows the options** ("Is there anything else?" + Accept / Decline / Make a
  change) so the user always has a next step. `menuOpen`/`showOptions` gate the
  re-shown menu; `conclude()` posts the outcome + reopens; `timeAgo()` formats it.
- **Buttons shrunk** to the inbox **Send size** (`bp-send-btn`) instead of the big
  full-width `bp-btn-grad flex-1` — Accept / Decline / Continue / Send-update /
  draft Send; Back is a compact text button.

## Iteration — v2.228 (2026-09-02): close two termination gaps (path trace)
- **Back** from the Accept confirm now re-opens the options (`dropTurn` sets
  `menuOpen`) — previously it could leave the menu hidden (dead end).
- **Send them an update** now concludes ("Sent · just now") and re-opens the
  options, instead of a bare "Sent ✓" with no next step.

## Iteration — v2.229 (2026-09-02): "Accept the cost (accepted N mins ago)"
- When the current viewer's side has already accepted the line, the **Accept the
  cost** option now shows a muted **"(accepted N mins ago)"** and stays visible even
  when Accept wouldn't otherwise show (terminal) — a neat way to always surface it.
- Server exposes `buyerAcceptedAt` / `sellerAcceptedAt` on the item (from the
  decision timestamps); the inbox passes the viewer's side as `acceptedAt` (ms) to
  the rail; the radio shows `canAccept || acceptedAt` and appends `timeAgo`.

## Iteration — v2.230 (2026-09-02): Suggest new price form in the Assistant
- "Make a change → Suggest new price → Continue" now opens an **in-Assistant form**
  — **New cost · Qty · Unit · Total** (total = cost × qty, live) — instead of
  bouncing to the inbox rate input. **Suggest** sends the line total (host converts
  to the per-unit rate + posts the "New Cost Suggested" message, which now blinks),
  then concludes + re-opens the options. Seeded from the line's current per-unit
  cost + qty.

## Iteration — v2.231 (2026-09-02): Suggest form — unit picklist, boxed total, editable message
- Unit is now a **picklist** (the units list, click to choose); **Total** sits in a
  matching boxed container. Added a **"Message to send"** editable textarea that
  auto-fills "<item> cost updated to £X, please see the updated item attached." and
  keeps in sync with the total until the user edits it (`reseedMsg` / `msgTouched`).
- `suggestCost` now emits **{ total, message }**; the inbox posts that exact message
  with the New-Cost adjust (was a fixed "New Cost Suggested" line). The typed
  suggest path builds the same message.

## Iteration — v2.232 (2026-09-02): editable total, uniform fields, select centering
- **Total is now editable** (its own boxed input with a £ prefix) — it tracks
  cost × qty until you override it (`sugTotal` signal + `totalTouched`). Editing the
  total **clears the per-unit cost** (it's now a flat price), per Liam. Send is
  gated on the total (not cost) so a flat total still sends.
- All four fields (**New cost / Qty / Unit / Total**) share the same size (`h-9
  w-32`); larger max so £10,000+ is fine. Fixed the unit **select** vertical
  centering (`leading-normal`, consistent height/padding).

## Iteration — v2.233 (2026-09-02): Suggest price — install-aware total + seed from current (DB-checked)
- DB check: the active Italian Dinner line has no own `install_cost` but inherits
  **10% from the catalogue**, so a suggested £14k (rate 93.33) rendered as
  £15,399.45 on accept (goods × 1.1). Two fixes:
  - **Install-aware total:** the form's Total is now the LINE total (goods +
    install); on Send the inbox back-computes the per-unit rate (`rateForLineTotal`)
    so the line total equals what you typed — install no longer stacks on top.
  - **Seed from current:** the form seeds `New cost` from the line's CURRENT
    per-unit (`currentUnitCost` = price_current), not the original price_ref, so a
    prior suggestion shows on reopen instead of the old 105/£15,750.

## Iteration — v2.234 (2026-09-02): Install checkbox in the Revise-cost form
- Added an **Install ({basis})** checkbox to the Suggest-new-price form (shown only
  when the line has an install cost), seeded from the current installed state.
  Toggling it re-computes the Total (goods ± install). On **Send** the inbox
  **persists the install choice** (`setQuoteItemInstalled`) then backs out the rate
  for the chosen state, so the entered Total is the final price whether install is
  on or off.

## Iteration — v2.235 (2026-09-02): flat-total unchecks install too; make-a-change auto-advances
- Overwriting the **Total** now also **unchecks Install** (as well as clearing the
  per-unit cost) — a flat total is the final price, no install added.
- **Make a change** no longer needs a **Continue**: selecting a sub-option radio
  (Suggest new price / Change item / Add extras) **auto-advances** — Suggest opens
  the form immediately; Change item / Add extras drop the hint. (Back still there.)
  Removed the `changeSel`/Continue machinery.

## Iteration — v2.236 (2026-09-02): FIX bad bugs — install PATCH 409 aborted the send
- **Root cause:** `await setQuoteItemInstalled` (added v2.234) threw a **409** — that
  PATCH is lock-gated on an out-for-quote line — which **aborted the whole handler**,
  so Send posted **no message** and the price never changed (reopen showed the old
  value). Removed the install-flag persistence entirely.
- Now the entered **Total is the final price** regardless: the rate is backed out
  against the line's **actual** install state (`rateForLineTotal(it, total)`), and
  the message + price always post. The Install checkbox only shapes the Total you
  enter (a lower/higher number that then becomes the final). Reopen reflects it
  (seeds from `price_current`).

## Iteration — v2.237 (2026-09-02): flat total is stored & round-trips (Total is source of truth)
- **Reopen now shows what you sent, not a reconstruction.** The form seeds the
  **Total from the current line total** (source of truth) and leaves **New cost
  blank** — type a cost to switch to a per-unit calc. So a flat £16,000 reopens as
  £16,000 (cost blank), not 96.97/head × install.
- **Install persists through the negotiation** (not the lock-gated PATCH): the
  Suggest emits `installed`, and the inbox passes `installCost` on the adjust
  (`0` to turn install off, confirmed written by `transitionItem`), computing the
  rate for the chosen state. So unticking Install for a flat price sticks — reopen
  shows Install unticked.
- Known edge: re-ticking Install after a flat send doesn't restore the original
  catalogue % (it was zeroed); use Customize if you need it back.

## Iteration — v2.240 (2026-09-03): Assistant polish — comma Total, right-aligned Unit, persistent intro + history log
- **Total** is now a comma-grouped text input (£19,800), still editable + flat
  source of truth (clears cost/install on edit). Number inputs can't group, so it's
  a text input via `fmtTotal()` / `onTotalInput()`.
- **Unit** picklist value is right-aligned (next to the chevron), consistent with
  New cost / Qty / Total.
- **Layout reorder**: the intro ("…pick an option below…") is now persistent at the
  top; the interactive menu (Accept / Decline / Make a change + sub-steps) sits
  directly beneath it; concluded actions and the message you sent log BELOW the menu
  as history. Dropped the "Is there anything else?" heading (the intro covers it).
- **Sent shows the message**: a sent update now keeps its own message text in the
  history ("Italian Dinner cost updated to £19,800…") above the bold "Sent · just
  now" line — so you can see exactly what went out.
- **Accept is a menu step** now (not a floating turn) — Back returns to the options;
  keeps all interaction in the top menu and the log purely below.

## Iteration — v2.241 (2026-09-03): reopen shows the stored per-head cost; unit off the chevron
- **DB check** (public.project_items, "3 Course Italian Dinner"): base_price 105,
  price_ref 105, **price_current 120** (per HEAD, qty 150). The per-unit cost IS
  stored — it was never null. The "NULL" was only the reopen form blanking New cost.
- **Fix**: `pickChange('suggest')` now seeds **New cost from the stored per-unit
  cost** (`currentUnitCost` = price_current), keeping the line Total authoritative
  (no round-trip drift). So reopening shows 120 / head / £18,000, not a blank cost.
- **Unit**: added `pr-7` so the right-aligned value sits beside the native chevron
  instead of jammed under it ("head" was too far right).

## Iteration — v2.242 (2026-09-03): per-unit vs flat pricing — the `flat_total` override
Encourage per-unit pricing but don't block the "just round the whole line up/down"
move suppliers actually make. Added a real slot for a flat line total.

- **Schema**: `project_items.flat_total numeric NULL` (additive, migrate-flat-total.js,
  public + preview). NULL = no override → shared formula unchanged for every existing line.
- **Shared formula** (`lineTotalSql`, the ONE per-line calc): new `{ flat: true }` mode
  wraps it as `COALESCE(pi.flat_total, per_unit×qty+install)`. Applied to the
  current/revised surfaces — inbox Revised, thread quote_total, projects `LINE_TOTAL_SQL`
  — so inbox, quote AND Customize all show the identical number automatically. Original
  (price_ref) keeps the plain formula.
- **Write (`transitionItem`)**: price_current (per-unit) and flat_total are mutually
  exclusive — setting one clears the other. So a line flips cleanly between "£X/head"
  and "£Y flat" with no stale override.
- **Assistant**: New cost present → per-unit (`price_current` = cost, `flat_total` NULL,
  total derives → no rounding drift). New cost blank (they edited the Total) → flat
  (`flat_total` = Total, `price_current` NULL, install off). Reopen shows exactly what
  was stored: cost + total for per-unit; blank cost + flat total for flat.
- **Verified** (read-only): example line price_current 140 × 150 + 10% = £23,100 ✓;
  flat override 25,000 wins ✓.

## Iteration — v2.243 (2026-09-03): inbox — items added to an existing category now show
Bug: agent adds items to a category that already has a thread, sends — the items
don't appear for supplier or agent.

- **Cause**: a thread read its items from only the OLDEST (lead) brief message
  (`getByMessage(g.lead.id)`). Items added later ride a NEW brief in that category,
  so they were invisible. (A brand-new category showed fine — its brief was the lead.)
- **Fix**: `getByMessages(ids, { sentOnly })` unions items across ALL briefs in the
  (category [× supplier]) group, deduped per line. Both thread builders
  (getSupplierThreads / getAgentThreads) now pass every message in the group.
  `getByMessage` delegates to it (unchanged behaviour for brief/message routes).
- **sentOnly**: the union can surface a buildup child that was tagged but never sent
  (status NULL); `sentOnly: true` (inbox only) keeps just briefed lines
  (status IS NOT NULL). Verified on iPuck Launch: Scenic Totem (late-add to Stand
  Structure) now shows for both roles; Staffing's 5 intact.

## Iteration — v2.244 (2026-09-03): Assistant "Add extras" tags kind='extra', not 'estimate'
- Separate client-facing extras from the supplier's private cost buildup. The Assistant
  add-extra (Make a change → upsert_extra) now writes `kind='extra'` on the new component
  (was `'estimate'`) — agent-rail.component.ts:611. Verified nothing filters project_items
  on kind (rollup gates on parent_id IS NULL + included), so price/rollup is unchanged;
  this is purely the type separation. `estimate` stays for the supplier cost decomposition
  (future: a separate "Estimate" entry point to the same Customize UI); `option` reserved
  for the options flow (option_of_line_id). Vocabulary captured in pV2-INTENT-02 §1.3a.

## Iteration — v2.245 (2026-09-03): SEV — outreach must not fan out component children
Bug: `sendOutreach` fanned out EVERY `status IS NULL` line grouped by category, with no
`parent_id IS NULL` filter. A supplier's private cost-buildup children (kind=estimate)
categorised into another band got swept into that band's outreach and **re-owned to a
different supplier** — e.g. Main Stage's Woodworker/Planning/Set-Up Crew (Ballpark's
Supplier, Stand Structure) were briefed to ProBuild Events under Staffing (supplier +
category flipped). A cross-supplier leak of private cost data.
- **Fix:** `sendOutreach` line-selection now `AND pi.parent_id IS NULL` — only top-level
  lines fan out; component children are never independently briefed.
- Blast radius (verified): public only, 5 child rows swept (3 cross-supplier); preview clean.
  Existing bad rows need a one-off cleanup (reset supplier/category/status, drop the tags).

## Iteration — v2.248 (2026-09-04): INTENT-02 #5 — dedicated "Add extras" entry box + suggestion dedupe
- Make a change → Add extras now opens its own step with a labelled entry box
  ("What would you like to add to <Item>? Say what it is and how many — a price too…"),
  routing the scoped request through the same parser (agent drafts the request; supplier
  adds the component). Replaces the type-in-the-composer hint.
- Deduped suggestion chips (case-insensitive) — the parser sometimes returned the same
  next-step twice (QC: "Ask supplier for options" showed twice).
