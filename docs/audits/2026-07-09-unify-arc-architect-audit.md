# UNIFY arc — end-of-arc architect audit (read-only)

**Date:** 2026-07-09
**Scope:** pV2-UNIFY-01 (+01a) and pV2-CUSTOMS-01 — `project_items` as the single
line-state table, per-supplier fan-out, custom (`item_id = NULL`) lines.
**Auditor:** independent architect pass, READ-ONLY. No code changed.
**Standards:** `docs/ENGINEERING.md` (hygiene rules + anti-pattern classes),
`docs/CLAUDE.md`, the two ship reports and specs.

Verdict is at the bottom. Findings are severity-ranked; each cites `file:line`,
the failure scenario, and a suggested fix.

---

## Part 1 — Specific findings

### HIGH-1 — Custom lines (`item_id = NULL`) can't be edited or removed, and multi-custom ops hit the wrong row

**Where (client):**
- `client-v2/.../projects/project-estimate.component.ts`
  - `selectedItemId`/`selectedLine` L209-215 (`l.itemId === selectedItemId()`)
  - `onQtyChange` L232-243 (`ls.map(l => l.itemId === itemId ? …)`, then
    `setQuoteItemQuantity(projectId, itemId, …)`)
  - `removeLine` L247-258 (`ls.filter(x => x.itemId !== l.itemId)`, then
    `removeQuoteItem(projectId, l.itemId)`)
  - `toggleInstall` L291-303 (`x.itemId === l.itemId`)
  - row wiring L111-117 (`[selected]="selectedItemId() === l.itemId"`,
    `(qtyChange)="onQtyChange(l.itemId, …)"`)
- `client-v2/.../core/projects/project.service.ts` L61-74 — URL built from `itemId`
- `client-v2/.../core/projects/project.types.ts` L37 — `itemId: string` (typed
  non-null; runtime value is `null` for customs, so TS hides every collision)

**Where (server):**
- `server/src/services/projects.service.js`
  - `updateItem` L638-664 (`WHERE … item_id = $2`)
  - `removeItem` L669-683 (`WHERE … item_id = $2`)
  - `isItemSent` L621-630 (`WHERE … item_id = $2`)
- `server/src/routes/projects-v2.js` L27-29 — `:itemId` param validated as UUID

**What's wrong:** A custom line is a `project_items` row with `item_id = NULL`
(`addCustomItem`, projects.service L584-615; `toQuoteLine.itemId = row.item_id`
L344). Every edit/remove path keys on the *catalogue* `item_id`, not the
`project_items.id`. Two independent failures compound:

1. **Client-side wrong-row collision.** With `itemId = null`, every predicate
   `l.itemId === l.itemId` / `x.itemId !== l.itemId` treats **all** custom lines
   as one. `onQtyChange(null, …)` rewrites the qty of *every* custom line in the
   optimistic UI; `removeLine` filters *all* custom lines out at once;
   `selectedItemId` starts `null`, so on load **all** custom rows render
   `selected` (highlighted) and the preview rail shows the first custom line with
   no click.
2. **Server rejects / no-ops.** The optimistic update is followed by
   `PATCH|DELETE /:id/items/null`; `router.param('itemId')` runs
   `UUID.safeParse('null')` → **400 "Invalid item id"**. Even if it reached the
   service, `WHERE item_id = $2` with `$2 = null` matches zero rows (SQL
   `= NULL` is never true), so it would no-op. Net: the qty stepper and trash
   button are shown on a fresh custom line (`editable(l)` is true while
   `status='to_send'`), the user clicks, all sibling custom rows flicker, then
   the change reverts with an error toast.

`isItemSent(projectId, null)` also never returns true, so the CART-01
read-only-after-sent lock never engages for a custom line (moot only because the
row can't be edited at all).

**Failure scenario:** Add two custom lines ("Wine", "Flowers") to the Catering
category on the Final Quote. Edit Wine's quantity → both rows' qty jump in the
UI, the request 400s, both revert, error toast. Delete Flowers → both vanish,
400, both return. Custom lines are effectively immutable and un-removable, and
the UI corrupts siblings on every attempt.

**Suggested fix:** Key the line identity on `project_items.id` everywhere, not
`item_id`. Concretely: the client should send `l.id` (the row id) as the path
segment; the PATCH/DELETE service methods should scope
`WHERE id = $2 AND project_id = $1` (still org-safe via the project join);
`isItemSent` should take the row id. Catalogue lines already carry a unique
`id`, so this unifies both kinds and removes the `item_id`-as-key coupling. This
is the honest key now that `(project_id, item_id)` is neither unique nor
non-null.

---

### MEDIUM-2 — `DISTINCT ON` dedup tiebreak diverges: banner/card total vs the Final Quote line list

**Where:** `server/src/services/projects.service.js`
- `getEstimate` L465-473 — `ORDER BY pi.logical_line_id,
  (pi.status IN ('accepted','booked')) DESC NULLS LAST, pi.id`
- `LIST_SELECT` L75-82 — same, tiebreak `pi.id`
- `listItems` L437-447 — `ORDER BY sub.logical_line_id, (…accepted/booked…) DESC
  NULLS LAST, sub.created_at ASC`

**What's wrong:** All three collapse the fanned per-supplier rows to one per
`logical_line_id`, "accepted/booked wins else …". But the *else* tiebreak
differs: `getEstimate` and `LIST_SELECT` fall back to `pi.id` (an arbitrary
`gen_random_uuid()`), whereas `listItems` falls back to `created_at ASC` (the
canonical row, created first, deterministically wins). When a line was briefed
to ≥2 competing suppliers and one has negotiated a different `price_current` but
**nothing is accepted yet**, the two queries can select *different* rows, hence
different line totals.

**Failure scenario:** Catering line briefed to Supplier A and B (both seeded at
£1,000). A suggests £900 (`adjusted_by_supplier`, not yet accepted). On the Final
Quote screen, the line row (`listItems`) shows £1,000 (canonical) while the
banner total (`getEstimate` scope=all) and the project card ballpark
(`LIST_SELECT`) sum whichever of A/B has the lower `pi.id` — potentially £900.
Same screen, two numbers.

**Suggested fix:** Make the tiebreak identical across all three — use
`created_at ASC` (or an explicit "canonical = row where `id = logical_line_id`")
everywhere so the total and the line list always pick the same row. Decide
deliberately what an un-accepted competing line should contribute (canonical
brief price is the sensible default).

---

### MEDIUM-3 — Per-line money formula is triplicated across boundaries with no parity enforcement (Rule 7)

**Where:**
- `server/src/services/line-total.util.js` `lineTotalSql` (SQL)
- `client-v2/.../projects/quote-line.util.ts` `lineCost` L45-55
- `client-v2/.../inbox/inbox-project.component.ts` `lineTotalAt` L366-376

**What's wrong:** The UNIFY thesis is "one formula, four surfaces cannot drift" —
but that holds only for the *server* surfaces that share `lineTotalSql`. The
client re-implements the same math twice (cart/Final `lineCost`, inbox propose
`lineTotalAt`), each commented "mirrors the server exactly." Per ENGINEERING.md
Rule 7, a comment is not an enforcement mechanism; there is no test importing
both sides. They have *already* diverged in one respect: see MEDIUM-4 (the server
ignores `pi.install_unit`; the client reads the COALESCE'd `installUnit`). Today
the client is only used for optimistic display and is overwritten by a server
`est.reload()`, so users don't see the drift — but the invariant is unguarded.

**Suggested fix:** Extract one canonical spec + a parity test (Vitest on the
client, Node test on the server) that feeds identical line inputs through
`lineCost`, `lineTotalAt`, and a JS port of `lineTotalSql` and asserts equality —
the same pattern AUDIT-02 Fix 6 used for the permissions matrix.

---

### MEDIUM-4 — Shared formula uses catalogue `i.install_unit`, not the negotiable `pi.install_unit` override

**Where:** `server/src/services/line-total.util.js` L15-23. `ic` COALESCEs
`pi.install_cost` over `i.install_cost`, but the CASE branches key the *basis* off
`i.install_unit` (`WHEN i.install_unit = 'per_order' …`), never
`COALESCE(pi.install_unit, i.install_unit)`.

**What's wrong:** `project_items.install_unit` is a real, writable override
(`transitionItem` L90 writes it from `extra.installUnit`; `getByMessage` L177 and
`QUOTE_LINE_JOIN` L394 *display* `COALESCE(pi.install_unit, i.install_unit)`). The
money formula silently ignores it. Two consequences:
- **One-Definition violation:** in a single formula, `install_cost` is COALESCE'd
  but `install_unit` is not. The moment a supplier's negotiated basis differs
  from the catalogue basis, the stored/displayed basis and the *computed* basis
  disagree.
- **Custom lines:** `i` is NULL (no catalogue row), so `i.install_unit` is NULL →
  no CASE branch matches → the ELSE (`per_item`) always applies, regardless of the
  row's own `install_unit`.

Currently **latent**: `InboxItemAction` has no `installUnit` field and `reply`
(`inbox.service.js` L494) passes only `{ price, installCost }`, so `pi.install_unit`
is never written via negotiation; and the custom-line dialog folds install away
(`addCustom` L359-378 omits install fields). So no user path reaches it today —
but it is a live bug the first time an install basis becomes negotiable.

**Suggested fix:** Change the util to
`COALESCE(pi.install_unit, i.install_unit)` in all three CASE predicates
(matching how the same file already treats `install_cost`).

---

### MEDIUM-5 — `addItem` revive still relies on the dropped `(project_id, item_id)` unique index

**Where:** `server/src/services/projects.service.js` `addItem` L520-575 (esp. the
comment L528-530 "The unique index spans deleted rows …" and the
`SELECT … WHERE project_id=$1 AND item_id=$2 FOR UPDATE` L531-536). Index dropped
in `migrate-schemas.js` L2139 (`DROP INDEX … uq_project_items_project_item`).

**What's wrong:** The revive logic and its comment assume `(project_id, item_id)`
is unique. UNIFY-01a + CUSTOMS-01 dropped that index (needed for N supplier rows
and NULL `item_id`). Two residual risks:
1. **Concurrency duplicate.** With no unique constraint, two concurrent
   `addItem` calls for the same catalogue item that currently has no row both
   `SELECT … FOR UPDATE` (locking nothing, since no rows match), both `INSERT` →
   two duplicate cart lines. Previously the index rejected the second. Reachable
   via a double-click "Add to cart".
2. **Arbitrary row selection.** After a send fans an item to N rows (all sharing
   `item_id`), the revive `SELECT` returns N rows and reads `rows[0]` with no
   `ORDER BY` — arbitrary which row it treats as "the" line.

The comment is now stale (states an invariant that no longer exists).

**Suggested fix:** Either add a partial unique index for the still-meaningful
case (`UNIQUE (project_id, item_id) WHERE item_id IS NOT NULL AND status IS NULL
AND deleted_at IS NULL`) to keep cart adds idempotent, or make the revive explicit
about which row it targets (`ORDER BY created_at ASC LIMIT 1` and scope to
un-sent rows). Update the stale comment either way.

---

### LOW-6 — Fan-out clone omits `is_custom`

**Where:** `server/src/services/taxonomy.service.js` `requestQuotes` clone INSERT
L1246-1259. The `SELECT` column list copies `item_id` (NULL for customs) but not
`is_custom`, so a cloned custom row defaults `is_custom = false`.

**What's wrong:** When a custom line is briefed to ≥2 suppliers, the first
supplier claims the canonical row (`is_custom = true`); each additional supplier
gets a clone with `is_custom = false`. If a clone later wins (accepted/booked),
`listItems`' `DISTINCT ON` selects it and `toQuoteLine.isCustom` is `false` → the
"Custom" tag disappears on the Final Quote for that line. Cosmetic only (supplier
derivation still resolves via `supplier_org_id`).

**Suggested fix:** Add `is_custom` to the clone's SELECT/INSERT column list.

---

### LOW-7 — `requestQuotes` hand-rolled transaction loses audit attribution on the new UNIFY/CUSTOMS writes (Rule 1)

**Where:** `server/src/services/taxonomy.service.js` L1071-1358 —
`pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK`. The fan-out added *new* audited
writes inside it: the canonical claim UPDATE, the clone INSERT, `message_items`
tag rows, `message_item_events` (L1236-1271).

**What's wrong:** Per Rule 1, `withTransaction` exists precisely because
`pool.js`'s per-statement wrapper sets `app.current_user_id` (the audit GUC) on
each write; a hand-rolled dedicated client does not re-establish it, so
`created_by`/`updated_by` on the fanned rows/tags/events are unattributed. The
hand-rolled block is pre-existing (v1.50) and both ship reports flag it as
pre-existing — but the arc extended it with new audited rows rather than
migrating it, which is exactly the case Rule 1 targets. (The same hand-rolled
pattern lives in `applyClassification`/`setItemTags` — pre-existing, out of arc.)

**Suggested fix:** Migrate `requestQuotes` to `withTransaction`, or explicitly
`SET LOCAL app.current_user_id` after `BEGIN`. At minimum keep the ship-report
note current now that audited writes were added.

---

### LOW-8 — `getProjectSummary` sums totals across per-supplier threads (double-counts competing quotes)

**Where:** `server/src/services/inbox.service.js` `getProjectSummary` L343-369
(`allItems = threads.flatMap(t => t.items)`, then `originalTotal`/`revisedTotal`
reduce over all). Fed by `getAgentThreads` (L400) where each thread is one
supplier.

**What's wrong:** For a line briefed to N suppliers, the agent view has N threads
each carrying that line's per-supplier row, so the project-summary
`originalTotal`/`revisedTotal` count it N times. **Currently unrendered** — the
rail (`inbox-rail.component.ts` L23-35) shows only name/date/location/agency, not
these totals — so it's a latent contract bug, not a visible one. (Per-thread
`t.originalTotal`/`t.revisedTotal`, shown in the header, are correct: one supplier
each.)

**Suggested fix:** When/if the summary totals are surfaced for the agent view,
dedupe by `logical_line_id` (accepted/booked row wins, matching the Final Quote),
or document that the agent summary is intentionally "total quote value in play."

---

### LOW-9 — Inbox item actions swallow failures with no user feedback (Rule 5 borderline)

**Where:** `client-v2/.../inbox/inbox-project.component.ts` `itemAction` L418-430
and `send` L306-323 — `catch { /* … */ }` with no toast/log.

**What's wrong:** Accept / Suggest New Cost / thread reply that fail on the server
(5xx, validation) leave the UI silent — the button just does nothing. The catches
carry comments ("retry on next click; shared toast surface lands later"), so
they're an acknowledged deferral rather than a false-comment silent swallow, but a
negotiation surface handling money with zero failure feedback is a real
production-readiness gap.

**Suggested fix:** Land the shared inbox error toast; at minimum `console.warn`
unexpected (5xx/network) failures per Rule 5's expected-vs-unexpected split.

### LOW-10 — Re-send can't add a new supplier to an already-briefed line

**Where:** `server/src/services/taxonomy.service.js` L1157-1163 — `canonById` is
built only from rows `WHERE status IS NULL`; `sendOutreach` (`inbox.service.js`
L141-146) also scopes to `status IS NULL`.

**What's wrong:** Once a line is briefed (`status='brief_sent'`), a later send
that picks an additional supplier for that same line finds no canonical row
(status no longer NULL) → no clone is created and the supplier is silently
dropped for that line (no error). Likely intentional (you re-brief from the cart,
not from sent lines), but there's no signal to the agent that the extra supplier
was ignored.

**Suggested fix:** Confirm the intended "add a competing supplier post-send"
flow; if unsupported, surface it; if supported, allow cloning from an existing
sent row of the same `logical_line_id`.

---

## Part 2 — Standing checklist scan (ENGINEERING.md §3)

- **Duplicate source of truth:** MEDIUM-3 — line-total math triplicated
  (`lineTotalSql` / `lineCost` / `lineTotalAt`), no parity test.
- **Shared standard, hand-applied:** LOW-7 — `requestQuotes` hand-rolls a
  transaction instead of the shared `withTransaction` (audit GUC not applied to
  the new fan-out writes).
- **Overloaded token / key:** HIGH-1 — `itemId` overloaded as both "catalogue
  item id" and "line identity"; breaks for `item_id = NULL`. MEDIUM-4 —
  `install_unit` COALESCE applied for display but not in the formula.
- **Behavioral drift across structural reuse:** MEDIUM-2 — the three
  `DISTINCT ON` consumers use divergent tiebreaks, so the "same" dedup yields
  different rows.
- **Allow-list when default-on is correct:** none found.
- **Read/write key mismatch:** HIGH-1 (write `project_items.id`, read/patch/delete
  by `item_id`); LOW-6 (`is_custom` written on the canonical row, not propagated
  to clones, then read back).
- **Container-coupled logic:** none material to this arc.

## Money-parity spot check (the arc's headline goal)

Final Quote vs Inbox for a single-supplier negotiated/accepted line **holds**:
estimate binds `COALESCE(price_current, base_price)`, inbox binds
`price_ref`/`COALESCE(price_current, price_ref)`, and `price_ref = base_price` at
send, all through the one `lineTotalSql`. The drift risks are in the *fan-out /
competing-quote* dimension (MEDIUM-2) and the *install basis* dimension
(MEDIUM-4), not the base per-unit×qty parity the arc set out to fix.

## Migration review

The UNIFY/CUSTOMS block (`migrate-schemas.js` L2111-2208) is additive-first and
idempotent: `ADD COLUMN IF NOT EXISTS`, `DROP INDEX IF EXISTS`, and the
destructive slim-down/repoint gated on the old shape
(`IF EXISTS … column_name='status'`) so re-runs and a future deploy never
re-wipe live threads. `master` is additive-only so far (the guarded
slim-down/repoint completes on the next full run; master is empty, so its
`TRUNCATE` is a no-op) — matches the ship report's known state. One nit: the base
`project_items` table (L316-324) still declares `id … DEFAULT uuid_generate_v4()`
against the CLAUDE.md `gen_random_uuid()` convention — pre-existing, not this arc.

---

## Verdict — readiness to promote to shared preview

**Not yet — fix HIGH-1 first; it is a functional break on a headline feature of
the arc.** Custom lines are the entire point of CUSTOMS-01, and as shipped they
cannot be edited or removed and corrupt sibling rows on every attempt, because
line identity is keyed on the (now-nullable, non-unique) catalogue `item_id`
instead of the `project_items.id`. That one change (key on the row id end-to-end)
also closes the read/write-key-mismatch class cleanly. MEDIUM-2 and MEDIUM-4 are
genuine money-display correctness bugs that will surface the moment competing
quotes or negotiable install bases are exercised, and MEDIUM-3 removes the safety
net that would have caught them — I'd want at least MEDIUM-2 fixed and the
parity test (MEDIUM-3) added before a *shared* environment where others rely on
the numbers. The remaining LOWs are safe to schedule as follow-ups. The
migration itself is sound and re-runnable. Net: strong architecture, the merge
achieved its parity goal on the single-supplier path, but the per-supplier and
custom-line dimensions need the fixes above before preview.
