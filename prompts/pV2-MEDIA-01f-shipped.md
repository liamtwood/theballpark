# pV2-MEDIA-01f — `<app-completeness-card>` + profile consumer

**Shipped:** 2026-06-22, chip `[Dev v2] v2.32n`
**Commit:** `<pending>`

The last MEDIA-01 slice: a per-entity, client-computed "% complete" card with
suggested actions that deep-link into the editors. Mounted on the org profile
as the first consumer. **Closes MEDIA-01** (item surfaces stay deferred to `/store`).

## What landed
- **`<app-completeness-card>`** ([shared/completeness](../client-v2/src/app/shared/completeness/completeness-card.component.ts)) —
  generic over the entity type; takes `[entity]` + `[config]` (a weighted
  `CompletenessConfig<T>`), renders a gradient progress bar + the unmet items as
  suggested-action buttons, and emits each item's `action` token on click. 100%
  → "All set" state. No schema — pure client-side computation (MEDIA.md §7).
- **`CompletenessConfig<T>`** ([completeness.types.ts](../client-v2/src/app/shared/completeness/completeness.types.ts)) —
  `{ weight, label, action, done(entity) }[]`; uses a `done` predicate (handles
  thresholds like "≥3 gallery photos" and composite checks like city+country)
  rather than the spec's `field`+`threshold` pair.
- **Profile consumer** — config (cover 25 / logo 15 / gallery≥3 20 / location 10
  / address 10 / email 10 / phone 10 = 100). Mounted at the top of the settings
  body, **editors only** (`canEdit`). `actionClicked` maps to: `cover`/`logo` →
  open the picker drawers; `gallery` → smooth-scroll to the media section;
  `company` → enter Company Information edit mode + scroll to it.

## Files touched
| File | Notes |
|---|---|
| `client-v2/src/app/shared/completeness/completeness.types.ts` | NEW — `CompletenessItem`/`CompletenessConfig` |
| `client-v2/src/app/shared/completeness/completeness-card.component.ts` | NEW — generic card (bar + suggested actions) |
| `client-v2/src/app/pages/settings/profile/profile.component.ts` | config + mount (canEdit) + `handleCompletenessAction` deep-links + `viewChild` scroll refs |
| `client-v2/src/environments/environment.ts` | chip → v2.32n |
| `docs/MEDIA.md` | 01f row; closes MEDIA-01 |

## Acceptance — verified (dev-login, real profile)
- Card renders at the top of the profile (editors only) — ✓
- Weighted % + bar compute from the entity — ✓ (0% on an empty org; bar width 0%)
- Unmet items listed as suggested actions — ✓ (all 7 shown)
- Deep-links — ✓ `cover` opens the cover drawer; `company` enters Company Information edit (Save + 6 inputs)
- Build green — ✓

## Concerns not in spec
### `done` predicate instead of spec's `field` + `threshold`
**Where:** `completeness.types.ts`.
**What:** The MEDIA.md example config keys items by `field` (+ optional `threshold`). I used a `done(entity)` predicate — strictly more general (composite checks like city+country, and the ≥3 gallery threshold) and keeps the entity strongly typed. Same compute (`Σ done·weight / Σ weight`).
**Severity:** LOW (deliberate generalisation; flagging the deviation).

### No `description`/bio in the profile config
**Where:** profile config.
**What:** `OrgProfile` has no description field and the profile form has no editor for one, so completeness can't include it — yet the supplier shopfront prominently renders `description`. A supplier currently has nowhere in v2 to write their bio.
**Suggested fix:** add a description field + editor to the profile (small follow-up); then add it to the completeness config. Deferred — out of 01f scope.
**Severity:** LOW.

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in)
