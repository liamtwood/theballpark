# pV2-FINAL-01 — Final Project Quote (new tab)

The supplier-facing review the agent checks before contacting suppliers.
Design: `Screenshot 2026-07-03 082256/082130/082440.png` (Liam, 2026-07-03).

## Slice 1 — the Final tab + page

**Shipped:** 2026-07-03, chip `[Dev v2] v2.36i`

### What landed
- New **Final** tab in project-detail (`app-project-final-quote`), between
  Project Quote and Inbox.
- **Summary card:** title/subtitle + Project Date · Location · Suppliers
  (`ProjectOutreachStore.supplierCount`) + **Estimated Ballpark Total**.
- **Line items:** category eyebrow, name, description; **Quantity** stepper
  (persists — real `project_items` field); a per-line **Install / Deliverable
  toggle** (shown when the catalogue item has an `install_cost`; Install adds
  it); per-line **Ballpark Cost**.
- **Add Custom Line Item** — dashed row → modal (Category / Description /
  Estimated Cost / Quantity / Type / Notes) matching the mockup.
- **Costs are RAW** (what suppliers quote) — the client-facing margin/VAT
  cascade stays on the Estimate tab. `installCost` + `installDescription`
  added to the `QuoteLine` (server join to `items`).

### Files touched
| File | Notes |
|---|---|
| server/src/services/projects.service.js | `QuoteLine` gains `installCost`/`installDescription`/`description` (join items) |
| client-v2/.../core/projects/project.types.ts | `QuoteLine` type |
| client-v2/.../pages/projects/project-final-quote.component.ts | NEW — the Final Quote page + Add-custom modal |
| client-v2/.../pages/projects/project-detail.component.ts | Final tab |
| client-v2/src/environments/environment.ts | chip → v2.36i |

### Concerns not in spec
#### Toggle + custom lines are in-session (not persisted)
**What:** the Install/Deliverable choice and Add-Custom lines live in client
state — they don't survive a reload. Persisting needs a `project_items`
column (install flag) + custom-line support (item_id-nullable). Needs a
migration → **Liam's ok** before building. **Severity:** MEDIUM (flagged as
the deliberate slice boundary).
#### Total is raw (no cascade) — confirm intent
**What:** the Final total sums raw line costs (base + install), no
margin/VAT. Reads as supplier-facing per the mockup (line = total). If it
should mirror the Estimate's client total, say so. **Severity:** LOW

## QC notes
(Liam)

## Chat audit
(chat)
