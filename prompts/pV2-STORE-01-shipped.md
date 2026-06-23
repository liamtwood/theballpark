# pV2-STORE-01 — supplier Add/Edit product (page, profile-style)

**Shipped:** 2026-06-23, chip `[Dev v2] v2.33i`
**Commit:** `<pending>`

First slice of the supplier catalogue editor. A supplier reaches their own
storefront (via "My Shop"), and adds/edits products on a **page** that mirrors
`/settings/profile` — image picker + gallery + edit-field rows — with **Save
draft / Submit for approval**. No schema change (existing columns only); the
deferred install/coverage/services fields are not built.

## What landed
- **Item edit page** ([item-edit.component.ts](../client-v2/src/app/pages/store/item-edit.component.ts)) at
  `/store/items/new` + `/store/items/:id` — Main Image (`<app-image-picker>` in a
  drawer, scope `item`), Gallery (`<app-image-gallery>`), and edit-field rows
  (name, category select, Ballpark cost, lead-time days, description). **Save
  draft** → `draft`; **Submit for approval** → `pending`. Both POST (new) / PUT (edit).
- **Owner affordances** on `/suppliers/:id` when it's your org (`isOwner`): a
  **"+ Add product"** button replaces the favourite heart; the rail item-preview
  gains an **Edit** (pencil) on items you own (`ownedByActiveOrg`).
- **Gated v2 endpoints** ([store-items.js](../server/src/routes/store-items.js),
  `/api/store/items`) — GET/:id, POST, PUT; `requireActiveMembership('item.create')`,
  `org_id` from the session (never body), Zod-validated, `is_active=false` until
  a ballpark admin approves; supplier status restricted to `draft|pending`.
- **`draft` codelist value** added to `item_approval_status` (`draft → pending`
  transition); seeded via `codelists-seed.js` (data, not schema).
- **Service:** `ItemService.create`/`UPDATABLE_COLS` now carry `approval_status`
  + `is_active` (defaults preserve v1 behaviour: approved + active).

## Files touched
| File | Notes |
|---|---|
| `server/src/services/item.service.js` | create + UPDATABLE_COLS: approval_status / is_active |
| `server/src/schemas/store-item.schema.js` | NEW — Zod (draft\|pending; existing cols only) |
| `server/src/routes/store-items.js` | NEW — gated, org-scoped create/update/get |
| `server/src/index.js` | mount `/api/store/items` on the v2 router |
| `server/src/db/codelists-seed.js` | `draft` value + draft→pending transition |
| `client-v2/src/app/core/store/store-item.service.ts` | NEW — typed client |
| `client-v2/src/app/pages/store/item-edit.component.ts` | NEW — the page |
| `client-v2/src/app/app.routes.ts` | `/store/items/new` + `/:id` |
| `client-v2/src/app/pages/suppliers/supplier-detail.component.ts` | owner "Add product" + isOwner |
| `client-v2/src/app/pages/marketplace/rail/item-preview.component.ts` | owner Edit |

## Acceptance — verified (no preview; CC verified service + build, Liam QCs UX)
- Backend create→`draft`(inactive) / submit→`pending` / cleanup — ✓ (service test)
- Gated + org-scoped + draft|pending only — ✓ (route + schema)
- `draft` codelist value live (icon pencil-line) — ✓
- Build + 48/48 server tests — ✓

## API audit — `/api/store/items` (new)
- ✓ Method semantics — GET read / POST create (201) / PUT update.
- ✓ Input validation — Zod (`StoreItemCreate/UpdateSchema`); `approval_status ∈ draft|pending`.
- ✓ Authorization — v2 session + `requireActiveMembership('item.create')`; ownership checked (`item.org_id === req.user.org_id`) on GET/PUT.
- ✓ `org_id` sacred — session only, never body (`.strip()` drops it).
- ✓ Status codes — 400 invalid / 403 not-your-item / 404 / 200 / 201.
- ✓ SQL — parameterised via ItemService; jsonb `images` stringified.
- ✓ Information disclosure — GET returns only the caller's own item.
- N/A Idempotency — create not idempotent (expected).
- ✓ Performance — single-row ops.

## Concerns not in spec
### Supplier can't see their own draft/pending items to re-edit
**Where:** the storefront Store tab uses the marketplace query (`is_active AND approved`).
**What:** A new draft/pending item is `is_active=false`, so it does NOT appear on the supplier's own storefront — meaning the **Edit entry point only works for already-approved items**. The supplier can Add, but can't find a draft to resume.
**Suggested fix:** next slice — when the viewer owns the storefront, list ALL their items (incl. draft/pending) on the Store tab. (Owner-sees-everything query branch.)
**Severity:** MEDIUM (blocks the full draft round-trip; Add works).

### Editing an approved item unpublishes it
**Where:** `store-items.js` PUT forces `is_active=false`.
**What:** A supplier editing a live product takes it offline until re-approved. Correct for moderation, but worth confirming the product behaviour.
**Severity:** LOW (by design; flag).

### Ballpark approve/reject not built
**Where:** the flow's `pending → approved/rejected` transition.
**What:** Suppliers can submit (`pending`); there's no admin UI/endpoint yet to approve/reject. Next slice.
**Severity:** LOW (planned phasing).

## Iteration — v2.33j (2026-06-23) — active by default, install cost, layout
**Triggered by QC:** Liam — active by default for now; add Installed Cost; one attribute per row; Image Approval Process panel.
**Commit:** `<pending>`

- **Active by default** — saved products go **live immediately** (`approval_status='approved'`, `is_active=true`) instead of draft/inactive. Resolves the draft-visibility gap (the supplier sees their item on the storefront right away). The draft→submit→approve moderation flow is deferred to a later slice; the form is now a single **"Save product"** button.
- **Installed Cost (Optional)** — new field = the install add-on; stored as **`max_price` = ballpark cost + install** (no new column). A live "Installed: £X" line shows the total; edit recovers the add-on as `max_price − base_price`.
- **Layout reworked** — two columns: LEFT = attributes one-per-row in order (Product Name, Category, Main Image, Gallery Images, Ballpark Cost, Installed Cost, Lead Time, Description); RIGHT = an **Image Approval Process** info panel.
- Schema/route updated: `max_price` accepted; `approval_status` no longer supplier-sent (route forces approved+active).

Verified: build clean; service create with base 1000 + max 1200 → approved + active, install add-on recovers to 200.

## Iteration — v2.33k/l/m (2026-06-23) — centre, banner, draft/submit
**Triggered by QC:** Liam — narrow + centre the page; main image as a wide banner; drop the redundant upload button; two save actions in the left column.
**Commit:** `<pending>`

- **v2.33k** — page wrapped in a centred `mx-auto max-w-4xl` container (matches the supplier storefront): narrower columns, centred.
- **v2.33l** — Main Image rendered as a 16:7 full-width rounded **banner** (clickable to upload), like the supplier cover.
- **v2.33m** — removed the redundant "Change/Upload image" button (the banner is the click target). Save actions **moved into the left column** beneath the attributes, now **two buttons: Save Draft** (white/outline) → `draft` and **Submit for Approval** (gradient) → `pending`. This **reverts the v2.33j "active by default"**: `is_active` is server-forced `false` again, so an item only goes live once a ballpark admin approves it. Schema/route accept supplier status `draft|pending`; the client sends `approval_status`.

Verified: client build clean; 48/48 server tests.

⚠️ **Visibility note (re-opened):** with draft/pending now `is_active=false`, a saved item does **not** appear on the supplier's own storefront — so the next slices (owner-sees-own-drafts list + ballpark approve/reject) are needed to complete the round-trip. (Same MEDIUM concern documented above.)

## QC notes
(Liam — log in as a supplier (e.g. ryan@rocketfood.example) → My Shop → "+ Add product" → fill it in → **Save Draft** or **Submit for Approval**. Note: the item stays hidden from the storefront until a ballpark admin approves it — owner-sees-drafts + approve UI come next.)

## Chat audit
(chat fills this in)
