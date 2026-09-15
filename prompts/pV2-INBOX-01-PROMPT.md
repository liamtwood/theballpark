# pV2-INBOX-01 — canonical brief for CC

Reference mockup: `Screenshot 2026-06-24 193449.png` (supplier shape; agent reuses the same chrome with more rows).

## Core flow

Keep it simple and reuse v1 wherever possible.

**Supplier:** Inbox tab → list of projects where an agent has reached out → click a project → 1 left rail with a list of items (their items only) → select an item → either type a comment, click **Accept**, or click **Propose new price**.

**Agent:** Same shape, more density. The left rail becomes a list of supplier cards, each expandable to that supplier's items. Selecting an item arms the same per-item actions.

The conversation pane on the right is identical for both roles — counterparty name + project + status + total in the header, gradient/white bubbles, compose at the bottom.

## Threading

Threads are per **(project, supplier, category)** — matches v1's stored shape exactly. No migration, no schema change.

## Two entry points, one UI

The same inbox UI is reachable two ways:

1. **Global** — top-level Inbox shows all projects the user is participating in, grouped by project, with conversations nested under each project.
2. **Per-project** — jumping directly into a project's Inbox tab scopes the rail to that one project only.

Same component, parameterised by `projectId | null`.

## Single-category collapse rule

If a thread context has exactly **one category**, skip rendering the category row in the rail and the category segment in the conversation header.

- The rail jumps straight from supplier-row to items.
- The header reads `Studio Build Co · Summer Retail Pop-Up · 2 items` instead of `Studio Build Co · Summer Retail Pop-Up · Audio · 1 item`.

When there's **more than one category**, display them in the rail tree and include the category segment in the header.

This is a pure presentation rule — the data model still threads per (project, supplier, category) regardless.

## Item selection + actions

Selecting an item in the rail does two things:

1. Arms the per-item action buttons in the compose area (**Accept £X**, **Propose new price**, status-aware variants).
2. Tags any message sent next with that item — written as a `message_items` row linking the new `messages` row to the item.

## Bulk action mode (no item selected)

When no item is selected, action buttons render only if the action is **universally valid** for every item in the current category-thread. Firing a bulk action writes:

- 1 `messages` row
- N `message_items` rows (one per affected item)
- N `message_item_decisions` or `message_item_events` rows (the state changes)

No partial-bulk — if Accept doesn't apply to every item in the thread, the chip doesn't render. The user can always pick a specific item for surgical action.

For most threads this means generic chips (`Chase`, `Request status update`) plus, when applicable, one big chip like `Accept all 3 items in Set Build (£X total)`.

## View Marketplace Items

The toolbar's **View Marketplace Items** button is a **link-out** to the marketplace/cart view scoped to items in this conversation. It is not the item picker — the rail is the picker. Build it as navigation.

## Reuse — what's already there

CC's earlier recon confirmed:

- **Data model — 100% reuse, zero schema changes.** `messages`, `message_items`, `message_item_decisions`, `message_item_events` already carry everything: bubble content, per-item status, `price_ref` / `price_current`, decisions, events.
- **Server services — ~85–90% reuse.** `message.service.getAllForSupplier`, `message.service.getAll`, `message-item.service.getByMessage`, `message-item.service.transitionItem`, `message-item.service.recordDecision`, `STATUS_META`, `aggregateStatus`. The v1 `POST /:id/reply` endpoint already bundles reply text + accept/decline/adjust-price + decision + email.

## What's net-new (build scope)

1. **Gated `/api/inbox/*` route layer.** Wrap the existing services with a v2 router that derives `supplier_org_id` / `agency_org_id` from `req.user.org_id` and verifies participation. Closes the RP-INB1 violation (v1 routes trust client-supplied IDs). Small — the services already take the org as an argument.
2. **v2 Angular UI.** Built fresh on v2 standards: standalone components, OnPush, signals, `inject()`. The 2-col surface (left rail + thread pane), role-conditional rail rendering, item picker via rail selection, compose with paperclip + gradient Send, per-item + bulk action chips.
3. **Codelist seed.** Seed the 9 real `message_item_status` codes into the v2 codelist (`brief_sent`, `quoted`, `accepted`, `holding`, `adjusted_by_supplier`, `adjusted_by_agency`, `declined_by_supplier`, `declined_by_agency`, `booked`) so the pills render the actual stored values, decoded for display.

## Build order

CC's suggested order is sensible:

1. Gated `/api/inbox/*` façade + codelist seed (foundation, no UI)
2. 2-col surface + role-conditional rail + item rail-selection + thread pane (read-only first, then writes)
3. Wire entry points (global Inbox nav + per-project Inbox tab) to the same component

## Out of scope for this prompt

- AI routing of free-text messages to items — explicit picker only (decided after customer-AI-suggestion conversation).
- Per-item threading (where each item is its own thread) — rejected in favour of per (project, supplier, category) which matches v1.
- Cross-thread filtering by category in the global view — could be a v.next refinement; not in scope here.
- Notification digesting and throttling — separate prompt.
