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

## QC notes
(Liam)

## Chat audit
(chat)
