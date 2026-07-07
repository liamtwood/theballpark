# pV2-CART-01 — Project Cart vs Final Quote, one status per item

Liam's model (2026-07-03): one quote, **each item has a status**, and that's the
only switch between the two views.
- **Project Cart** (renamed from Project Quote) = the **To Send** slice — the
  editable pre-send cart.
- **Final Quote** = **everything**, each item carrying its status **badge**.

## Shipped — chip `[Dev v2] v2.39`

### Foundation (server)
- **Quote line gains `supplierId` / `supplierName`** (item's catalogue owner via
  `orgs`) and a coarse **`status`**: `to_send → out_for_quote → quoted →
  booked / declined`, derived from the item's latest OUTBOUND `message_items`
  status for the project (NULL = never sent = `to_send`).
- **`getEstimate(…, scope)`** — `scope=cart` sums only never-sent items, so the
  Cart's Ballpark = "what's still to send" (verified: cart £482k < all £527k on
  the test project). Card + Final stay on `all`.
- Route: `GET /:id/estimate?scope=cart|all`.

### Project Cart (was the Estimate tab)
- Tab renamed **"Project Cart"**; filters to **To Send** items only (`cartRows`).
- Cat card meta → **"N items from «Supplier»"**, one row per distinct supplier
  in the category (busiest first).
- Footer: **Edit in marketplace** (gradient → items) + **Go with this Ballpark**
  (→ **Final Quote tab**).
- Empty states: "nothing in the cart" vs "everything's out for quote".

### Final Quote
- Per-item **status badge** (muted/warn/success/danger soft tokens).
- Footer: **Add Your Own Line Item** + **Add Suppliers** (→ Marketplace
  supplier mode), side by side. (Removed the duplicate inline dashed add.)

### Files
| File | Change |
|---|---|
| server/.../projects.service.js | supplier + `status` on quote line; `quoteStatus()`; `getEstimate` scope |
| server/.../routes/projects-v2.js | `?scope=` |
| client-v2/.../project.types.ts | `QuoteLineStatus`, supplier/status on `QuoteLine` |
| client-v2/.../project.service.ts | `estimate(id, uninstalled, scope)` |
| client-v2/.../project-estimate.component.ts | Cart: to_send filter, supplier rows, footer, rename |
| client-v2/.../project-final-quote.component.ts | status badge + footer |
| client-v2/.../project-detail.component.ts | tab label, `goToTab`, wiring |

## Not done yet (deliberate — "see how it feels" first)
- **Sent items aren't locked in Final** — you can still edit qty on an
  out_for_quote line. The model says lock them; holding off until the flow feels
  right.
- **Still two components**, not one with a `view` input. Behaviour matches the
  "two views over one list" model; the literal merge is a follow-up.
- **Supplier name = `orgs.name`** — swap to a storefront/profile name later if
  wanted.
- **Cart/custom persistence** (Install choice, custom lines) still in-session.

## Iteration — one component, both views (chip v2.39a)
Merged the two components into one: `app-project-estimate` now takes a
`view` input (`'cart' | 'final'`) and renders the **Cart layout for both**
(Liam: "Project Cart layout should be what we use for both"). `view="final"`
→ shows all items, per-item status badge on each row, custom lines + Add
Your Own Line Item modal, footer = Add Your Own Line Item + Add Suppliers.
Deleted `project-final-quote.component.ts`. Custom lines are raw-added to the
headline on top of the server cascade (unpersisted; flagged). Dropped Final's
old flat card-per-item layout + its "Suppliers N Selected" summary tile (the
merged summary is the Cart's Date/Location/Duration/Guests/Budget tiles).

## Iteration — persist the Install choice (chip v2.39b)
QC: toggling Installed? didn't survive leaving the page. Added
**`project_items.installed BOOLEAN`** (nullable — NULL = default "on when the
item has an install cost", true/false = explicit). Liam OK'd the additive
column (NULL for existing rows).
- `migrate-schemas.js` + a surgical `ADD COLUMN IF NOT EXISTS` across
  public/preview/master (applied to the shared DB).
- Server: quote line returns `installed`; card subtotal + `getEstimate` read
  `COALESCE(pi.installed, true)`; `updateItemQuantity` generalised to
  `updateItem({ quantity?, installed? })`; PATCH body accepts both. Dropped the
  old `?uninstalled=` query param.
- Client: the checkbox now writes through (`setQuoteItemInstalled`, optimistic +
  revert) and seeds from the persisted value — the in-session `uninstalled` set
  is gone.
- Verified live: null→false persists, cart total reflects it, reset to null works.

## Iteration — right-rail item preview + eye toggle (chip v2.39c)
Selecting a line (click its row) shows the **marketplace item card** in a
right rail on both views — reuses `app-item-preview` (the rail card, mapped
from the quote line; no fetch). Its `x` is swapped for an **eye** (new
`closeIcon`/`closeLabel` inputs; marketplace keeps its x). Clicking the eye
sets `previewHidden` → the card is suppressed for **all** selections (shows a
compact "Show preview" eye button instead) until the eye is clicked again.
Rail is `lg:` only (desktop). Selected row gets a `bg-fill` highlight.

## Iteration — Message Suppliers + per-category custom add (chip v2.39e)
Final view:
- Footer is now a single **Message Suppliers** button (gradient) + subtext
  *"Spend a Ball, firm up cost and let's get this show on the road"*. Removed
  **Add Suppliers**.
- Click → confirm dialog (ConfirmService): *"Ready to message suppliers? We'll
  send your project brief, selected line items, quantities, dates and
  requirements to every supplier on this quote. This will spend 1 Ball."* On
  confirm → builds an outreach roster from the **to-send** lines (category →
  distinct catalogue-owner suppliers) and POSTs the existing
  `/api/inbox/send`; items flip to out_for_quote → reload.
- **Add Your Own Line Item** moved out of the footer into a **dashed card
  button at the bottom of each category's items** (expanded, Final only).
  Custom lines now carry a `categoryId` and render inside their category; the
  modal seeds its Category from the one clicked.

**Caveats:** the send reuses v1 `sendOutreach` with `skip_balls:true` — the
"1 Ball" is aspirational, no Ball actually debited yet. sendOutreach still
briefs the whole category (the double-send seam, already parked).

## Iteration — supplier group bands (chip v2.39f)
Within each expanded category, items are now sub-grouped by supplier under a
**thin "«Supplier» · «City»" band** (option 2 — one header per supplier vs
repeating the name on every row). Quote line gains `supplierCity` (orgs.city
join). first-appearance order; applies to both Cart and Final. Category header
keeps its "N items from X" collapsed summary.

## Iteration — "who quotes what" supplier dialog (chip v2.40)
Message Suppliers now opens a **separate dialog** (new
`message-suppliers-dialog.component`) instead of the plain confirm, to nudge
**one supplier per category**:
- Per category, lists the suppliers whose items are in it (with counts).
  Single-supplier categories show a green "1 supplier" pill (resolved);
  multi-supplier ones show an amber "N suppliers" pill + a **primary radio**
  (defaulting to the **majority** owner) + an opt-in "also get competing
  quotes from the other N".
- CTA "**Send N briefs**" reflects the live thread count; "This will spend
  1 Ball." note kept.
- Emits an `OutreachRosterEntry[]`; the parent sends via the existing
  `/api/inbox/send`. **Consolidation model A**: the chosen primary is briefed
  the whole category (existing sendOutreach behaviour) — items from
  non-chosen suppliers ride along to the primary.

**Not done:** the "only «Supplier» offers «Item X» — keep them?" leftover-item
flag isn't built yet (all category items just go to the primary). Still on
skip_balls (no Ball debited). Meg/Beth to settle the 1-vs-many principle +
whether base is priced ex-works (delivery/pickup thread, parked).

## QC notes
(Liam)

## Chat audit
(chat)
