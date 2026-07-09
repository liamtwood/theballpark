# pV2-CUSTOMS-01 — custom line items in the pure-clone shape

**Shipped:** 2026-07-09, chip `[Dev v2] v2.53`
**Prompt:** `docs/pV2-CUSTOMS-01-PROMPT.md` · lands on top of UNIFY-01a (v2.52)

## Why

"Add Your Own Line Item" was browser-session-only — the custom line never
persisted, never rode the send, vanished on reload (Liam's "wine" QC bug). Now
a custom line is a **pure `project_items` row with `item_id = NULL`** — no
ghost `items` row, no placeholder ownership. All its data lives on the row, and
it rides along in its category's brief like any line.

## What landed

- **Schema (additive):** `project_items.item_id` made nullable + `is_custom`
  BOOLEAN. `category_id` already existed. Applied to public + preview.
- **`addCustomItem` service + `POST /:id/items/custom`** — creates the row
  (`item_id NULL`, `is_custom`, `source='custom'`, `logical_line_id=id`, cost
  optional → NULL = TBC, £0 until quoted). org from JWT; `supplier_org_id` NULL
  until send.
- **Send is line-centric now** (not per-`item_id`): `sendOutreach` groups the
  cart's to-send rows by their own `category_id` and passes `project_item_id`
  per requirement; `requestQuotes` claims/clones **by project_item_id**, so
  custom lines (NULL `item_id`) fan out to the category's suppliers alongside
  catalogue lines. One path, both kinds. `quote_requests` (v1 catalogue
  tracking) is skipped for custom lines.
- **Supplier derivation** already null-safe from UNIFY-01a
  (`COALESCE(supplier_org_id, items.org_id)`) → a custom line resolves to no
  supplier; the row carries `is_custom` so the UI renders a **"Custom"** tag.
- **Client:** the Add-Your-Own-Line dialog saves through the endpoint (was a
  session signal) then reloads; the persisted line renders through the normal
  quote-line row with a "Custom" tag. The session-only custom model + its
  separate render block + `customTotal` were removed (no transitional dup).

## Files touched

| File | What |
|---|---|
| `server/src/db/migrate-schemas.js` | item_id nullable + is_custom (in the UNIFY-01a block) |
| `server/src/services/projects.service.js` | `addCustomItem`; `is_custom` in quote-line join + `toQuoteLine` |
| `server/src/services/inbox.service.js` | `sendOutreach` fans out per line/category (incl. custom) |
| `server/src/services/taxonomy.service.js` | `requestQuotes` keys canon by project_item_id; skips qr for custom |
| `server/src/routes/projects-v2.js` | `POST /:id/items/custom` + Zod |
| `client-v2/.../core/projects/project.service.ts` + `project.types.ts` | `addCustomItem` + `isCustom` |
| `client-v2/.../projects/project-estimate.component.ts` | dialog → endpoint; session model removed |
| `client-v2/.../projects/estimate-item-row.component.ts` | "Custom" tag |

## Acceptance — verified end-to-end

- Add custom "Wine" (£50 ×20) to Catering → **persists** as `project_items`
  (`isCustom`, `item_id NULL`, no supplier). ✓
- Appears in the **Final Quote** as "Custom." ✓
- On send, **rides along in the brief to both catering suppliers** (not the
  venue supplier). ✓
- Client + server build/parse clean.

## API audit checklist — `POST /:id/items/custom`
- ✓ Method semantics (create → 201) · ✓ Input validation (Zod `CustomAddSchema`,
  `.strip()`) · ✓ Authorization (org from JWT; `addCustomItem` verifies project
  ownership) · ✓ Status codes (201 / 400 / 404) · ✓ Response shape (QuoteLine)
  · ✓ Info disclosure (project-scoped) · N/A idempotency (each add is a new
  line) · ✓ Performance (single txn, 2 writes via `withTransaction`).

## Concerns not in spec

### Custom-only category can't be sent
**Where:** the Message Suppliers dialog derives suppliers from lines with a
supplier. **What:** a category containing *only* custom lines has no supplier
to pick, so it can't be briefed. In practice "Add" is always inside an existing
category that already has catalogue lines (→ suppliers), so it doesn't arise.
**Severity:** LOW (matches the prompt's assumption).

### The dialog's Install/Deliverable type isn't persisted
**Where:** `custom-line-dialog` emits `install: boolean`; `addCustom` doesn't
map it. **What:** custom lines have no separate install cost, so the type is
cosmetic; folded away. **Severity:** LOW.

### Fork-on-quote (catalogue promotion) — none, by design
Custom stays `item_id = NULL` even after acceptance; promoting a quoted custom
line into a supplier's catalogue is a future explicit `promote-to-catalogue`
action (out of scope, per the prompt).

## Iteration — v2.54 (2026-07-09)
**Triggered by QC (Liam):** a custom line's brief showed as **"General"** in the
inbox (untagged) instead of tagged to the item.

**Root cause:** the inbox item-tag/filter keys on the catalogue `item_id`, which
is NULL for a custom line — so `fetchTags` dropped it (`WHERE item_id IS NOT
NULL`) and the message fell through as an untagged broadcast.

**Fix:** key the tag on `COALESCE(item_id, project_items.id)` so custom lines
get a stable, non-null filter key. `toThreadItem.itemId` mirrors it
(`item_id ?? id`), and the reply `taggedItemId` lookup matches either
`item_id` or `id`. Catalogue lines unchanged.

**Verified:** custom "Wine" briefed to a supplier → its brief bubble is tagged
to Wine (not General); selecting Wine filters to its messages. Server-only.

**Files:** `inbox.service.js` (`fetchTags`, `toThreadItem`, reply lookup), chip
v2.54.

## Iteration — v2.55 (2026-07-09) — architect audit triage

Full report: `docs/audits/2026-07-09-unify-arc-architect-audit.md` (independent
read-only pass over the UNIFY-01 / 01a / CUSTOMS-01 arc). Triage:

**Fixed (blockers / correctness):**
- **H-1 (HIGH) — custom lines couldn't be edited/removed; multi-custom ops hit
  the wrong row.** Line identity keyed on catalogue `item_id` (NULL for custom).
  Rekeyed the whole select/qty/install/remove path to the `project_items` ROW
  id — server (`isItemSent`/`updateItem`/`removeItem` → `WHERE id`) + client
  (`selectLine`/`onQtyChange`/`toggleInstall`/`removeLine` + template). Verified:
  two custom lines, editing/removing one leaves the other untouched.
- **M-2 — `DISTINCT ON` tiebreak diverged** (getEstimate/LIST_SELECT on `id`,
  listItems on `created_at`) → banner vs line-list could pick different
  competing clones. Aligned all three: accepted/booked → `created_at` → `id`.
- **M-4 — shared formula ignored negotiable `install_unit`.** Now
  `COALESCE(pi.install_unit, i.install_unit)` in `line-total.util.js`.
- **M-5 — `addItem` revive relied on the dropped unique index.** Added a
  PARTIAL unique index `uq_project_items_canonical` (live canonical catalogue
  rows only — doesn't block fan-out clones or custom lines) + scoped the revive
  lookup to the canonical row (`supplier_org_id IS NULL`).
- **L-6 — fan-out clone dropped `is_custom`** → accepted custom clone lost its
  tag. Clone now copies `is_custom`.
- **Preview schema drift (found while adding M-5's index):**
  `preview.project_items` was missing all 5 audit columns
  (`created_by`/`updated_*`/`deleted_*`) — writes would have errored on the
  audit trigger. Added them + ensured them in `migrate-schemas.js` for all
  schemas. **A full `migrate-schemas` run on preview is still recommended
  before promotion to catch any other drift.**

**Deferred (accepted, follow-up — not promotion blockers):**
- **M-3** money formula in 3 places (`lineTotalSql`/`lineCost`/`lineTotalAt`),
  no parity test (Rule 7). Verified numerically equal; consolidate + add a
  parity test in a follow-up.
- **L-8** `getProjectSummary` sums across per-supplier threads (double-counts
  competing) — currently unrendered by the rail.
- **L-9** inbox action failures swallowed (minor UX; retry-on-click today).
- **L-10** re-send can't add a new supplier to an already-briefed line (known;
  needs an explicit "add supplier" flow — backlog).

**Rejected:**
- **L-7** hand-rolled BEGIN/COMMIT in `requestQuotes` (Rule 1 attribution gap)
  — pre-existing v1 pattern, out of this arc's scope; the gap predates UNIFY.

## QC notes
(Liam)

## Chat audit
(chat)
