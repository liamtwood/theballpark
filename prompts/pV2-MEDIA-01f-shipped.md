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

## Iteration — v2.32o (2026-06-22) — end-of-module architect audit + triage
**Report:** [docs/audits/2026-06-22-media-arc-angular-architect-audit.md](../docs/audits/2026-06-22-media-arc-angular-architect-audit.md)
**Verdict:** ship-with-fixes, no blockers. Locks all held (jsonb cast, org_id from JWT, financials never projected, lazy Lucide, primary-is-cover-column); full v2-standards compliance.

Triage of all 10 findings (honest accept/reject):

| ID | Sev | Verdict | Action |
|---|---|---|---|
| F-1 | HIGH | **Fixed** | Unsplash attribution wasn't surfaced on the public portfolio (MEDIA.md §4 / RP-11 compliance). New shared `<app-unsplash-credit>` ([shared/media](../client-v2/src/app/shared/media/unsplash-credit.component.ts)) mounted on the portfolio cards — renders "Photo by … on Unsplash" linked (`target=_blank rel=noopener`) only when `attribution` is present. Verified. **Deferred:** the owner-facing gallery *edit* thumbnails (lower risk + "Cover" badge collision needs design). |
| F-2 | MED | **Fixed** | `media.js` upload now allow-lists `image/png\|jpeg\|webp` (was `image/*`) — closes the Content-Type spoof + the extensionless-object case. *(Deferred: magic-byte sniff + a 413 handler for multer's size limit — hardening beyond a concrete vuln, since the path is org-scoped by JWT.)* |
| F-3 | MED | **Accepted → deferred** | `PATCH /api/projects/:id/images` ([projects.js:142](../server/src/routes/projects.js)) is a real ungated v1-legacy write (no org guard/Zod, reads non-MEDIA keys). But it's pre-existing **v1** on the deliberately-ungated `/api/projects` path — the systemic fix is the v1 retirement / cutover, not a MEDIA edit. **Flagged for Liam / the cutover.** |
| F-4 | MED | **Rejected (rationale)** | OrgProfile (`coverImageUrl`) vs SupplierDetail (`coverUrl`) feed org-media via individually-**typed** inputs, so a wrong field is a compile error at each call site and a new required input breaks all call sites — the enforcement the finding asks for already exists via TS. Deliberate decoupling for two differently-named DTOs; 2 consumers. Revisit if a 3rd consumer or shared interface is warranted. |
| F-5 | LOW | **Deferred** | URL-exact gallery dedupe is the intended "no duplicate URLs" rule; the silent no-op → toast is a minor UX polish. |
| F-6 | LOW | **Rejected** | Icon-search idiom works; no bug. |
| F-7 | LOW | **Fixed** | Upload catch now `console.warn`s the real error before the friendly message (Rule 5). |
| F-8 | LOW | **Accepted-as-known** | 20 is the server hard ceiling; per-consumer `maxSlots` is a UI affordance. No change. |
| F-9 | LOW | **Fixed** | `aria-valuetext="N% complete"` on the completeness progressbar. Focal-point keyboard path deferred (centre fallback; covered by MEDIA.md deferred a11y item). |
| F-10 | LOW | **Noted** | Profile/supplier sharing the suppliers bucket is deliberate (org assets together); env rename is infra risk — comment only. |

**Files (fixes):** `shared/media/unsplash-credit.component.ts` (new), `shared/org-media/org-media.component.ts` (mount), `server/src/routes/media.js` (mime allow-list), `shared/image-picker/image-picker.component.ts` (catch log), `shared/completeness/completeness-card.component.ts` (aria).

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in)
