# pV2-ADD-LINE-SUPPLIER-01 — add a line for a supplier to cost

**Shipped:** 2026-11-08, chip `[Dev v2] v2.1143` (pre-commit bump)
**Branch:** `rebuild/org-slice`
**Design:** locked with Liam in-session 2026-11-08; rationale in `docs/DATA-MODEL-REDESIGN.md` decision log
(2026-11-08 entry). Builds on `pV2-ADD-LINE-SINGLE-POLISH-01` (the dialog label tidy-up).

## What landed
- **Supplier banner "+" (draft estimate) → the line goes to THAT supplier to cost.** The banner passes the
  supplier; the Add Line Item dialog shows "For <Supplier> to cost", hides Cost (Single + Grid), and shows a
  coachmark (`add-line-item` / `supplier-intro`, registers on first view, admin-editable).
- **New column `project_items.requested_provider_org_id` (0033)** — intent only: who should cost this custom
  line. NOT engagement (no `project_providers` row until send) and NOT ownership (`org_id` = agency owns the
  line). Estimate supplier = `COALESCE(items.org_id, requested_provider_org_id)`.
- **`addCustomItem`** validates the supplier (listed active supplier in `supplier_directory`, not the caller's
  org), requires a category, drops any cost (the supplier prices it), stores the FK.
- **`sendOutreach` sends each supplier ONLY its own lines.** Fixes a pre-existing bug: it briefed the whole
  category bucket to every picked supplier (messaging B also sent A's catalogue + custom lines). Supplier-less
  lines (FK NULL) are never swept into a send.
- **Unchanged (locked):** top "Add line" / "Your own costs" — agent-owned lines, find a supplier later. The line
  editor is unchanged: a cost typed there reaches the supplier as a "match this" starting price.

## Files touched
| File | Δ | Notes |
|---|---|---|
| `server/db/rebuild/0033_line_requested_provider.sql` | new | nullable FK → orgs + partial index; idempotent |
| `server/src/services/project-line.service.js` | +32 / -6 | addCustomItem routing + validation; QuoteLine supplier COALESCE; local `httpErr` |
| `server/src/services/inbox.service.js` | +7 | sendOutreach per-supplier line selection |
| `client-v2/src/app/pages/projects/custom-line-dialog.component.ts` | +44 / -13 | `forSupplier` input, Cost hidden, supplier line, coachmark |
| `client-v2/src/app/pages/projects/project-estimate.component.ts` | +8 / -2 | banner "+" passes supplier; `pendingForSupplier` (ONLY these hunks staged — the file also holds another session's uncommitted edits) |
| `docs/DATA-MODEL-REDESIGN.md` | +21 | `project_items` spec + dated decision-log entry |

## Acceptance — 10 / 10 verified (dev2, service code as `web_app_user` under RLS, request-pinned client)
- Add for The Food Crowd in Catering → `supplierId`/`supplierName` = The Food Crowd ✓
- Cost sent as 99 → stored NULL ✓
- `listItems` groups it under The Food Crowd in Catering ✓
- No `project_providers` row created at add (0 → 0) ✓
- Own org as supplier → 400 ✓ · unknown supplier → 400 ✓ · no category → 400 ✓
- The Food Crowd cannot read the draft project pre-send (RLS, 0 rows) ✓
- Send to Rocket Food selects only its 2 lines (old query: all 7 in the bucket) ✓
- Send to The Food Crowd selects only its custom line(s) ✓ (the run counted 2 = both test rows; confirmed by SQL)
- `sendOutreach` itself NOT invoked (it flips the project Draft → Active; real demo data) — its new selection
  predicate was run read-only instead. Test rows hard-deleted after; project back to 12 lines, 0 providers.
- `ng build --configuration development` clean; :3002 API health OK after each server edit.
- **Not verified:** the dialog visually (Liam QC on :4202), and a real end-to-end send + supplier inbox view.

## Migrations
- **dev2:** 0033 applied via Supabase MCP (dev2 has no `schema_migrations` ledger — MCP-migrated).
- **preview / prod:** NOT applied. `run.js` picks 0033 up on the next promote. ⚠ The server code reads the new
  column, so the code must not reach preview before 0033 does (run `run.js --env-file=.env.preview` first).

## API audit checklist
#### `POST /api/projects/:id/items/custom` (behaviour change, route unchanged)
- ✓ Method: POST create, 201 · ✓ Input: zod `CustomItemSchema` (`supplierOrgId` uuid, already present — was
  ignored) · ✓ AuthZ: `org_id` from JWT; project ownership re-checked; supplier validated server-side against
  `supplier_directory` + not own org · ✓ Status: 400 bad supplier / missing category, 404 not your project ·
  ✓ Shape: unchanged QuoteLine (supplierId now populated for routed custom lines) · ✓ Disclosure: errors are
  generic ("Unknown supplier") — no existence oracle beyond the public directory · N/A Idempotency ·
  ✓ Perf: one extra indexed lookup.
#### `POST` outreach send (`sendOutreach`, route unchanged)
- ✓ Narrower selection only (adds a `LEFT JOIN items` + predicate); same txn, same writes.

## Concerns not in spec

### A supplier's archived / unapproved item drops out of the send
**Where:** `inbox.service.js` sendOutreach selection; `project-line.service.js` quoteLineJoin
**What:** the line's supplier comes from `items.org_id` through `items_read` RLS (active + approved, or own org).
If a supplier archives/unapproves an item after the agency added it, `i` reads NULL → the line looks
supplier-less → it is no longer sent. The estimate already showed such lines without a supplier (same join), so
UI and send agree, but the line silently stops going out.
**Suggested fix:** freeze the supplier onto the line at add (copy `items.org_id` into `requested_provider_org_id`
for catalogue adds too) — needs Liam's call (it changes the column's meaning from "custom-only").
**Severity:** MEDIUM

### Multi-supplier acceptance merges threads
**Where:** `project-line.service.js` `attachAcceptance`
**What:** pre-existing — derives accepted state from ALL suppliers' threads for a line. Now harmless (one
supplier per line), but it must become per-supplier before any multi-supplier compare (deferred, WS2-adjacent).
**Severity:** LOW (latent)

### Changing a line's supplier before send — no path yet
**Where:** n/a
**What:** agreed rule is "editable until briefed, frozen after", but there is no UI (the "Costed by" picker is
deferred), so no server update path was added. Today: delete + re-add from the right banner.
**Severity:** LOW

### Grid mode in supplier context
**Where:** `custom-line-dialog.component.ts`
**What:** Grid also hides Cost and routes every row to the supplier; not exercised end-to-end (same server path).
**Severity:** LOW

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in)
