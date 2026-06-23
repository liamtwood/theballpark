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

## Iteration — v2.33o/p (2026-06-23) — editor headers + owner store filters
**Triggered by QC:** Liam — fix the column headers + add a Status section with date/time; add Status + Is-Active filters so a supplier can see their Draft/Pending/Approved items (default to inactive). "ok to pollute for now" → filters added into the shared marketplace flow, owner-gated.
**Commit:** `<pending>`

- **v2.33o** — editor headers fixed: **left = Add New Product / Edit Product**, **right = Image Approval Process**, with a **Status** section beneath it (codelist pill + the date/time the status was set — the seed for a status-over-time history).
- **v2.33p — owner store filters.** On the supplier's OWN store (`/suppliers/:ownOrgId` Store tab) two selects appear: **Status** (All/Draft/Pending/Approved/Rejected) and **Active** (Inactive[default]/Active/All). They write `?status`/`?active`, flow through `MarketplaceStore` → `catalogue.items` → `GET /api/marketplace/items`.
  - **Authorization (the careful bit):** the `status`/`active` params are honoured **only when `supplier === req.user.org_id`** (server-side `ownerScope`). Every other caller — including an owner browsing someone else's store, and the public `/marketplace` — is forced to `is_active AND approval_status='approved'`. No way to leak draft/hidden items.
  - **Default = Inactive** so a supplier lands on their unpublished work first (Liam). On `/marketplace` the filters are null (public grid unchanged).
  - ⚠️ **Pollution noted (tidy later):** the category-strip counts on the owner Store tab still come from the public approved-count query, so they can disagree with a draft/inactive-filtered grid. Per-card status pills not added yet. (Liam: "ok to pollute for now… tidy it up later.")

Verified: client build clean; 48/48 server tests.

### v2.33q — filters moved into the band, defaults relaxed
Liam QC: the owner filters must match the price/tier standard and sit beside them.
- Status + Active are now `app-edit-field type="select"` in `filter-band` (rendered only when `store.isOwnerStore()`), next to price/tier — the separate native-select bar + its style are gone.
- Defaults relaxed to **Any Status** + **All** (was Inactive), so an owner sees their whole catalogue first, then narrows. Server gate unchanged (owner-only). Build clean.

## Iteration — v2.33r (2026-06-23) — ballpark-admin moderation (approve/reject)
**Triggered by QC:** Liam — add Marketplace to the admin Home defaulting Status=Pending; admins see the same item page as suppliers but with Approve/Reject; Reject → status rejected.
**Commit:** `<pending>`

- **Admin Home tile** — `Marketplace` added to `BALLPARK_TILES` → `/marketplace?status=pending` (the approval queue first).
- **Admin marketplace visibility** — `marketplace.js` now relaxes the active+approved filter for `adminScope` (`req.user.role === 'ballpark_admin'`) as well as the owner, so admins see pending/all items **cross-org**. Public callers are unaffected.
- **Filters for admins** — `MarketplaceStore.showStatusFilters = isOwnerStore || isBallparkAdmin`; the Status/Active selects (band) now appear for admins, and Status **defaults to Pending** for an admin who isn't on their own store.
- **Review entry** — the rail item-preview shows a **Review** (circle-check) link → `/store/items/:id` for ballpark admins on items they don't own.
- **Item page, moderation mode** — `item-edit` is now two modes on one definition. For a ballpark admin: fields render **read-only**, the banner/gallery are non-interactive, and the buttons become **Approve** (grad) / **Reject** (outline). It loads via the admin endpoint (the supplier GET is ownership-gated).
- **Endpoint** — NEW `server/src/routes/admin-items.js` (mounted at `/api/admin`, `admin.cross_org_view`): `GET /items/:id` (cross-org read) + `PUT /items/:id/approval` `{ decision }` → approve = approved+active (publish), reject = rejected+hidden.

**Authorization:** moderation routes sit behind the `admin.cross_org_view` gate; `req.user.role` is the live DB-derived role (not a JWT claim). Suppliers (no `admin.cross_org_view`) can't reach the admin endpoints; `isModerator` in the client is org-type `ballpark`.

Verified: client build clean; 48/48 server tests.

## Iteration — v2.33s (2026-06-23) — card Edit button + inactive status pill
**Triggered by QC:** Liam — items need an Edit button; inactive items should show their status as a pill in the marketplace.
**Commit:** `<pending>`

- `CatalogueItem` now carries `approvalStatus` + `isActive` (added to the `/api/marketplace/items` SELECT + mapping).
- **Status pill** — the item card shows an `app-status-pill` (top-left overlay) for any item where `!isActive` (so owners see Draft/Pending/Rejected on their own store; admins see Pending in the queue). Active+approved cards are unchanged.
- **Edit button** — owned items (`ownedByActiveOrg`) get a full-width **Edit** button on the card → `/store/items/:id` (stops propagation so it doesn't also select the card).

Verified: client build clean; 48/48 server tests.

## Iteration — v2.33t (2026-06-23) — Shopfront moves to Profile; shop = items only
**Triggered by QC:** Liam — Profile is the supplier's edit view, Shopfront is the flashy consumer view; the two belong together. The "shop" is only for managing items.

- **Profile page** (`/settings/profile`) now has a **Profile | Shopfront** tab-band (suppliers only). Profile tab = the existing editable org form/media. **Shopfront** tab mounts the same `storefront-panel` the marketplace renders, previewing the owner's own org (loaded via `catalogue.supplierDetail(activeOrgId)`); subcat cards deep-link into the owner's item store.
- **Owner's shop is items-only** — on `/suppliers/:id`, the Storefront tab + toggle now **hide for the owner** (`isOwner`), so "My Shop" opens straight into item management (Store). Back goes Home.
- **Customers unaffected** — a non-owner browsing a supplier still sees the full Storefront + Store tabs.

Verified: client build clean.

### v2.33v — Profile sections split: Completeness / Branding / About Us / Gallery / Finance
Liam QC: each a separate section, in that order; About Us carries the description (confirmed `orgs.description` exists).
- **Branding** — `org-media show="banner"` (cover + logo only).
- **About Us** — the former "Company Information" section, **renamed**, now with a full-width **Description** textarea at the top (the public blurb). Threaded `description` end-to-end: `orgs.description` → `GET/PUT /api/organisation` (+ Zod) → `OrgProfile` → profile form/save. Same field the shopfront renders.
- **Gallery** — `org-media show="portfolio"` split into its own titled section; saves immediately (cover/primary still work).
- **Finance** — the former "Financial defaults", renamed and moved below Gallery.
- *Interpretation note:* I folded the company-info fields (name/address/contact/ref-prefix) under **About Us** alongside the description to match the 5-section list — say if you'd rather keep "Company Information" as its own section.
Build clean; 48/48 server tests.

### v2.33y — more profile sections (placeholders + Team Members)
Liam QC: add **Social Links** after About Us ("coming soon"); after Gallery add **Most Viewed Products This Month**, **Availability**, **Payment Information** (all "coming soon"), then **Team Members** (real). Order now: Completeness, Branding, About Us, **Social Links**, Company Information, Gallery, **Most Viewed Products This Month**, **Availability**, **Payment Information**, **Team Members**, Finance.
- Placeholders are titled `edit-section`s with a "Coming soon." caption.
- **Team Members** lists everyone in the org via `TeamService.list()` (GET /api/team) as a read-only roster: avatar · name · role/title · email. Role line = `jobTitle` else effective role + org name (e.g. `supplier_admin · Ballpark's Supplier`). `/api/team` is admin-gated, so it populates for admins; members see a note. Build clean.

### v2.33w — About Us split from Company Information
Liam QC: About Us = description only, followed by Company Information (the fields). Now six sections: Completeness, Branding, **About Us** (own edit lifecycle, saves just `description`), **Company Information** (name/city/country/address/email/phone/ref-prefix), Gallery, Finance. Build clean.

### v2.33u — Branding container, cover first
Liam QC: on the Profile tab the media block moves to the **top** as the first section, wrapped in a titled **Branding** container (`app-edit-section title="Branding" [editable]="false"` — org-media keeps its own cover/logo/gallery editing). Cover image is now the first thing on the profile. Build clean.

## Iteration — v2.34c (2026-06-23) — view actions + cancel approval request
**Triggered by QC:** Liam — item view page (read-only, same as edit) with Cancel / Approve / Reject (approve+reject = ballpark admins); a pending supplier item shows "Cancel approval request" instead of "Submit for Approval".

- **Supplier, status = pending** → the **Submit for Approval** button is replaced by **Cancel approval request**, which reverts the item to `draft` (withdraws it from the queue). Reuses the supplier PUT (`approval_status: 'draft'`); no backend change.
- **View (read-only) mode** (ballpark admin today) → action row is now **Approve · Reject · Cancel**. Cancel returns to where they came from (the marketplace queue). Approve/Reject unchanged.
- Refactored `save()` into a shared `persist(status, msg)`; `cancelRequest()` and `save()` both route through it.
- *Note:* a generic non-admin "viewer" can't open `/store/items/:id` yet (the GET is owner- or admin-scoped) — a public/agency read-only GET is a later slice. Build clean.

## QC notes
(Liam — log in as a supplier (e.g. ryan@rocketfood.example) → My Shop → "+ Add product" → fill it in → **Save Draft** or **Submit for Approval**. Note: the item stays hidden from the storefront until a ballpark admin approves it — owner-sees-drafts + approve UI come next.)

## Chat audit
(chat fills this in)
