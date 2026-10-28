# pV2-ITEM-BULK-ACTIONS-01 — Bulk item management — SHIP REPORT

**Shipped:** 2026-10-28 · **Branch:** `rebuild/org-slice` (dev2) · **Held from preview** (batched release).
**Session:** "Bulk item actions + Image filter" (local_542327ee). **Spec:** `pV2-ITEM-BULK-ACTIONS-01-prompt.md`.

Design was frozen before implementation: designer review + Liam's Option-D sign-off for cross-org
Refresh Images. Build followed the FINAL rulings (see "Spec-precedence deviations" below).

---

## What shipped

### Part 1 — "Image?" filter
Tri-state **Image: Any / With image / Without image** in the marketplace filter row (owner/admin
management contexts only — same gate as the status/visibility filters). Filters by `items.images`
jsonb array length.
- Server: `schemas/marketplace-query.schema.js` (`image: 'with'|'without'`), `routes/marketplace.js`
  items GET — `jsonb_typeof(i.images)='array'` guarded `jsonb_array_length` (null/non-array = "without").
- Client: `marketplace-store.ts` (`imageFilter` computed + `setImageFilter` writer + filter-key +
  query param), `marketplace-filters.component.ts` (the select), `catalogue.service.ts` + `catalogue.types.ts`.

### Part 2 — Multi-select (extracted ONCE, reused)
- **`shared/catalogue/item-selection.store.ts`** — `ItemSelectionStore` (signal Set, toggle/clear/
  retainOnly/allSelected). Provided per marketplace context (alongside `MarketplaceStore`) so the
  global marketplace, a supplier's My Shop and the Approvals queue each get isolated selection.
- **`shared/catalogue/bulk-action-bar.component.ts`** — the sticky `N selected · <actions> · Clear`
  bar; self-contained (persona → action set, confirm destructive, run, clear, emit `done`).
- `catalogue-grid.component.ts` — a checkbox per row (list + table) and an overlay checkbox per card,
  behind a `selectable` input + `selectedForBulk`/`bulkToggle` (grid stays dumb).
- Wired into BOTH hosts: `marketplace-page.component.ts` AND the supplier `My Shop` tab in
  `supplier-detail.component.ts` (`selectable = store.showStatusFilters()`). A prune effect keeps the
  selection ⊆ the loaded rows (filter change drops stale picks; "show more" keeps them).

### Part 3 — Bulk actions (per-persona, server-gated)
- **Owner** `POST /api/store/items/bulk`: `activate` / `deactivate` (writes `status`, activate requires
  `approval_status='approved'` — others skipped, mirrors single-item), `reclassify` (`category_id`),
  `submit` (`approval_status → 'pending'`, only from draft/rejected), `delete` (soft + cascade children).
- **Admin** `POST /api/admin/items/bulk`: `approve` / `reject` / `delete` via `withModeration`
  (scoped `app.svc_moderate`, 0017 column-guarded). Bar = Approve / Reject / Delete / Refresh.
- Both: `refresh-images` → a background job (returns `jobId`; poll `…/bulk/refresh/:jobId`).
- Services: `services/item-bulk.service.js` (instant actions), `schemas/bulk-items.schema.js`
  (Zod — the action enum IS the per-persona value gate; `categoryId` required for reclassify).

### Refresh Images (the imageless backfill) — zero AI, images-only
- Extracted the deterministic image selection out of `catalogue-extract.service.js` `processUrl` into
  **`selectProductImages(html, finalUrl, aiImages?)`** (collectImageUrls + the `looksProduct` filter +
  handle-hoist) — reused by BOTH the pull and refresh (extract-before-duplicate).
- `reselectItemImages` (fetch `external_url` via `guardedFetch` → `selectProductImages`, no AI) +
  `startRefreshImages` / `runRefreshJob` on the shared `catalogue_extract_job` runner (`kind='refresh'`,
  pollable, progress). **Only `images` is written, and only when selection finds photos** — every other
  field/manual edit is preserved; an item that finds nothing is skipped (never clobbered).
- Owner refresh = own-org writes. Admin refresh = **Option D**: `is_admin` for the cross-org READ of
  pending items (`items_select`), the narrow **`app.svc_refresh`** GUC for the images-only WRITE.

### DB — `0024_items_refresh_images.sql` (Option D)
- New `app_svc_refresh()` GUC helper (mirrors `app_svc_moderate`).
- `items_update` policy gains an `app_svc_refresh()` branch (USING + permissive WITH CHECK).
- The 0017 `items_svc_moderate_guard` trigger gains a svc_refresh branch: a cross-org svc_refresh write
  may change **`images` only** (+ audit stamps) → `check_violation` otherwise. Moderation stays
  `approval_status`/`deleted_at` under svc_moderate. Least privilege — a refresh bug can only touch images.

## Security (designer MUSTs — all verified)
1. **No `is_active` column** — make-active/inactive write `status` (active/retired). ✓
2. **Make-active requires approved** — not-yet-approved ids skipped (counted), not a batch 400. ✓
3. **Admin approve/reject/delete via `withModeration`** on the request's pinned client — NOT
   `withTransaction` (its fresh client wouldn't carry the svc_moderate GUC) and NOT the owner pool. ✓
4. **Owner value-gate** — the owner Zod enum has no approve/reject; `submit` only reaches `pending`. ✓
Plus: `org_id` always from `req.user`, never the body (owner scopes every WHERE to it).

## Verification
- `ng build` clean (exit 0). Backend health-checks green on :3002 after the server edits.
- Both bulk routes mounted (401 unauth, not 404). Modules load (health green ⇒ no boot break).
- Liam QCs visuals himself (no screenshot verification).

## Spec-precedence deviations
- The spec's Part-3 table shows **admin ✓ for Make-active + Reclassify**. The FINAL designer ruling
  (relayed + Liam-approved) made those **owner-only** — FR-00215 reserves content-authoring
  (`status`/`category_id`) to the owner org; the admin cross-org bar is Approve/Reject/Delete/Refresh.
  Build follows the final ruling. (The spec body's Refresh section already says images-only.)
- Spec says "multi-row writes via `withTransaction`": used for the owner delete (own-org, atomic); the
  admin moderation writes deliberately use the pinned client under `withModeration` instead (see MUST #3).

## Follow-ups / open
- Onboarding does not grant a ballpark admin a `user_orgs` seat in orgs they load (concierge-extracted),
  so admin refresh is genuinely cross-org → the svc_refresh escape is required (noted, not a bug here).
  Whether onboarding SHOULD seat the admin is a separate FR-00215 call.
- Refresh runs items sequentially on the job runner (polite + single-client-safe); no cancel button for
  refresh yet (the job supports cancel server-side via the shared route if wanted later).

## Iteration — bulk-bar icons (QC, 2026-10-28)
**Triggered by QC (Liam):** the bulk action bar should match the item-card action icons — icon-only, label on hover, no visible text.
**Change:** `bulk-action-bar.component.ts` — action + Clear buttons are now icon-only, with the label as a `title` + `aria-label` hover tooltip (mirrors the `bp-itemprev-close` hover-icon pattern on the item cards); Approve icon `check` → `circle-check` (the card's review/approve glyph); square icon-button padding.
**Files:** `client-v2/src/app/shared/catalogue/bulk-action-bar.component.ts`
