# Audit — pV2-ITEM-BULK-ACTIONS-01 (Bulk item management)

**Date:** 2026-10-28 · **Branch:** `rebuild/org-slice` · **Range audited:** `ae2e7dd1^..4de79627`
**Method:** two independent read-only passes (subagents) against the current source (not the ship report) + `docs/ENGINEERING.md`, the FR-00215/0013/0017 security model, and v2 Angular standards. Triaged by chat (CC). The designer (who normally co-audits) was offline; this stands for their review when back.

## Verdict

**Ship-quality.** The security model is implemented correctly — **no HIGH security finding**: no cross-tenant content write, no authz bypass, `org_id` is always session-derived, the owner enum has no approve/reject, admin moderation runs through the scoped `svc_moderate` escape, and the `0024 svc_refresh` guard is a faithful least-privilege extension of 0013/0017. The Angular side is well-factored (correct OnPush/signals/resource usage, genuine single-extraction reuse across both mounts).

**One HIGH (client correctness):** the deferred "reclassify to a top-level category" bug is confirmed and root-caused — fix-before-release. Plus two MEDs (an incomplete rev-fold from the staleness fix; a poll-timer leak) and a set of LOW hardening/nits.

## Triage

| # | Sev | Area | Finding | Verdict | Owner |
|---|-----|------|---------|---------|-------|
| A1 | HIGH | client | Reclassify to a top-level category impossible once the dialog seeds a sub-level (no empty option to clear the drill) | **ACCEPT — fix before release** | dialog (seedFromItem = CC) |
| A2 | MED | client | `detail` resource (My Shop top-level rail + counts) doesn't fold `rev` → stale after mutation | **ACCEPT — fix** | CC (completes 114c3ed5) |
| A3 | MED | client | `pollToDone` recursive `setTimeout` has no destroy cleanup → leak + post-destroy emit | **ACCEPT — fix** | build session |
| S1 | MED | server | reclassify `isValidCategory` doesn't filter `namespace='catalogue'` / exclude `rlstxn%` | **REJECT** (false positive for the rebuild — see below) | — |
| S2 | LOW | server | admin-delete soft-delete + cascade are two statements with no explicit txn on the pinned client | **ACCEPT — fix (hardening)** | build session |
| S3 | LOW | server | `withPinnedOrgContext` swallows a `RESET ALL` failure → a leaked `svc_refresh`/`is_admin` could reach the next pooled request | **ACCEPT — fix (hardening, defence-in-depth)** | shared infra (CC) |
| A6 | LOW | client | raw `rgba()` in a `box-shadow` token fallback (`.bp-bulk-check--card`) | **ACCEPT — nit** | build session |
| A8 | LOW | client | silent `/* none */` catch on subcat load (invisible transient failure) | **ACCEPT — minor** | dialog |
| A4 | LOW | client | dialog `loaded` latch → a category created elsewhere this session isn't in the picker until reload | ACCEPT — minor/defer | dialog |
| A5 | LOW | client | double-reload after a sync bulk action (bust + `done`→reloadItems) | ACKNOWLEDGE — benign | — |
| A7 | LOW | client | line caps: `bulk-action-bar` 265 (>250 warn); `supplier-detail` 621 (pre-existing); shared→pages `MarketplaceStore` import | ACKNOWLEDGE — not blocking | — |
| S4 | LOW | server | owner refresh can force a `guardedFetch` of another org's PUBLIC item url | REJECT — harmless (SSRF-safe; cross-org UPDATE no-ops under RLS) | — |
| S5 | LOW | server | per-item fetch error `err.message` surfaced verbatim via the own-org poll | ACCEPT — optional (generic message) | build session |

### Why S1 is rejected (verified)
The finding applies memory `project_categories_namespace_junk`, which describes the **old shared DB**. The v2dev **rebuild** `categories` table was rebuilt clean: verified on dev2 — **no `namespace` column**, **0** `rlstxn%` rows, **0** feedback-tracker rows (201 rows, all catalogue). The proposed fix (`AND namespace='catalogue'`) would error (no such column), and there are no non-catalogue rows to guard against. Existence-only validation is sufficient here. (If junk is ever reintroduced, revisit.)

## Recommended fix set (before release)
1. **A1** — add an explicit empty option (`{label:'(whole category)', value:''}`) to the dialog's `subOptions`/`subSubOptions` so picking it resets the drill and `deepestId()` falls back to the top `categoryId`. (This is the deferred top-level-reclassify bug; CC's `seedFromItem` prepopulate is what made it bite.)
2. **A2** — fold `rev: this.catalogue.rev()` into `supplier-detail`'s `detail` resource (or `detail.reload()` in `onItemsChanged`), so the My Shop **top-level** rail/counts refresh too.
3. **A3** — add `DestroyRef`/`takeUntilDestroyed` (or clearTimeout on a destroyed guard) to the refresh-images poll.
4. **S3** — on `RESET ALL` failure destroy the client (`client.release(err)`), or explicitly `set_config('app.svc_refresh','f')` + reset `app.is_admin` before release (mirror `lib/moderation.js`).
5. **S2** — wrap the admin-delete parent+cascade in an explicit `BEGIN/COMMIT` on the pinned client.

Nits (A6/A8/A4/S5) optional. A5/A7/S4 no action.

**Backlog status:** row stays **Shipped** (not Done) until A1–A3 + S2/S3 land.

---

## Full report — Security + data-model (server)

Core model correct; no HIGH. org_id always session-derived; owner enum has no approve/reject; admin moderation via scoped `svc_moderate`; `0024 svc_refresh` is a correct least-privilege extension of 0013/0017.

- **[MED] S1** `item-bulk.service.js` `isValidCategory()` — reclassify category validation checks only existence (`id=$1 AND deleted_at IS NULL`), not `namespace='catalogue'`/`NOT LIKE 'rlstxn%'`. *(Rejected — rebuild schema is clean; see above.)* Caveat from the agent: the single-item write path does **no** category validation at all, so this new code is already stricter, not a regression.
- **[LOW] S2** `item-bulk.service.js` adminBulk delete — soft-delete parents then cascade children as two `pool.query()`s with no explicit txn (deliberately avoids `withTransaction` because that opens a fresh client lacking the `svc_moderate` GUC — correct — but then forgoes `BEGIN/COMMIT` on the pinned client). Crash between them → orphaned live children (recoverable).
- **[LOW] S3** `catalogue-extract.service.js` `withPinnedOrgContext` finally — `await client.query('RESET ALL').catch(()=>{})` then `client.release()` (no err). If RESET ALL throws without killing the connection, the client returns to the pool still carrying `app.svc_refresh='t'`/`app.is_admin='t'`; request middleware doesn't clear `svc_refresh`, so the next borrower could satisfy the `or app_svc_refresh()` branch → cross-org image tampering (column-confined to images; approval/delete still safe). Narrow (requires a silent RESET failure on a live connection); pre-existing pattern now carrying a cross-org write-escape.
- **[LOW] S4** owner refresh can submit another org's PUBLIC item id → server `guardedFetch`es its stored `external_url`. Neutralised: guardedFetch is SSRF-safe + IP-pinned; the cross-org UPDATE matches no RLS branch (owner, no svc_refresh) → 0 rows → skipped. Harmless; noted for completeness. *(Rejected.)*
- **[LOW] S5** per-item fetch failures store raw `err.message` in `job.results.reason`, surfaced via the poll (own-org scoped). Optional: generic message.

**Clean/confirmed:** org_id provenance; Zod (ids uuid min1/max500; owner enum excludes approve/reject; categoryId required for reclassify; suppliers reach approval_status only via submit→pending); per-persona gating server-side (enum + service action sets); make-active requires approved (status/approval_status independent); admin moderation via withModeration on the pinned client (never withTransaction/app_is_admin; admin router gated by `admin.cross_org_view`); the 0024 guard (reproduces 0013, svc_refresh not on items_delete, trigger permits only images cross-org, svc_moderate branch == 0017, nullif('') helper, no read grant, GUCs mutually exclusive); parameterised SQL; poll authz scoped to `org_id`; SSRF-safe refresh fetch.

## Full report — Angular + hygiene (client)

Solid, well-factored; correct OnPush/signals/resource; genuine single-extraction reuse; the reactivity fixes are the right shape.

- **[HIGH] A1** `reclassify-dialog.component.ts` + `select.component.ts` — the Subcategory/Sub-subcategory selects have no selectable empty option ("(whole category)"/"(whole subcategory)" are placeholder text only). After `seedFromItem()` prepopulates `subId`/`subSubId`, the user can't clear the drill back to a shallower node, and re-selecting the already-seeded top category is a no-op (`pick()` suppresses an unchanged-value emit → `onCategory()` never resets `subId`). So `deepestId()` is stuck at the seeded depth → an item homed at L2 can't be re-filed to its whole top-level category (reclassify to a *different* top category still works because that changes the value). **Fix:** prepend `{label:'(whole category)', value:''}` to `subOptions`/`subSubOptions`.
- **[MED] A2** `supplier-detail.component.ts` `detail` resource (params `{id, scope}`, no `rev`) doesn't re-run on a catalogue write. It feeds the top-level rail (`storeCategories`), `supplierTotal`, and the Shopfront nav. 114c3ed5 folded rev into `subcats` (L2/L3) but not `detail` → the My Shop **top-level** rail/counts stay stale after reclassify/add-items until hard refresh. **Fix:** fold `rev` into `detail` (or reload it in `onItemsChanged`).
- **[MED] A3** `bulk-action-bar.component.ts` `pollToDone` — recursive `setTimeout(...,1200)` with no DestroyRef/clearTimeout. Navigate away mid-refresh → poll keeps firing GETs and calls `busy.set`/`toast.add`/`selection.clear`/`done.emit` on a destroyed component. **Fix:** cleanup on destroy.
- **[LOW] A4** dialog `loaded` latch → a category created elsewhere this session won't appear in the picker until reload.
- **[LOW] A5** double-reload after a sync bulk action (bust invalidate + `done`→reloadItems). Benign.
- **[LOW] A6** `catalogue-grid` `.bp-bulk-check--card` — raw `rgba` in a `box-shadow` token fallback (token-hygiene nit).
- **[LOW] A7** `bulk-action-bar` 265 lines (>250 warn); `supplier-detail` 621 (>400, mostly pre-existing); `shared/` component imports `MarketplaceStore` from `pages/` (intentional shared context; layering smell).
- **[LOW] A8** `onCategory`/`onSub` swallow subcat-load failure with `/* none */` and no user feedback.

**Clean/confirmed:** standalone + OnPush, signals + @if/@for, input()/output()/model(), inject() DI, host:{class} (no *ngIf/@Input/EventEmitter/constructor-DI regressions); onShow vs visibleChange fix correct (`/path` endpoint returns root→leaf as seedFromItem assumes); seedFromItem reset-then-seed sound (apart from A1); firstSelectedCategoryId uses Set insertion order (reliable); extract-before-duplicate (store + bar + dialog each defined once, mounted by both pages; grid stays dumb via a selectable input/output triad); pruneSelection effect guarded (retainOnly returns same ref when unchanged → no loop); user-facing error toasts present; delete confirm-gated; server value-gate mirrored client-side.
