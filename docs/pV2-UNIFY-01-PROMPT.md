# pV2-UNIFY-01 — Unify `project_items` and `message_items` into one line-state table

## Why

Today the same conceptual line lives in two tables:

- `project_items` — cart-side: qty, install, base_price, unit, name, description
- `message_items` — brief-side: price_ref, price_current, status, decline_reason

Cart / Project Quote rail / Final Quote all read from `project_items` via one server cascade (`LINE_TOTAL_SQL` → `computeEstimate()`). The Inbox reads from `message_items` with a different, per-unit-only formula. Result: **the inbox renders £105 per head where the Final Quote correctly renders £105 × 150 + install = £17,325.** Same conceptual line, two representations, two formulas — an inevitable drift class.

The bug is one instance of the fundamental problem: **two tables representing the same line always drift.** We are still in dev mode, so we take the direct fix: unify.

## Target state — one line, one table, one formula

**`project_items`** becomes the single line-state table. Each row = one `(project, item, supplier)`. Carries every attribute today split across the two tables:

| Column | Origin | Purpose |
|---|---|---|
| Existing cart columns | `project_items` | qty, base_price, installed, unit, name, description, install_description |
| `status VARCHAR` | ex-`message_items` | 9 v1 codes: brief_sent / quoted / accepted / holding / adjusted_by_supplier / adjusted_by_agency / declined_by_supplier / declined_by_agency / booked |
| `price_ref NUMERIC(12,2)` | ex-`message_items` | Original per-unit price at brief time |
| `price_current NUMERIC(12,2)` | ex-`message_items` | Current per-unit price after negotiation |
| `decline_reason TEXT NULL` | ex-`message_items` | Optional reason on decline |
| `deleted_at TIMESTAMPTZ NULL` | new | Soft-delete for cart removal so thread decision references don't dangle |

**`messages`** stays unchanged — thread body + free-text bubbles.

**`message_items`** demotes to a stripped **tag join table**: just `message_id + project_item_id`. No state columns. Handles "this message references these items" for filtering (Inbox item-select → filter thread to that item's messages + untagged broadcasts).

**`message_item_decisions`** stays as the decision audit log; FK repoints from `message_item_id` to `project_items.id`.

## Migration — dev mode simplification

**No backfill. No history preservation. No phased rollout.** Existing dev data is disposable.

Steps in `migrate-schemas.js`:

1. **Add columns** to `project_items`: `status`, `price_ref`, `price_current`, `decline_reason`, `deleted_at`. All nullable.
2. **Drop columns** from `message_items`: `price`, `price_ref`, `price_current`, `status`, `name`, `decline_reason`, everything except `id`, `message_id`, `item_id` (rename `item_id` → `project_item_id`).
3. **Repoint FK** on `message_item_decisions`: `message_item_id` → `project_item_id` referencing `project_items(id)`.
4. **Wipe stale rows** in dev — TRUNCATE `messages`, `message_items`, `message_item_decisions`, and clear negotiation state on `project_items` (or just wipe dev projects). Dev mode; no ceremony.

All migrations idempotent + applied to public / preview / master schemas per convention.

## Consumer changes — the four surfaces read one table via one formula

- **Cart / Project Quote / Final Quote** — no change, already read `project_items` via `LINE_TOTAL_SQL` + `computeEstimate()`.
- **Inbox reader (`GET /api/inbox/*`)** — rewrite queries to source qty, install, description, unit, name, price_ref, price_current, status from `project_items` (filtered to the thread's `(project, supplier)` scope). Delete the per-unit-only `SUM(price_ref)` totals path; use the same `LINE_TOTAL_SQL` shape.
- **Inbox reply writer (`POST /api/inbox/threads/:threadId/reply`)** — Accept / Suggest / Decline now update `project_items` directly (status transition + `price_current` write) inside the same transaction that writes the chat bubble + `message_item_decisions` row. `message_items` (the stripped tag join) gets a row per referenced project_item.
- **Send / brief writer (`POST /api/inbox/send`)** — flips `project_items.status` from `to_send` → `brief_sent` for the fanned lines; creates `messages` + tag rows in `message_items`; no longer inserts state columns anywhere (there's nowhere to insert them).
- **CART-01 read-only-after-sent guard** — unchanged in shape, but now checks `project_items.status !== 'to_send'` directly instead of joining to `message_items`.

## Locked design decisions

1. **One row per `(project, item, supplier)`, cycling states.** Re-asking the same supplier after decline does not create a new row — it transitions the existing row back to `brief_sent`. Decision history lives on `message_item_decisions`.
2. **Soft-delete cart lines.** `deleted_at TIMESTAMPTZ NULL`; cart removal sets `deleted_at = NOW()` instead of hard delete. Inbox reader filters `WHERE deleted_at IS NULL` for the active view; the decisions history stays queryable via `message_item_decisions` FK. Zero-ceremony safety net.
3. **`message_items` stripped, not dropped.** Kept as a two-column tag join (`message_id + project_item_id`) for multi-item messages and the item-filter view. Rejected the `project_item_ids uuid[]` array alternative — cleaner joins, matches v2's array-avoidance pattern elsewhere.
4. **No historical hotfix.** Skip the per-item snapshot patch on `message_items` — go straight to the merge. The inbox rendering bug disappears when the reader points at `project_items`.

## Reuse claim

- **Data model:** additive on `project_items` (nullable columns), destructive on `message_items` (schema slim-down), FK repoint on `message_item_decisions`. Dev-mode wipe on existing rows — no data survives the migration.
- **Server services:** the shape of the inbox reply handler stays — same transaction pattern (chat bubble + state change + decision row in one txn), just writes to `project_items` instead of `message_items`. Same for the send / brief writer.
- **UI:** zero component changes required by the merge itself. Inbox render shifts from per-unit to line-total the moment the reader source flips — resolves the bug for free.

## Out of scope

- Any preservation of existing dev data (dev mode; wipe).
- Any changes to the 9 v1 status codes / codelist seed (already correct).
- Any changes to `messages` chrome, chat bubble rendering, or item-tag chip in bubbles.
- Any changes to the Cart / Project Quote / Final Quote surfaces (they already read the right table).
- CART-01's read-only-after-sent guard *behaviour* (still enforced; just checks the field on the same table now).

## Build order

1. **Migration** — add columns, drop columns, FK repoint, wipe dev tables. Verified idempotent across public / preview / master.
2. **Send / brief writer** — smallest downstream change; makes it possible to seed dev data in the new shape.
3. **Inbox reader** — swap query source; verify the four surfaces (Cart / Project Quote / Final Quote / Inbox) all read `£105 × 150 + install = £17,325` for the demo Italian Dinner row.
4. **Inbox reply writer** — Accept / Suggest / Decline update `project_items` in the transaction; decisions FK repoint verified.
5. **CART-01 guard** — retarget the `isItemSent()` check at `project_items.status`.
6. **Sanity sweep** — grep for any remaining `message_items.status` / `message_items.price_current` reads outside the tag join; should be zero.

## Doc updates in the same ship

- `INBOX.md` — decision #10 (no schema changes) needs an addendum noting the UNIFY-01 exception; description of `message_items` demoted to tag join; reader source flips to `project_items`.
- `PROJECTS.md` — cart-line schema note extended with the new negotiation columns.
- `AUDIT_LEDGER.md` — RP-INB6 (cost negotiation state stale) can close — no dual-table drift possible when there's one table.

## Green light

Skip the snapshot hotfix. Go straight to the merge. All four displays read one table via one formula. Ship as pV2-UNIFY-01.
