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

## QC notes
(Liam)

## Chat audit
(chat)
