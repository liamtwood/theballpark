# pV2-UNIFY-01 — one line-state table (`project_items`); `message_items` → tag join

**Shipped:** 2026-07-08, chip `[Dev v2] v2.47`
**Prompt:** `docs/pV2-UNIFY-01-PROMPT.md`

## Why

Same conceptual line lived in two tables read by two formulas:
`project_items` (cart: qty/install/base_price) via `LINE_TOTAL_SQL`, and
`message_items` (brief: price_ref/current/status) summed per-unit. Result: the
inbox rendered **£105/head** where the Final Quote rendered **£105 × 150 +
install = £17,325**. Two tables for one line always drift. Merge fixes the
class, not just the instance.

## What landed

- **`project_items` is the single line-state table** — gained `status`,
  `price_ref`, `price_current`, `decline_reason` (soft-delete `deleted_at`
  already existed). One row per `(project, item)` — the item's owner
  (`items.org_id`) is the supplier, so the supplier dimension is implicit.
- **`message_items` demoted to a tag join** — `message_id` + `project_item_id`
  (+ trigger-stamped audit columns), meaning "this message references these
  lines." All state columns dropped.
- **`message_item_events` + `message_item_decisions` FKs repointed**
  `message_item_id` → `project_item_id` → `project_items(id)`.
- **One shared formula** — `server/src/services/line-total.util.js`
  `lineTotalSql(priceExpr)`, price-parametrised: estimate binds `base_price`,
  inbox "Original" binds `price_ref`, "Revised" binds `price_current`. The
  four surfaces (Cart / Project Quote / Final Quote / Inbox) can't drift.
- **Inbox render corrected with zero client change** — the reader feeds line
  totals (`price × qty + install`) into the same `priceRef`/`priceCurrent`
  DTO fields the client already renders. Per-unit rate + qty ride along
  (`unitPriceRef` / `quantity`) for any future rate display.
- **Send-state is `project_items.status`** now (NULL = still in cart) — the
  estimate cart-scope, the `sent_status` badge, and the read-only-after-sent
  guard (`isItemSent`) all read the column instead of probing `message_items`.

## Files touched

| File | What |
|---|---|
| `server/src/db/migrate-schemas.js` | pV2-UNIFY-01 block: additive project_items cols; guarded one-time message_items slim-down + FK repoint + negotiation-graph wipe; audit-col re-add. 3 schemas, idempotent. |
| `server/src/services/line-total.util.js` | NEW — the one price-parametrised per-line formula. |
| `server/src/services/projects.service.js` | `LINE_TOTAL_SQL` = `lineTotalSql('pi.base_price')`; `sent_status`, cart scope, `isItemSent` read `project_items.status`. |
| `server/src/services/taxonomy.service.js` | `requestQuotes`: message_items writes are tag rows; per-line `project_items.status='brief_sent'` + price seed + event. |
| `server/src/services/message-item.service.js` | `transitionItem` writes `project_items`; events/decisions → `project_item_id`; `getByMessage` resolves the tag join → project lines + both line totals; fork dropped. |
| `server/src/services/inbox.service.js` | `sendOutreach` scope = `status IS NULL`; `listSupplierProjects`, `fetchTags`, `toThreadItem`, `makeThread`, `reply` on `project_items`. |
| `server/src/routes/brief.js` | Public reply pre-lookup reads `project_items`. |
| `client-v2/src/environments/environment.ts` | chip v2.47. |
| `docs/INBOX.md`, `docs/PROJECTS.md`, `docs/AUDIT_LEDGER.md` | Decision #10 addendum; cart-line schema; RP-INB6 closed. |

## Verification

- **Migration ran on `public` + `preview`** (fully) — verified new
  `project_items` cols, `message_items` tag shape, events/decisions
  `project_item_id`. **`master` is additive-only so far** (has
  `project_items.status`; its message_items slim-down/repoint still pending —
  the guarded block completes on the next full `migrate-schemas` run; master
  is empty so its wipe is a no-op).
- **8/8 reader/estimate queries compile** against the migrated `public`
  schema.
- **End-to-end send→read** on a real project: inbox now renders
  Sit-Down £85/unit × 100 = **£8,500**, Italian £105/unit × 100 = **£11,550**
  (£17,325 at 150 guests), Venue incl. install — matching the Final Quote's
  `LINE_TOTAL_SQL`. Per-unit rendering is gone.

## Concerns not in spec

### message_items keeps its audit columns (spec said 3 cols)
**Where:** `migrate-schemas.js` UNIFY block; `message_items`.
**What:** Shared `audit.stamp_audit_cols` / `forbid_hard_delete` triggers
require `created_by`/`updated_*`/`deleted_*` on every table — a strict
3-column tag join breaks INSERTs. Kept the audit columns; dropped only the
state columns. Functionally the tag join the spec intended.
**Severity:** LOW (necessary deviation).

### The v1 ad-hoc "catalogue fork" was dropped
**Where:** `message-item.service.js` (`maybeForkCatalogueItem` removed).
**What:** In the unified model a cart line is always owned by one supplier, so
the "agency-pending placeholder → winning supplier forks a catalogue item"
path is unreachable (the adjusting supplier already owns the item). Removed
rather than ported.
**Severity:** LOW.

### Per-item `next_action_by` projection lost on the public "holding" flow
**Where:** `brief.js` `/holding`; `transitionItem`.
**What:** `project_items` has no `next_action_by`; the public "back to you by
X" still records the timestamp on the `messages` row (thread-visible) but no
longer on the line. No crash — `transitionItem` ignores the arg.
**Severity:** LOW.

### v1 (`routes/messages.js` + `client-angular` inbox) left broken
**Where:** v1 message routes.
**What:** Built on `message_items.status`/`price`; dropped columns break them
at runtime (parse-clean, so v2 boot is unaffected). Per "v1 never deployed,
dev-mode" this is intended — not dual-maintained.
**Severity:** LOW (accepted by Liam).

### Send routing on a mixed category briefs every picked supplier with every line
**Where:** `taxonomy.service.requestQuotes` (pre-existing, not UNIFY-01).
**What:** A single send with 2 suppliers on one category briefs both with all
that category's to-send lines (competing-quote shape). Separate from the
UNIFY render fix; flag for the "who quotes what" routing review.
**Severity:** LOW (pre-existing behaviour).

## Follow-up required
- **Run `npm run db:migrate:schemas`** (or approve it) to complete the
  `master` schema — the auto-mode classifier blocks the destructive master
  DDL. `public`/`preview` are already migrated; master is empty.

## QC notes
(Liam)

## Chat audit
(chat)
