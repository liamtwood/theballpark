# pV2-BUILDUP-04 — supplier edits line details (description + Services) in the inbox

**Shipped:** 2026-08-27, chip `[Dev v2] v2.67`
**Commit:** `<pending>`

The lightweight substitute for the shelved composition/options feature: instead
of a structured build-up, the **supplier annotates the project line in prose** —
so when they change an item (upgrade to a Gourmet menu, add a fridge) they can
**record it** on the line. Reuses the exact editable item card that fed the
Customize screen.

## What landed

### Inbox — "Edit item" on the supplier's line
- New **Edit item** button (pencil) on the supplier's selected-line header
  (supplier-only; the agent doesn't see it). Toggles an inline editor in the
  thread pane (replaces the conversation, like Customize did).
- The editor is the same **`app-item-preview` in editable mode** reused from
  Customize — **Name, Description, and Services** are editable. **Save details**
  / **Cancel**.

### Server — a details PATCH that isn't lock-gated
- New **`PATCH /api/projects-v2/:id/items/:itemId/details`** →
  `projects.updateLineDetails`. Saves `name` / `description` /
  `install_description` (Services); only provided fields change.
- **Not lock-gated** (the existing quantity/installed PATCH 409s a line that's
  out-for-quote — exactly when the supplier needs to annotate). Authority: the
  caller owns the row — their own per-supplier fan-out row (supplier) OR the
  project's canonical row (agent).
- **No schema change** — both columns already exist. `QUOTE_LINE_JOIN` already
  `COALESCE`s the line's own `description`/`install_description` over the
  catalogue's, so edits show immediately in the **inbox card and Final Quote**.

## Notes
- Supplier-only in the UI; the endpoint also permits the agent's canonical row
  (unused today) if we later want agent-side annotation.

## Iteration — v2.81 (2026-08-27): Details header shows a running total
- The Details header now shows a **total on the right**, but **only when lines
  carry costs** (sum of each line's trailing "= <total>", incl. manual ones like
  "fridge = £150"). Live in the editor (recomputes as you type), and on the
  read-only card. Symbol follows the **lines' own sign**, falling back to the
  supplier currency for unsigned entries.

## Iteration — v2.80 (2026-08-27): Details calc defaults to the SUPPLIER currency
- An unsigned "qty@price" defaults the total's symbol to the **line's supplier
  currency** (`orgs.default_currency`), falling back to the project currency,
  then £. Carried on the QuoteLine as `supplierCurrency` via
  `o.default_currency` in `QUOTE_LINE_JOIN`. A typed `$`/`£` still wins.

## Iteration — v2.79 (2026-08-27): Details calc defaults to the project currency
- An unsigned "qty@price" defaulted the total's symbol to the **project's
  currency**. Plumbed `currency` onto the inbox project summary (kept as the
  fallback after supplier currency). Superseded by v2.80.

## Iteration — v2.77 (2026-08-27): "Details" section — bulleted extras saved as components
- New **Details** section under Services on the revised edit card: an
  auto-bulleted textarea (Enter finalises the line + starts a new "• " bullet).
- Each line = a **name-only child component** (reuses `saveComponents`, which also
  clones each name up to the org's reusable component library). **No price impact
  — excluded from totals like every component.**
- Inline calc: a "qty@price" in a line auto-totals into the text
  (`Wine Pairing 100@£15` → `Wine Pairing 100@£15 = £1500`); forgiving of $/£ and
  a trailing "=", idempotent.
- The line carries its extra names via an `array_agg` in `QUOTE_LINE_JOIN`
  (`extras: string[]`); the read-only card lists them as bullets under Details.

## Iteration — v2.74 (2026-08-27): edit the price on the revised card → triggers a cost proposal
- The revised-card editor now also lets the supplier **change the price** (new
  `item-preview` inputs `priceEditable` + `priceChange` output — a number input
  in place of the price display).
- On **Save**, if the price changed, it fires the **same "New Cost Suggested"
  proposal as the propose flow** (`itemAction('adjust', newRate, …)`): posts the
  chat line (`<name> <fromTotal> New Cost Suggested <newTotal> by <actor>`) and
  sets `price_current`. Text-only edits still just save via `updateLineDetails`.
- Totals in the message use `lineCost` (install-aware), matching submitPropose.

## Iteration — v2.73 (2026-08-27): revised card price drops the "From" prefix
- New `item-preview` input `showFromPrefix` (default true); set `false` on the
  revised card (it carries a firm agreed cost, not an indicative "From £X").
  Original card + marketplace/estimate previews keep "From".

## Iteration — v2.72 (2026-08-27): revised card appears once (latest revision)
- The revised item card previously rendered under **every** "New Cost Suggested"
  message. Now it renders **only under the most recent** proposal
  (`lastProposalMessageId`), so it appears once and reflects the last-edited
  line. Original card untouched.

## Iteration — v2.71 (2026-08-27): hide the store-item link on inbox cards
- New `item-preview` input `showStoreLink` (default true); set `false` on the
  inbox conversation cards (original + revised) so the header no longer shows the
  "view/edit product" link (external-link square-with-arrow) that jumped out to
  the library. Other surfaces (marketplace rail, estimate rail) keep it.

## Iteration — v2.70 (2026-08-27): click-to-edit on the REVISED card, not the original
- Moved the inline click-to-edit from the brief "original item" card to the
  **Revised item** card (Liam: "click to edit the revised not the original").
  The revised item is what the supplier changed, so that's the one they annotate.
- Original/brief card is back to read-only; the Revised card is read-only until
  the supplier clicks it → editable (Description/Services/Name) + Save/Cancel.

## Iteration — v2.69 (2026-08-27): edit inline in the conversation, not a button
- Replaced the "Edit item" button + separate editor pane with **inline
  edit-in-place** on the item card in the conversation (Liam: "I was thinking we
  would edit directly in the inbox conversation").
- The brief **item card is read-only; the supplier clicks it → it becomes
  editable** (Name/Description/Services), with **Save / Cancel at the bottom** of
  the card. Agent view stays read-only (no click-to-edit).
- `item-preview` header controls (store link + minimise chevron) now
  `stopPropagation`, so clicking them doesn't trigger the card's enter-edit.
- Same `updateLineDetails` PATCH; the button + `updateLineDetails` service/route
  from the previous iteration are unchanged.

## Iteration — v2.68 (2026-08-27)
- **Revised item card is now show/hide collapsible**, same pattern as the brief
  "original item" attachment: collapsed = paperclip + name + a muted "Revised"
  pill + chevron; expands in place to the item-preview (minimise chevron).
  Defaults collapsed; independent toggle from the original (different message id,
  same `toggleAttachment(messageId, lineId)` key).
- Name is editable because the shared card exposes it; can be locked to
  description+Services only if wanted.
