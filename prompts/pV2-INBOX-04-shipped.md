# pV2-INBOX-04 — item-tagged messages + per-item conversation filter

Lets the conversation be drilled to a single item without splitting into
per-item threads. Design locked with Liam + chat (2026-06-29):
- **No schema change** (INBOX.md #10) — tag via an extra `message_items`
  row (item_id only; `name` is the one required field, `price`/`status`
  default). Filter = *message has a `message_items` row for item X, OR has
  none (broadcast)*.
- Untagged messages are **broadcasts** ("10% off all 3", shared PDF) — they
  show at every level; the multi-item brief naturally tags all its items, so
  it shows in every filter.
- Parent (supplier) = full roll-up; item = its tagged messages + the
  broadcasts.

## Slice 1 — tagging (data foundation)

**Shipped:** 2026-06-29, chip `[Dev v2] v2.36e`

### What landed
- **Tagging writes (`reply()`):** an action tags its item; a free-text
  message composed with an item selected tags it via `taggedItemId`. Each
  tag is a pure `message_items` row `(message_id, item_id, name)` on the
  reply bubble — no price/status (defaults), never fetched as an item, never
  transitioned. No migration.
- **Reader surfaces tags:** `fetchTags` builds message_id → [catalogue
  item_id]; every bubble carries `taggedItemIds` (empty = broadcast); thread
  items carry their catalogue `itemId` (the match key).
- **Selection groundwork:** no item is auto-selected — you land on
  thread-level chat (broadcast); selecting an item arms its actions + tags
  the next chat; clicking it again deselects. (The two-row supplier card,
  the per-item filter, the scoped header, and the untagged "(general)"
  treatment are slice 2.)
- Verified on live data: the brief is tagged to all 3 items; chat + legacy
  actions are untagged broadcasts; items expose `itemId`.

### Files touched
| File | Notes |
|---|---|
| server/src/services/inbox.service.js | tag writes in `reply()`; `fetchTags`; `toBubble`/`toThreadItem`/`makeThread` + readers |
| server/src/routes/inbox.js | `taggedItemId` in the reply schema |
| client-v2/.../core/inbox/inbox.service.ts | `taggedItemIds` on bubbles, `itemId` on items, `taggedItemId` on reply |
| client-v2/.../pages/inbox/inbox-project.component.ts | chat sends `taggedItemId`; no-auto-select selection model |
| client-v2/src/environments/environment.ts | chip → v2.36e |

### Concerns not in spec
#### Legacy messages are untagged (forward-only)
**What:** action/chat messages created before this slice have no tag rows,
so they read as broadcasts (show in every item filter). New messages tag
correctly. Acceptable for dev data; no backfill. **Severity:** LOW

## QC notes
(Liam)

## Chat audit
(chat)
