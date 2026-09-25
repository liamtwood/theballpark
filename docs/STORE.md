# Store — supplier catalogue management (Add/Edit Product + moderation)

One-pager. Documents the full supplier catalogue loop: Add/Edit Product
page, draft → pending → approved/rejected status workflow, supplier
self-service filters (own store), Ballpark admin moderation queue +
per-item Approve/Reject actions. Built in STORE-01 (v2.33h-s) reusing
the profile/org-media patterns from MEDIA-01.

Pairs with: `BALLPARK_ADMIN.md` (moderation queue Home tile + admin
actions), `PROFILE.md` (Add/Edit Product layout reuses profile-section
patterns), `MEDIA.md` (image picker + gallery primitives reused on
items), `CODELISTS.md` (`item_approval_status` codelist drives status
pill + transitions; `draft` value added in this arc), `MARKETPLACE.md`
(public listing only shows `is_active && approval_status='approved'`).

## What it is

The supplier catalogue loop. Suppliers add + edit their products,
optionally save as draft, submit for approval. Ballpark admins moderate
via a queue. Approved items appear in the public marketplace.

**Three surfaces, one workflow:**

| Surface | URL | Who uses it | What |
|---|---|---|---|
| **My Shop** | `/store` (supplier's own storefront) | Supplier (owner) | List of supplier's own items with status filters (drafts, pending, approved, rejected) |
| **Add/Edit Product** | `/items/new` and `/items/:id/edit` | Supplier (owner) | Profile-style edit page; create new OR edit existing item |
| **Item view** | `/items/:id` | Anyone (visitors + admins + suppliers) | Read-only product page; admin sees Approve/Reject; supplier sees Edit (own items) |

**Plus the moderation queue:**

| Surface | URL | Who | What |
|---|---|---|---|
| **Admin Marketplace** | `/marketplace?status=pending` | `ballpark_admin` | Cross-org queue defaulting to Pending; admin reviews + approves/rejects |

## Why we needed it

Pre-STORE-01:
- Items existed in DB but had no v2 management UI (item editing was deferred to "/store arc")
- Suppliers couldn't add/edit their own catalogue without DB access
- Item moderation only happened via Supabase dashboard
- The 14 Phil Creates items had to be loaded via a one-off script

STORE-01 closed the loop end-to-end: supplier authors, admin approves,
marketplace surfaces.

## Who can use it

| Role | Add/Edit own items | View own draft/pending | View any approved item | Approve/Reject |
|---|---|---|---|---|
| Supplier admin/member (item owner) | ✓ | ✓ | ✓ | — |
| Agency admin/member | — | — | ✓ (approved only) | — |
| `ballpark_admin` | ✓ (any item — admin-as-owner) | ✓ all items cross-org | ✓ | ✓ |
| Anonymous | — | — | ✓ (public marketplace) | — |

## Supplier storefront — the public brand page (`/suppliers/:id`)

The buyer-facing supplier page (distinct from **My Shop**, the owner's item
manager). A tab band sits over a brand banner:

| Tab | Who | What |
|---|---|---|
| Profile | owner / ballpark admin | editable org profile (save-on-blur) |
| Shopfront | everyone | read-only brand page — company info, contact, category cards |
| Shop | everyone | the shared marketplace grid, pinned to this supplier |
| AI Assist | ballpark admin | the catalogue extractor (Analyse → Prepare → Load) |

**Brand header (pV2-STOREFRONT-MENU-01, release v0.3.1).** On the Shopfront and
Shop tabs the supplier's **cover image backs the page header** — the name, city
and the tab band ride on top of it behind a light directional veil (kept
strongest top-left for legibility). The cover + menu break out of the `<main>`
gutter to run edge-to-edge, and the banner tucks up under the fixed header (no
top gutter). Profile / AI Assist render the header plain.

**Category menu band.** Directly under the banner, a full-width **dark-rose**
bar (`--theme-accent`, white UPPERCASE links) lists the categories the supplier
has live items in — visually distinct from the white tab band above it. Each
category opens a full-width **mega-menu** of its subcategories (and their
sub-subcategories), built from the org-scoped subcategory feed. Any click
outside the band closes it.

**Browse-in-place.** Picking a category / subcategory renders the supplier's
items right below the menu, under a title + tagline header — the buyer never
leaves the shopfront. The grid reuses the shared `catalogue-grid` + the pinned
`MarketplaceStore` items (same visibility + pagination as the Shop tab).

Menu + selection state live in `supplier-detail.component.ts`;
`storefront-panel.component.ts` renders the selected grid off a `selection`
input (and still owns Company Info / Contact / category cards / portfolio).

## Add/Edit Product page

**Layout:** Profile-style (matches `/settings/profile` pattern). Centred
page, main image as wide cover banner, one-attribute-per-row layout.
Right column header + Status section (status pill + transition
date/time).

**Reused primitives (no new components):**
- `<app-image-picker>` for main image (scope = item)
- `<app-image-gallery>` for gallery (multi-image)
- `<app-edit-section>` + `<app-edit-field>` for text fields (matches profile)
- `<app-status-pill>` for status (driven by `item_approval_status` codelist meta)

**Fields (post STORE-FIELDS-01 / v2.34p-q):**

| Field | Column | Notes |
|---|---|---|
| Product Name | `items.name` | Required |
| Category | `items.category_id` | Existing taxonomy |
| Subcategory | `items.subcategory_id` | Auto-classified via TaxonomyService if not set |
| Main Image | `items.image_url` | Via image picker (Upload / Find / Use Icon) |
| Gallery Images | `items.images` (JSONB) | Via image gallery |
| Ballpark Cost | `items.base_price` | Numeric £ |
| Unit | `items.unit` | **Shipped v2.34p.** Codelist-driven (`item_unit`). How the price scales (each / pair / m² / hour / etc.) |
| Install Cost (optional) | `items.install_cost` | **Renamed v2.34p from `max_price` (idempotent migration).** Numeric £; separate from base cost |
| Install Cost Applies | `items.install_unit` | **Shipped v2.34p.** How install_cost applies to a line: `per_item` (default when null; × qty) / `per_order` (flat) / `percentage` (% of base line). **RP-04 open**: options hardcoded in `item-edit.component.ts:295` — acceptable fixed set today, refactor to codelist if extension is ever needed |
| Included Services | `items.install_description` | **Shipped v2.34p.** Textarea; describes what's bundled with install (e.g. "Build, delivery, on-site setup, post-event removal") |
| Location Coverage | `items.location_coverage` | **Shipped v2.34p.** Free text; supplier's service radius / regions |
| Currency | `items.currency` | **Shipped v2.34p.** ISO-4217; defaults to supplier org's `default_currency` at create |
| Lead Time | `items.lead_time_days` | Integer days (unit toggle deferred to STORE-FIELDS-02) |
| Description | `items.description` | Free text |
| Tags | `items.tags` | Existing text[] |
| Active toggle | `items.is_active` | Default `true` (active-by-default) |
| Status | `items.approval_status` | Codelist-driven (draft/pending/approved/rejected) |

**Deferred to STORE-FIELDS-02:**
- Subcategory editable in UI (currently auto-classified only)
- Lead-time unit toggle (days vs weeks)
- Per-item currency override display on cards
- Tag editing in edit form (currently read-only display)

## Status workflow

**Codelist: `item_approval_status` (shared schema, system codelist).**

| Code | Label | Color | Terminal? | Allowed next |
|---|---|---|---|---|
| `draft` | Draft | muted / pencil | no | `pending` (submit) |
| `pending` | Pending | warn / clock | no | `approved`, `rejected`, `draft` (cancel submission) |
| `approved` | Approved | success / check | no | `rejected` (admin can revoke) |
| `rejected` | Rejected | danger / x | no | `pending` (supplier re-submits after fixing — editable behaves like draft) |

**`draft` value added in STORE-01** — codelist value insertion (not schema change). Documented in `CODELISTS.md`.

**Transitions by actor:**

| From → To | Triggered by | UI affordance |
|---|---|---|
| (new) → `draft` | Supplier saves new item without submitting | "Save Draft" button on edit page |
| `draft` → `pending` | Supplier submits for review | "Submit for Approval" button (shown when status=draft) |
| `pending` → `draft` | Supplier cancels their own submission | "Cancel Approval Request" button (replaces Submit when status=pending; supplier-side only) |
| `pending` → `approved` | Ballpark admin approves | "Approve" action on item page (admin-only, visible when status=pending) |
| `pending` → `rejected` | Ballpark admin rejects | "Reject" action on item page (admin-only) |
| `approved` → `rejected` | Ballpark admin revokes | "Reject" action (admin-only; rare) |

**`rejected` is terminal** — to reuse a rejected item, supplier creates a new one. (Could relax later if needed.)

**Marketplace visibility:** `is_active = true AND approval_status = 'approved'` (existing rule; enforced server-side in marketplace query).

## My Shop — supplier's own storefront

**URL:** `/store` (was a coming-soon stub pre-STORE-01).

**Replaces "coming soon" with the supplier's own catalogue view.**

For suppliers (owner view):
- Lists supplier's own items (regardless of status)
- Filters: Status (Any / Draft / Pending / Approved / Rejected) + Active toggle (All / Active / Inactive)
- Defaults: Any Status + All
- Filters use the standard price/tier select pattern (same as marketplace filter band)
- Server-gated: only the owner sees their non-public items (drafts, pending, rejected)
- Default landing view shows everything; supplier drills in via filters

For agencies / anonymous visitors browsing the supplier's shop publicly:
- Sees only `is_active && approved` items (no non-public visibility)
- This is the existing marketplace-supplier-detail surface, not affected by STORE-01

## Item view page

**URL:** `/items/:id`. Read-only product page reusing the Add/Edit layout
without edit affordances.

**What renders:**
- Main image (full-width cover)
- Gallery images (below)
- Product name (page title)
- Status pill (admin sees pending/draft/rejected; visitors only see approved → status pill less prominent)
- Price (Ballpark Cost — "From £X / unit")
- Description
- Category + subcategory chips
- Supplier link (back to supplier's shop)
- Tags

**Actions (role-gated):**

| Visitor sees | Owner sees | Admin sees |
|---|---|---|
| (no actions if approved) | Edit button (own items) | Edit button + Approve / Reject (pending items) + Cancel (admin-as-supplier owns submitted items) |

**Item moderation actions** (admin only, when status=pending):
- **Approve** → transitions to `approved`, makes item live in marketplace
- **Reject** → transitions to `rejected`, item permanently excluded

Endpoint: `POST /api/admin/items/:id/approve` and `POST /api/admin/items/:id/reject` (admin-gated via `ballpark_admin` role).

**Cancel approval request** (supplier only, when status=pending on their own item):
- "Cancel Approval Request" button replaces "Submit for Approval"
- Transitions item back to `draft`
- Supplier can then re-edit and re-submit

Endpoint: `POST /api/items-v2/:id/cancel-submission` (gated; only item owner).

## Marketplace admin mode — moderation queue

When `ballpark_admin` opens `/marketplace`:
- Defaults to `?status=pending` (the approval queue)
- Cross-org visibility (sees all suppliers' items)
- Standard marketplace filter band augmented with Status filter (Pending / Approved / Rejected / All)
- Inactive item cards visually distinguished (status pill)
- Owned items get Edit button (admin-as-owner case)
- Click into any item → /items/:id with Review actions visible

Documented in `BALLPARK_ADMIN.md` (Home tile → Marketplace admin mode).

## Endpoints (server)

**Pattern: `/api/items-v2/*` (parallel to v1's `/api/items`, matches projects-v2 convention).**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/items-v2/:id` | Any (role-aware) | Item detail; non-public statuses filtered out for non-owners/non-admins |
| POST | `/api/items-v2` | Supplier (item.create) | Create new item; org_id from JWT session |
| PATCH | `/api/items-v2/:id` | Supplier owner OR admin | Update item; ownership server-derived from JWT |
| POST | `/api/items-v2/:id/submit` | Supplier owner | Transition draft → pending |
| POST | `/api/items-v2/:id/cancel-submission` | Supplier owner | Transition pending → draft (cancel) |
| POST | `/api/admin/items/:id/approve` | `ballpark_admin` | Transition pending → approved |
| POST | `/api/admin/items/:id/reject` | `ballpark_admin` | Transition pending/approved → rejected |
| GET | `/api/marketplace/items?status=pending` | `ballpark_admin` for non-approved | Existing marketplace query; admin can filter to non-public statuses |

## Locked architectural decisions

1. **`/api/items-v2/*` for v2-gated endpoints.** Parallel to v1's
   `/api/items` (which remains ungated for v1's reads). Same pattern as
   `/api/projects-v2`. Avoids v1 regression.
2. **Profile-style layout for Add/Edit Product.** Reuses image picker,
   gallery, edit-section, edit-field. No new primitives.
3. **Status workflow via codelist + transitions.** Codelist drives
   labels + colors + allowed next states. `draft` value added in
   STORE-01.
4. **Active-by-default on create.** New items create with `is_active =
   true` so save-and-publish flow is one step. Supplier can deactivate.
5. **`rejected` is terminal.** No reactivation transition; supplier
   creates new item if previous was rejected.
6. **Cancel-submission returns to `draft`, not deletes.** Supplier
   keeps their work; can re-edit and re-submit.
7. **Cross-org visibility for admins** in marketplace + moderation.
   `ballpark_admin` sees all items regardless of owner; everyone else
   sees only their own non-public items + approved items globally.
8. **Default queue = Pending** when admin opens marketplace. Quickest
   path to the moderation work.
9. **Owner store filters server-gated.** Non-public statuses (draft,
   pending, rejected) only visible to owner OR admin. Server enforces;
   client trust isn't sufficient.
10. **`max_price` reused for Installed Cost.** No new column added in
    STORE-01; future STORE-FIELDS-01 can split if needed.
    *[UPDATED v2.34p — STORE-FIELDS-01 renamed `max_price` → `install_cost` via idempotent migration; base + install are now first-class separate fields. See Fields table for the full v2.34p field set.]*
11. **Approved items ARE editable (fields only; photos lock).**
    *Reverses the STORE-01 assumption that approved items are locked and require duplication to change.* Owning supplier can save field edits on an approved item and the item stays live — no re-moderation required. **Photos are the exception**: photo edits on an approved item are blocked (the UI surfaces "Photos are locked on approved items — duplicate to change them"). Rationale: fields are low-risk to edit in place (correcting a description, updating a lead time), while photo swaps could bait-and-switch the moderation call. Duplicate remains the escape hatch for photo changes. Locked Liam 2026-07-08.

## Risk patterns

- **RP-ST1 — status transitions bypassable via direct PATCH.** Item
  status must NOT be settable via `PATCH /api/items-v2/:id` body —
  only via the dedicated transition endpoints (submit / cancel /
  approve / reject). PATCH should explicitly strip `approval_status`
  from accepted fields.
- **RP-ST2 — ownership enforcement on every write.** Every
  supplier-side endpoint must verify `req.user.org_id ===
  item.org_id` before update/submit/cancel. Server-side check; never
  trust client.
- **RP-ST3 — admin-as-supplier confusion.** Ballpark admins can own
  items (admin's own org's items). UI must distinguish "I'm acting
  as supplier (editing my own item)" vs "I'm acting as admin
  (moderating someone else's)." Today this is implicit via context;
  could surface in future as a mode toggle if confusion arises.
- **RP-ST4 — marketplace visibility regression.** Public marketplace
  query MUST filter `is_active = true AND approval_status =
  'approved'`. Verify on every items-query refactor; this is the
  data-quality gate keeping unapproved items out of public view.

## Build order (shipped)

| # | Slice | Chip | Notes |
|---|---|---|---|
| 1 | "My Shop" nav (supplier's own storefront entry point) | v2.33h | Replaces /store coming-soon stub |
| 2 | Add/Edit Product page (profile-style layout) | v2.33i-n | Image picker + gallery + edit-field rows; centred; main image as cover banner |
| 3 | Save Draft / Submit for Approval flow | v2.33i-n (bundled) | Reinstated; right-column header + Status section |
| 4 | Owner store filters (Status + Active) | v2.33o-q | Server-gated; filter band; default Any Status + All |
| 5 | Marketplace admin tile + Pending default | v2.33r | Home tile (admin-only); defaults to ?status=pending |
| 6 | Per-item Approve/Reject actions + admin endpoints | v2.33s | /items/:id Review action; `POST /api/admin/items` endpoint |
| 7 | (planned next) Item view page (read-only Edit-style) + cancel approval request flow | TBD | Per Liam 2026-06-23 — view = same as edit without edit affordances; cancel transitions pending → draft |

## Audit reference

End-of-arc audit pending for v2.33h-s (STORE-01). See `AUDIT_LEDGER.md`
when populated.

## Version history

### Summary — skimmable status

| Version | Date | What changed (1-line) | Ship | QC Done? | Audit Done? |
|---|---|---|---|---|---|
| v2.33h | 2026-06-22 | "My Shop" opens supplier's own storefront | dev | ✓ | — |
| v2.33i-n | 2026-06-22 | Profile-style Add/Edit Product page; Save Draft + Submit for Approval; right-column Status section | dev | ✓ | — |
| v2.33o-q | 2026-06-23 | Owner store filters (Status + Active); server-gated visibility | dev | ✓ | — |
| v2.33r | 2026-06-23 | Marketplace tile on admin Home; defaults to Pending queue | dev | ✓ | — |
| v2.33s | 2026-06-23 | Per-item Approve/Reject actions; `POST /api/admin/items` endpoint | dev | ✓ | — |
| target | TBD | Item view page (read-only) + cancel-approval-request flow | — | — | — |
| target | TBD | end-of-arc audit (chat + architect + security) for STORE-01 | — | — | — |
| **v2.34p** | 2026-06-23 | **STORE-FIELDS-01 schema migration shipped** — RENAME `max_price`→`install_cost`; DROPPED `min_price`; ADDED `currency`, `install_description`, `location_coverage`. Applied to public/preview/master. Server item.service + Zod schema + UPDATABLE_COLS updated. Client editor surfaces all 5 with currency-suffixed labels. Currency defaults to supplier's `default_currency` via COALESCE on create. Verified end-to-end. | dev `17538c76` | ✓ | — |
| **v2.34q** | 2026-06-23 | **Editor field reorder** — Product Name → Category → Main Image → Gallery Images → Ballpark Cost → Install Cost (Optional) → Lead Time → Description → Location Coverage → Included Services | dev `3f423dd7` | ✓ | — |
| **target STORE-FIELDS-02** | TBD | Subcategory editable, Tags editable, Lead-time unit toggle (days/weeks), Lead-time display surface, per-item currency on marketplace cards. See ITEMS.md hard gaps table for full scope | — | — | — |
| **v2.618 (v0.3.1)** | 2026-09-25 | **Supplier storefront brand header** — cover image backs the page hero + tab band (Shopfront/Shop); full-width dark-rose category menu + full-width mega-menu; browse-in-place under a title/tagline header; click-out to close; logo/entity fixes (pV2-STOREFRONT-MENU-01, FR-00222) | preview | ✓ | n/a (polish) |

### Detail — QC + Audit findings per version

(End-of-arc audit deferred — populate after view page + cancel flow lands)

### Deferred — items pushed to a later prompt / arc

| Item | Why | Lands in |
|---|---|---|
| Install Cost as separate column (split from max_price) | max_price reuse is fine for v1; split when clarity needed | STORE-FIELDS-01 |
| Location Coverage column (text vs numeric) | Not yet in real demand | STORE-FIELDS-01 |
| Included Services (text[] vs textarea) | Design decision pending | STORE-FIELDS-01 |
| Lead-time unit toggle (days vs weeks) | Current integer days fine | STORE-FIELDS-01 |
| Rejected → re-submit transition (currently rejected is terminal) | Suppliers create new item if rejected; revisit if friction surfaces | future |
| Admin-as-supplier mode toggle | Current implicit context works; revisit if confusion arises (RP-ST3) | future |
| Bulk operations on items (multi-select moderation) | Single-item operations sufficient for current volume | future |
| Item revision history / audit log | Useful but not yet justified by volume | future |
| **`unit` field not editable on Add/Edit Product** (audit gap, surfaced 2026-06-23) | `items.unit` (per_head/per_day/each/etc) is DISPLAYED on item card + preview ("/ unit" suffix) but NOT editable on Add/Edit form. Supplier must accept default OR change via backend. Crucial for buyer clarity per Liam | STORE-02 polish OR bundled with QUANTITY-01b integration on item-edit |
| **`lead_time_days` edited but not displayed back** (audit gap) | Form accepts it but no surface renders the value. Dead-end edit — supplier wonders if it saved | STORE-02 polish — add to item view + preview meta row |
| **`max_price` dual-role confusion** (audit gap) | Reused for both "Installed Cost add-on" and "total installed cost" depending on interpretation. No explicit column distinguishing add-on amount vs total. Consider splitting into `install_cost_addon` for clarity OR documenting one canonical interpretation | STORE-FIELDS-01 (when new columns land) |

## When to update this doc

- New status transition added → update Status workflow table
- New endpoint added → update Endpoints table
- New field added to Add/Edit Product → update Fields table
- Marketplace visibility logic changes → update RP-ST4 + Marketplace admin section
- New risk pattern surfaces → log under Risk patterns

## Pairs with

- `docs/BALLPARK_ADMIN.md` — Home tiles (Marketplace admin mode); admin Approve/Reject actions
- `docs/PROFILE.md` — Add/Edit Product reuses profile-section patterns (Branding/About Us/Gallery layout)
- `docs/MEDIA.md` — `<app-image-picker>` + `<app-image-gallery>` primitives reused on items
- `docs/CODELISTS.md` — `item_approval_status` codelist drives status pill + transitions; `draft` value added in STORE-01
- `docs/MARKETPLACE.md` — public listing only shows `is_active && approved`; admin sees cross-org with status filter
- `docs/SHARED_SERVICES.md` — `/api/items-v2/*` + `/api/admin/items/*` in shared-services inventory
- `docs/AUDIT_LEDGER.md` — STORE-01 patterns + transitions
- v1 reference (retiring at pV2-11): item editing in v1 was at admin-level only; v2 surfaces it for suppliers directly
