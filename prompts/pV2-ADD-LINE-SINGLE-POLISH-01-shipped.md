# pV2-ADD-LINE-SINGLE-POLISH-01 — shipped (2026-11-08)

**Surface:** Project estimate ▸ Add Line Item dialog ▸ **Single** mode
(`client-v2/src/app/pages/projects/custom-line-dialog.component.ts`).

## Changes
- Indented the field labels (Item, Cost £, Qty, Notes) by `pl-3` (12px) so they line up with
  the text inside `.bp-input-field` (12px horizontal padding). Qty is included so the
  Cost/Qty row stays consistent.
- Removed the yellow **New** pill next to the Item label.

## What "Notes" is (answered, no change)
- The free-text field is bound to `form.notes` → emitted as `CustomLine.notes` →
  `project-estimate.component.ts` sends it as `description` to `ProjectService.addCustomItem`
  → `POST /api/projects/:id/custom-items` → `project-line.service.addCustomItem` writes it to
  **`project_items.description`** on the new agent-owned custom line.
- **Supplier-facing:** `quote-request.service.js` reads `COALESCE(pi.description, i.description)`
  into the brief sent to the supplier, so Notes is NOT agency-private (unlike budget).
- Grid mode has no Notes column; grid lines save `description = null`.

## Verified
`ng build --configuration development` clean. Visual QC: Liam.
