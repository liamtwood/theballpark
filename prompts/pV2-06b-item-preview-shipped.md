# pV2-06b — Right-rail item preview

**Shipped:** 2026-06-12, chip `[Dev v2] v2.14e`
**Commits:** `d10ec58` feat(v2.14e): right-rail item preview
**Spec:** `docs/MARKETPLACE.md` (arc row pV2-06b) + `prompts/pV2-06-angular-architecture.md`

## What landed
- `rail/item-preview.component.ts` (new, ~110 lines): the rail's ITEM
  mode — cover image (soft placeholder when absent), name, price + unit
  on the `.bp-card-title` rank, Supplier + Category rows on
  `.bp-field-label`/`.bp-field-value` (the table class gets its first
  read-only consumer — exactly the context chat's audit predicted), full
  description, and a close (X) that deselects (clears `?item=`).
- `right-rail.component.ts`: ITEM case mounts the real preview; category
  name resolved from the store's already-loaded rail list. The 06a
  placeholder copy is gone for this mode.
- "Add to Quote" CTA deliberately absent until 06f (Quote arc);
  ownership edit/delete affordances wait for the /store arc.

## Files touched
| File | Lines (Δ) | SHA | Notes |
|---|---|---|---|
| client-v2 .../rail/item-preview.component.ts | +110 (new) | d10ec58 | the preview |
| client-v2 .../rail/right-rail.component.ts | +17 / −10 | d10ec58 | mount + category lookup |
| client-v2 environments/environment.ts | ±1 | d10ec58 | chip v2.14e |

## Acceptance — 5 / 5 verified live on 4201
- Card click → preview renders name / image / £ price / supplier /
  category / description — ✓ ("100 Premium Printed Invitations", Press
  Lane Studio, Graphics & Signage)
- **Selection fetches NOTHING** — ✓ zero `/api/marketplace/items`
  requests on select (the architecture's roundtrip-budget rule, measured)
- Close (X) deselects: preview unmounts + `?item=` cleared — ✓
- Placeholder block renders for imageless items — ✓ (component branch)
- Build + lint + style guard green; 64/64 + 39/39 — ✓

## Concerns not in spec
### Long descriptions unclamped
**Where:** item-preview description block
**What:** `whitespace-pre-line` renders the full description — a very
long one makes the rail tall (page scrolls). Fine for current data;
clamp + "read more" if QC objects.
**Severity:** LOW

## QC notes
**2026-06-12 (Liam):** "qc complete looks good" — ACCEPTED.

## Chat audit
(chat fills this in — leave the section header so chat finds it)
