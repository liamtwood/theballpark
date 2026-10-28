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
- **Reclassify to a TOP-LEVEL category fails** (Liam QC 2026-10-28) — reclass to a *subcategory* works, but picking only a top-level category (no sub) doesn't apply the move. Deferred by Liam; **fix before release**. Items can legitimately home at any depth (0015). Build-session lead: the owner reclassify SQL is `UPDATE items SET category_id=$3 … AND org_id=$2` with NO leaf constraint (so a top-level id should apply server-side), and `isValidCategory` only checks existence — so suspect either **(a)** an items trigger/constraint requiring a leaf/descendant `category_id` (check `0010`/`0015`), or **(b)** the dialog emitting a stale `deepestId` — after `ab905141`'s `seedFromItem` prepopulates a deep node, confirm picking a new TOP category resets `subId`/`subSubId` so `deepestId` falls back to the top `categoryId`.
- Filter labels changed to **All / Yes / No** (from Image: Any / With / Without) per QC.
- Onboarding does not grant a ballpark admin a `user_orgs` seat in orgs they load (concierge-extracted),
  so admin refresh is genuinely cross-org → the svc_refresh escape is required (noted, not a bug here).
  Whether onboarding SHOULD seat the admin is a separate FR-00215 call.
- Refresh runs items sequentially on the job runner (polite + single-client-safe); no cancel button for
  refresh yet (the job supports cancel server-side via the shared route if wanted later).

## Iteration — bulk-bar icons (QC, 2026-10-28)
**Triggered by QC (Liam):** the bulk action bar should match the item-card action icons — icon-only, label on hover, no visible text.
**Change:** `bulk-action-bar.component.ts` — action + Clear buttons are now icon-only, with the label as a `title` + `aria-label` hover tooltip (mirrors the `bp-itemprev-close` hover-icon pattern on the item cards); Approve icon `check` → `circle-check` (the card's review/approve glyph); square icon-button padding.
**Files:** `client-v2/src/app/shared/catalogue/bulk-action-bar.component.ts`

## Iteration — reclassify fixes (QC, 2026-10-28)
**Triggered by QC (Liam):** reclassify dropdown was empty; and prepopulate with the 1st selected item's classification.
**Fixes:**
- `reclassify-dialog.component.ts` — categories now load on the p-dialog `(onShow)` event. Root cause of the empty picker: `ensureLoaded()` fired from `onVisible()` (bound to `(visibleChange)`), but PrimeNG does NOT emit `visibleChange` when the dialog opens via the `[visible]` input, so categories never loaded. Added a `seedCategoryId` input + `seedFromItem()` that preselects the Category ▸ Subcategory ▸ Sub-subcategory cascade from the item's ancestor path (`/api/marketplace/categories/:id/path`, the same endpoint the item editor uses).
- `bulk-action-bar.component.ts` — passes the first selected item's `categoryId` (from `store.items()`) as `seedCategoryId`.
**Files:** `reclassify-dialog.component.ts`, `bulk-action-bar.component.ts`

## Iteration — My Shop rail refresh after reclassify / add-items (QC, 2026-10-28)
**Triggered by QC (Liam):** reclassifying to — or adding items to — a subcategory not previously shown needed a HARD REFRESH before it appeared in the My Shop rail.
**Root cause:** `supplier-detail`'s `subcats` resource didn't fold `catalogue.rev()`, so `invalidate()` (which reclassify already calls via the service `bust()`) never re-ran it → stale rail; and the extract `(pulled)` path reloaded the grid without invalidating.
**Fixes (`supplier-detail.component.ts`):** (1) fold `rev` into the `subcats` resource params so it re-runs on any catalogue write; (2) extract `(pulled)` → `onItemsChanged()` which invalidates + reloads. (The global marketplace rail already folded `rev` via `store.categories()/subcategories()`, so it was unaffected.)
**Files:** `client-v2/src/app/pages/suppliers/supplier-detail.component.ts`

## Chat audit (2026-10-28)

Two independent read-only passes (security + Angular/hygiene) over `ae2e7dd1^..4de79627`. Full report + triage: `docs/audits/2026-10-28-bulk-items-audit.md`. (Designer to co-review when their session is back.)

**Verdict: ship-quality.** Security model correct — no HIGH; `org_id` always session-derived, owner enum has no approve/reject, admin moderation via scoped `svc_moderate`, `0024 svc_refresh` a faithful least-privilege extension of 0013/0017. Angular well-factored.

**Fix before Done (row stays Shipped until these land):**
- **A1 (HIGH, client):** reclassify to a top-level category impossible once the dialog seeds a sub-level — no empty option to clear the drill (the deferred bug; `seedFromItem` made it bite). Add a `(whole category)` empty option.
- **A2 (MED, client):** `supplier-detail` `detail` resource doesn't fold `rev` → My Shop top-level rail stale after a mutation (completes the 114c3ed5 fix).
- **A3 (MED, client):** `pollToDone` refresh poll has no destroy cleanup (leak).
- **S3 (LOW, server):** harden `withPinnedOrgContext` RESET-ALL swallow (defence-in-depth for the svc_refresh escape).
- **S2 (LOW, server):** admin-delete parent+cascade atomicity (BEGIN/COMMIT on the pinned client).

**Rejected:** S1 (namespace filter — false positive; rebuild `categories` has no namespace col / no junk rows, verified), S4 (harmless forced-fetch), A5 (benign double-reload). Nits A6/A8/A4/S5 optional.

## Iteration — audit fixes (2026-10-28)
**Triggered by:** the chat audit above (Liam: fix all actionable findings). Branch tip was `a411e638`.
**Fixes (all ACCEPTED findings + the nits; SKIP set untouched per triage):**
- **A1 (HIGH)** `reclassify-dialog.component.ts` — `subOptions`/`subSubOptions` now prepend an explicit `{label:'(whole category)'/'(whole subcategory)', value:''}` so a seeded sub-level drill can be cleared (picking it emits `onSub('')`/`onSubSub('')` → `deepestId()` falls back to the top `categoryId`). The render `@if`s switched to the real child-count signals (`subcats()`/`subsubcats().length`) so the empty option only shows when there are children. Resolves the deferred top-level-reclassify bug.
- **A2 (MED)** `supplier-detail.component.ts` — folded `catalogue.rev()` into the `detail` resource params (mirrors the `subcats` fix), so the My Shop TOP-LEVEL rail + counts + Shopfront nav refresh after a mutation.
- **A3 (MED)** `bulk-action-bar.component.ts` — the refresh `pollToDone` loop now injects `DestroyRef`, guards each tick on a `destroyed` flag (incl. after the await), and tracks + `clearTimeout`s the poll handle on destroy — no post-destroy GETs / `busy`/`toast`/`selection`/`done` mutations.
- **S3 (LOW)** `catalogue-extract.service.js` `withPinnedOrgContext` — on a `RESET ALL` failure the client is now destroyed (`client.release(err)`) instead of returned to the pool possibly still carrying `app.svc_refresh`/`app.is_admin` (defence-in-depth for the svc_refresh escape).
- **S2 (LOW)** `item-bulk.service.js` `adminBulk` delete — parent soft-delete + child cascade wrapped in an explicit `BEGIN/COMMIT/ROLLBACK` on the request's pinned `als` client (NOT `withTransaction`, which opens a fresh client lacking the `svc_moderate` GUC). Hand-rolled txn is the correct call for the moderation path (deliberate, audited deviation from hygiene Rule 1).
- **Nits:** A6 `catalogue-grid` card checkbox `box-shadow` → `var(--shadow-xs)` (there is no `--shadow-sm` token — it was falling back to a raw rgba). A8 reclassify subcat-load catches now `console.warn` instead of silent. A4 dropped the dialog `loaded` latch (re-read categories each open — session-cached + bust-aware, so a category created elsewhere now appears). S5 per-item refresh failures log the real cause server-side and surface a generic `'fetch failed'` reason via the (own-org) poll.
**Skipped (per triage):** S1 (namespace filter — false positive on the clean rebuild schema), S4 (harmless SSRF-safe forced fetch), A5/A7 (benign).
**Verify:** `ng build` clean; backend green on :3002 after the server edits; `0024` already applied+verified (no new migration). No preview deploy (held).
**Files:** `reclassify-dialog.component.ts`, `bulk-action-bar.component.ts`, `supplier-detail.component.ts`, `catalogue-grid.component.ts`, `catalogue-extract.service.js`, `item-bulk.service.js`.
