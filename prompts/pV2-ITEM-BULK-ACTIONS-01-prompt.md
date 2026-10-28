# pV2-ITEM-BULK-ACTIONS-01 — Bulk item management (Image filter + multi-select actions)

**Status:** Draft (chat/designer to review) · **Origin:** QC of the Yahire catalogue pull, 2026-10-28
**Implementation:** in flight — session "Bulk item actions + Image filter" (local_542327ee).
**Ships to:** dev2 (branch `rebuild/org-slice`); held for the batched preview release.

---

## Why

Bulk moderation of a pulled catalogue. Extractor items land as `approval_status='pending'`
(admins review them via **Approvals** = the marketplace at `/marketplace?status=pending`).
Reviewing 150+ items one at a time is unworkable. Two concrete needs surfaced in QC:

1. **Find the gaps** — ~9% of a pull imported imageless. Need to *filter* by image presence.
2. **Act in bulk** — approve / activate / reclassify / delete many at once, and **backfill the
   imageless ones** (the image-cap fix only helps new pulls; already-imported items don't
   self-heal because dedup-before-AI skips them — see commits 90660310 + 3fa08e0f).

**General, not admin-only (Liam 2026-10-28):** the same capability serves suppliers (their own
items) and ballpark admins (any item); the available actions are gated per persona.

## Where

The marketplace **LIST** and **TABLE** views (the ones already toggled in
`marketplace-controls`). **Table view first**, list immediately after. The Approvals queue is
this view filtered to `status=pending`.

## The model (confirmed)

- `approval_status` (codelist `item_approval_status`): `draft / pending / approved / rejected`
  (default `pending`). Suppliers may set only **draft|pending** on their **own** items;
  **approved/rejected is the Ballpark team** (admin).
- `is_active` — separate listing flag, supplier-controlled on their own items.
- `category_id` — the item's single home node (deepest chosen cat/subcat/subsubcat).
- Two write surfaces mirror the authority split: `/api/store/items` (owner, own org) and
  `/api/admin/items` (admin, cross-org).

## Part 1 — "Image?" filter

Tri-state control in the marketplace filter row: **Image: Any · With · Without**
(by `items.images` jsonb array length). Flows through the existing marketplace filter/query path.

## Part 2 — Multi-select

Checkbox per **row** (table) and per **card** (list). Selecting ≥1 reveals a **sticky bulk bar**:
`N selected · <actions> · Clear`. **Extract the selection state + bulk bar ONCE** as a shared
component/service, reused across both views (ENGINEERING "extract before duplicate").

## Part 3 — Bulk actions (bar shows only what the viewer may do)

| Action | Field / effect | Supplier (own) | Admin (any) |
|---|---|:--:|:--:|
| Make active / inactive | `is_active` | ✓ | ✓ |
| Reclassify | `category_id` — reuse the existing taxonomy picker (cat→subcat→subsubcat) | ✓ | ✓ |
| Delete | **soft** (`deleted_at`) | ✓ | ✓ |
| Submit for review | `approval_status → 'pending'` | ✓ | ✓ |
| **Refresh Images** | re-fetch source, re-pick images, update in place | ✓ | ✓ |
| **Approve / Reject** | `approval_status → 'approved' / 'rejected'` | — | ✓ |

### Refresh Images (the imageless-items fix)

Re-fetch each item's `external_url` (via `guardedFetch`, `org-import.service.js`), re-run image
selection (`collectImageUrls` + the `looksProduct` filter in `catalogue-extract.service.js`
`processUrl`), and **UPDATE `items.images` in place**. **Zero AI** (deterministic) and it
**preserves every other field + manual edit** (category, price, etc.). This is deliberately
*images-only* — a full re-extract would cost Haiku per item AND re-derive category from the URL
group, undoing manual reclassifications; if wanted later it's a separate, explicitly-warned
action. For large selections, reuse the existing extract job/progress runner
(`catalogue_extract_job`) rather than a long synchronous request.

## Server

- `POST /api/store/items/bulk` (owner, own org; actions minus approve/reject)
- `POST /api/admin/items/bulk` (admin, cross-org; all actions)
- Zod `{ ids[], action, categoryId? }`; **per-persona action gating server-side**; `org_id` ONLY
  from `req.user` (never the body); cross-org admin reads via the `supplier_directory` pattern;
  multi-row writes via `withTransaction`.

## Files

Client: `marketplace/{marketplace-page, marketplace-controls, marketplace-filters}.component.ts`,
`marketplace-store.ts`. Server: `routes/store-items.js` + the admin items route;
`services/items.service.js`; `services/catalogue-extract.service.js`
(`collectImageUrls`/`looksProduct`/`processUrl`) + `org-import.service.js` (`guardedFetch`).
Status pills codelist-driven (`app-status-pill list="item_approval_status"`).

## Done

Image filter works in list+table; shared multi-select + sticky bar across both; all actions with
correct per-persona gating; Refresh Images backfills imageless items with no AI and no loss of
edits; bulk endpoints Zod-validated + authz-gated; `ng build` clean; backend health-checks on
:3002. Ship report written; atomic commits pushed to `origin/rebuild/org-slice`. **Not** deployed
to preview (held for the batched release).

## Concerns / open

- Refresh Images on a large selection → use the job runner (progress + cancel), not a blocking request.

## Review (designer, 2026-10-28) — implementation musts

Approved. Four conformance/security points — all "mirror the single-item flow". #2 and #3 bite if missed.

1. **No `is_active` column.** Rebuilt items (0015) have `status` (new/active/retired) + `approval_status`.
   The single-item route keeps the `{is_active: boolean}` CLIENT contract but WRITES `status`:
   `ItemService.update(id, { status: is_active ? 'active' : 'retired' })` (store-items.js:143). The bulk
   make-active/inactive must do the same map — writing `is_active` to items fails (no column).
2. **Make-active requires `approved`** (resolves the open concern above). Single-item blocks it:
   `if (is_active===true && existing.approval_status!=='approved')` → 400 (store-items.js:140). `status`
   and `approval_status` are INDEPENDENT axes; "live" = `status='active' AND approval_status='approved'`.
   Bulk make-active touches only `status` and must skip/reject not-yet-approved items (mirror the 400).
3. **[SECURITY] Admin bulk approve/reject runs through the `svc_moderate` path (`withModeration`), not
   `app_is_admin`.** `app_is_admin` was dropped from the items write WITH CHECK (FR-00215) → a direct
   cross-org admin write FAILS RLS. The single-item admin approve wraps the approval_status/deleted_at
   write in `withModeration` (scoped `app.svc_moderate` GUC, 0017 column-guarded). Do the same; do NOT
   shortcut via the owner pool (bypasses the column guard).
4. **[defense-in-depth] Owner endpoint gates `approval_status` at the VALUE level** — suppliers may set
   `∈ {draft,pending}` only; enforce in the bulk Zod/handler, not just by hiding the action (store-items.js:10).
