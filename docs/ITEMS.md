# Items — lifecycle, rules, gaps, enhancements

Comprehensive doc on the item entity in Ballpark. Covers what an item
is, how it moves through its lifecycle, who can do what, how visibility
works, current gaps from the data-model-vs-UI audit, and the
enhancement backlog. Intended as the source of truth that anyone
working on items (supplier UX, admin moderation, marketplace browse,
quotes) consults to understand the whole picture.

Pairs with: `STORE.md` (supplier-side Add/Edit + moderation
implementation), `MARKETPLACE.md` (public browse + filtering),
`PROFILE.md` (supplier identity that items belong to), `BALLPARK_ADMIN.md`
(admin moderation surfaces), `CODELISTS.md` (`item_approval_status`
drives status pill + transitions), `SHARED_SERVICES.md` (item endpoints
in inventory).

## What an item is

An **item** is a product or service that a supplier (organization of
`type = 'supplier'`) offers in the Ballpark marketplace. Items have a
name, description, image(s), price, lead time, category, and a status
that determines whether they're publicly listed.

Items are owned by exactly one supplier (`items.org_id`). When agencies
build project quotes, they add items to their quote — see PROJECTS.md.

## Attributes

What's stored on an item, what's displayed/editable, and where each
attribute lives. Sourced from data-model-vs-UI audit 2026-06-23.

### Core content

| Attribute   | Values                        | In UI                        | In DB                                     | Description                                                                |
| ----------- | ----------------------------- | ---------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| Name        | free text                     | Edit · View · Card · Preview | `items.name VARCHAR(255) NOT NULL`        | Product or service name                                                    |
| Description | free text                     | Edit · View · Preview        | `items.description TEXT`                  | Long-form description                                                      |
| Category    | from `categories` (top-level) | Edit · View · Preview        | `items.category_id UUID FK→categories`    | Top-level marketplace category                                             |
| Subcategory | from `categories` (child) | View · Card · Preview · Edit *(STORE-FIELDS-02)* | `items.subcategory_id UUID FK→categories` | Currently auto-classified via TaxonomyService at create-time; supplier-editable override lands in STORE-FIELDS-02 |
| Tags | text array | Edit *(STORE-FIELDS-02)* | `items.tags TEXT[] DEFAULT '{}'` | Supplier-editable free-text tags; downstream search/filter consumption deferred |

### Pricing & commerce

| Attribute                          | Values                                                      | In UI                                                                 | In DB                                            | Description                                                                                                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base price                         | numeric                                                     | Edit ("Ballpark Cost") · View · Card ("From £X") · Preview            | `items.base_price NUMERIC(12,2)`                 | Ballpark price quoted to buyers                                                                                                                                                                                   |
| **Currency** (NEW — STORE-FIELDS-01) | ISO-4217 code (e.g. GBP, EUR, USD) — from currency codelist | Edit (optional override) · View · Card · Preview | `items.currency VARCHAR(3) NULL` | Defaults to supplier's `default_currency` when NULL. Single currency per item — for multi-currency support, supplier duplicates per currency |
| **Install cost** (RENAMED in STORE-FIELDS-01) | numeric (optional) | Edit · View | `items.install_cost NUMERIC(12,2)` (renamed from `max_price`) | Additional cost when install included. Renamed to resolve dual-role confusion; `max_price` retired |
| **Install description** (NEW — STORE-FIELDS-01) | free text | Edit · View (when install option set) | `items.install_description TEXT NULL` | Describes services bundled with install (e.g. "Build, delivery, on-site setup, post-event removal"). Pairs with Install cost |
| **Install unit** (NEW — STORE-FIELDS-01) | `per_item` (default when NULL; × qty) / `per_order` (flat) / `percentage` (% of base line) | Edit (label: "Install Cost Applies") · View | `items.install_unit VARCHAR(20) NULL` | Drives the per-line install cost formula in `LINE_TOTAL_SQL` — see PROJECTS.md §Install choice & install basis. **RP-04 open:** options hardcoded at `item-edit.component.ts:295` (fixed set; refactor to codelist if extension ever needed) |
| ~~Minimum price~~ (REMOVED in STORE-FIELDS-01) | — | — | ~~`items.min_price`~~ (dropped) | Was unused; removed |
| Tier                               | basic / mid / premium                                       | — (filter only; not editable)                                         | `items.tier VARCHAR(20) DEFAULT 'mid'`           | Price-tier filter dimension; not user-editable                                                                                                                                                                    |

### Practical info

| Attribute     | Values                                                 | In UI                                                           | In DB                               | Description                                                              |
| ------------- | ------------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| Unit          | codelist `item_unit` (each / pair / m² / hour / etc.) | Edit (codelist-driven select — resolved v2.34p) · View · Card · Preview ("/ unit") | `items.unit VARCHAR(50)` | Pricing unit; crucial for buyer clarity. **Audit gap RESOLVED v2.34p** — supplier can now change unit via codelist select |
| Lead time | integer days (planned: + days/weeks unit toggle in STORE-FIELDS-02) | Edit only — **NOT displayed back (audit gap; addressed STORE-FIELDS-02)** | `items.lead_time_days INTEGER` (+ planned `items.lead_time_unit` for toggle) | Time between order and delivery; STORE-FIELDS-02 adds days/weeks unit toggle + display surface |
| ~~Coverage area~~ (numeric — kept; ambiguous, unused) | numeric | — | `items.coverage_area NUMERIC(10,2)` | Kept for now; ambiguous semantics. See **Location coverage** below for the place-name replacement |
| **Location coverage** (NEW — STORE-FIELDS-01) | free text (e.g. "London & South East") | Edit · View · Card | `items.location_coverage TEXT NULL` | Free-text place-name description of where supplier serves; replaces semantic-gap from numeric `coverage_area` |
| Serves        | integer count                                          | — (server-side only; affects cart math)                         | `items.serves INT`                  | Pack size — how many guests one unit serves (e.g. platter feeds 10)      |

### Media

| Attribute          | Values                 | In UI                                               | In DB                                                    | Description                                                |
| ------------------ | ---------------------- | --------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Main image         | URL                    | Edit (image picker) · View (cover) · Card · Preview | `items.image_url VARCHAR` (auto-synced from `images[0]`) | Primary item image; legacy column auto-synced from gallery |
| Gallery            | array of image objects | Edit (image gallery) · View                         | `items.images JSONB DEFAULT '[]'`                        | Multi-image gallery `[{url, sort_order, is_hero}]`         |
| External URL       | URL                    | — (reserved)                                        | `items.external_url VARCHAR`                             | Unused                                                     |
| Image display mode | `cover` (only)         | — (not editable)                                    | `items.image_display VARCHAR(10) DEFAULT 'cover'`        | How image renders; future use                              |

### Lifecycle & visibility

| Attribute       | Values                                | In UI                                        | In DB                                                                  | Description                         |
| --------------- | ------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| Active          | true / false                          | Owner toggle (Card · Edit · Item view)       | `items.is_active BOOLEAN DEFAULT true`                                 | Supplier-controlled visibility flag |
| Approval status | draft / pending / approved / rejected | Status pill (Card · Item view · Admin queue) | `items.approval_status VARCHAR` (from `item_approval_status` codelist) | Moderation state; codelist-driven   |

### Ownership & lineage

| Attribute | Values | In UI | In DB | Description |
|---|---|---|---|---|
| Owner org | org ID | Supplier link (View · Card · Preview) | `items.org_id UUID FK→orgs` | Supplier that owns the item |
| Derived from | item ID | — (deferred) | `items.derived_from_id UUID FK→items` | Lineage — points to source item if duplicated; will be set on duplicate-when-approved flow |
| Parent item | item ID | — (deferred) | `items.parent_item_id UUID FK→items` | Variant relationship — current item is variant of parent |

### Reserved / metadata

| Attribute | Values | In UI | In DB | Description |
|---|---|---|---|---|
| Attributes | JSONB bag | — (reserved) | `items.attributes JSONB DEFAULT '{}'` | Open extension point for future per-item metadata without schema migration |
| **Ballpark ID** (proposed) | `BP-NNNN-NNNNN` format | — (planned) | — (planned; pV2-ITEM-ID-01) | Human-readable identifier; deferred design per Liam 2026-06-23 |

### Variant matrix — `attributes.variants` (pV2-STORE-VARIANTS-01)

A configurable product (WooCommerce **variable** product; e.g. a print item priced by
size × sides × quantity) is captured as a flat priced-combination set inside the
`attributes` JSONB bag — **no new tables, no N-dimensional grid**. Shape:

```jsonc
attributes.variants = {
  "dimensions": [                                  // the picker axes, in supplier order
    { "name": "Finished Size", "values": ["A4 (297×210mm)","A5 (210×105mm)","A6 (148×105mm)"] },
    { "name": "Printed Sides", "values": ["Single sided","Double sided"] },
    { "name": "Quantity",      "values": ["50","100","250","500","1000"] }
  ],
  "combos": [                                       // one entry per purchasable combination
    { "values": { "Finished Size":"A6 (148×105mm)", "Printed Sides":"Single sided", "Quantity":"50" }, "price": 53.00 }
    // …sparse: combinations that don't exist are simply absent
  ]
}
```

Rules:
- **Flat combos, not a grid** — matrices are sparse (disabled combinations happen); a flat
  list handles that and stays trivial to resolve in the UI.
- **`base_price` = the cheapest combo** — an honest "From £X" on cards / marketplace.
- **Non-varying attributes** (declared but constant across combos, e.g. Paper Type) are
  demoted to the **Specifications** group, not the picker.
- **Pricing SSOT** — a chosen combo sets the line via the existing `flat_total` override
  ([[project_flat_total_pricing]] / [[project_line_pricing_ssot]]); the picker never does its
  own maths. **Precedence:** when `variants` is present its combo price is the line base;
  `options` (upcharges) and `price_tiers` (volume) are for simple products and do **not**
  stack on a variant product in v1.
- **Import** — the Woo pull (`processWooUrl`) fetches all variation prices in one extra Store
  API call (`?type=variation&parent=<id>`), joining them to the parent's per-variation
  attribute values. Snapshot at pull (price-is-a-guide); re-loadable.

### System columns

| Column | Notes |
|---|---|
| `items.id UUID PK DEFAULT uuid_generate_v4()` | System identifier (not human-readable; see proposed `ballpark_id` above) |
| `items.created_at`, `items.updated_at` | Timestamps |
| `items.created_by`, `items.updated_by` | User audit |
| `items.deleted_at` | Soft-delete (NULL = active; soft-delete on every items query) |

## Lifecycle — states + transitions

```
              (supplier creates)
                     ↓
                ┌─────────┐
                │  draft  │ ◄────┐
                └─────────┘      │ (supplier cancels submission)
                     │           │
                     │ (supplier submits)
                     ↓           │
                ┌─────────┐──────┘
                │ pending │ ◄──────────────┐
                └─────────┘                │
                  │     │                  │ (supplier
        (admin    │     │ (admin           │  re-submits
        approves) │     │ rejects)         │  after fixing)
                  ↓     ↓                  │
            ┌─────────┐ ┌───────────┐──────┘
            │approved │ │ rejected  │
            └─────────┘ └───────────┘
              │     ▲       (editable; behaves like draft;
   (admin     │     │        rejection comment preserved on item_events)
   revokes)   │     │ (admin
              ↓     │ activates)
            ┌─────────┐
            │approved │
            │ inactive│
            └─────────┘
```

### State definitions

| State | `approval_status` | `is_active` | Visible in marketplace? |
|---|---|---|---|
| Draft | `draft` | false | No — supplier-only |
| Pending review | `pending` | false | No — supplier + admin only |
| Approved (live) | `approved` | true | **Yes — public** |
| Approved (inactive) | `approved` | false | No — supplier deactivated |
| Rejected | `rejected` | false | No — but editable + re-submittable (behaves like draft; previous rejection comment preserved on `item_events`) |

### Transitions
Items have an **approval status** used to track items through an approval process and an **active flag** to allow the supplier to control the visibility of that item in their store.

| From → To                                   | Triggered by                           | Notes                                                                                                                                                              |
| ------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (new) → `draft`                             | Supplier saves item without submitting | "Save Draft"                                                                                                                                                       |
| `draft` → `pending`                         | Supplier submits                       | "Submit for Approval"; notifies admins (STORE-02b)                                                                                                                 |
| `pending` → `draft`                         | Supplier cancels submission            | "Cancel Approval Request"; replaces Submit while pending                                                                                                           |
| `pending` → `approved`                      | Ballpark admin approves                | Auto-active if `is_active=true` (default); item goes live in marketplace                                                                                           |
| `pending` → `rejected`                      | Ballpark admin rejects                 | Rejection reason captured as `item_events` comment (STORE-02a)                                                                                                     |
| `approved` (active) → `approved` (inactive) | Supplier deactivates                   | Item hidden from marketplace; supplier can reactivate                                                                                                              |
| `approved` (inactive) → `approved` (active) | Supplier activates                     | Item returns to marketplace                                                                                                                                        |
| `approved` → `rejected`                     | Ballpark admin revokes                 | Rare; pulled from market post-approval                                                                                                                             |
| `rejected` → `pending`                      | Supplier re-submits after fixing       | Item editable while in rejected state; re-submit transitions back to pending for re-review. Rejection comment from prior cycle preserved on `item_events` timeline |

**`rejected` behaves like draft** — supplier can edit the item AND re-submit it (rejected → pending). The status stays `rejected` until re-submitted, preserving the visual/audit history that it was rejected. Rejection comment from the prior cycle remains visible on the `item_events` timeline so supplier has context on what to fix.

**Edit lock once approved** — approved items become uneditable (locked). Supplier must **duplicate** the item to change anything (creates new draft from copy). Preserves what was approved while letting supplier iterate.

## Roles + permissions matrix

### What each role can DO

| Action | Supplier (owns item) | Agent (agency) | Ballpark admin |
|---|---|---|---|
| Browse / search / filter (price, tier) | ✓ | ✓ | ✓ |
| Wishlist (♥) / Add to Quote (+) | — | ✓ | — |
| Status + Active filters | ✓ (own store) | — | ✓ (marketplace, defaults Pending) |
| Add product | ✓ | — | — |
| Edit product (draft / pending / rejected) | ✓ (own) | — | — |
| Edit approved product | — (locked → duplicate) | — | — |
| Submit for approval / Cancel request | ✓ (own) | — | — |
| Duplicate | ✓ (own) | — | — |
| Delete (soft, confirm dialog) | ✓ (own) | — | — |
| Activate / Deactivate (approved only) | ✓ (own) | — | — |
| Approve / Reject | — | — | ✓ |
| Comment on item review | ✓ (own pending/rejected) | — | ✓ |
| Open read-only item page | ✓ (own, incl. approved) | ✓ (`?view`) | ✓ (review) |

### What each role can SEE

| Visibility | Supplier | Agent | Ballpark admin |
|---|---|---|---|
| Approved + active items (public grid) | ✓ | ✓ | ✓ |
| Own draft / pending / rejected / inactive | ✓ (own only) | — | — |
| Any supplier's pending / draft / inactive (cross-org) | — | — | ✓ (Status filter) |
| Status pill on inactive cards | ✓ (own) | — | ✓ (queue) |
| Card management buttons (Edit/Dup/Active/Trash) | ✓ (own items) | — | — |
| Review (Approve/Reject) controls | — | — | ✓ |
| Comment thread on item | ✓ (own items only) | — | ✓ (all items) |

**Enforcement note:** all of the above is server-enforced, not just UI. Store routes require `item.create` permission + ownership (`org_id` from JWT); admin routes require `admin.cross_org_view`; the public item GET returns approved+active only; the `?view` flag + owner-scope decides the read path. Card gating is UX on top of that server enforcement.

## Visibility rules — the canonical query

**Marketplace public listing:**
```sql
WHERE items.is_active = true 
  AND items.approval_status = 'approved'
  AND items.deleted_at IS NULL
```

**Supplier's own store** (logged-in supplier viewing their own items):
```sql
WHERE items.org_id = $sessionOrgId
  AND items.deleted_at IS NULL
  -- no status/active filter; supplier sees everything they own
```

**Admin moderation queue:**
```sql
WHERE items.deleted_at IS NULL
  -- no status/active/owner filter; admin sees everything; UI defaults to ?status=pending
```

**Soft-delete enforced everywhere** — `deleted_at IS NULL` filter in every items query (RP-ST4-adjacent rule).

## Auto-approval policy (planned — STORE-02d)

Two-level control with sensible precedence.

| Setting | Default | Where lives |
|---|---|---|
| Global: `app_config.require_item_approval` | `true` | Ballpark-wide default |
| Per-supplier: `orgs.auto_approve_items` | `NULL` (follow global) | Supplier override |

**Precedence:**
- If `orgs.auto_approve_items IS NOT NULL` → use that explicit override
- Else → use inverse of global `require_item_approval`

**Use cases:**
- **Default** (`true` global, `NULL` per supplier): every item requires admin approval
- **Trusted supplier**: `orgs.auto_approve_items = true` for that supplier — their submissions go straight to approved+active
- **Probationary** (manual): admin watches new supplier for N items, then flips `auto_approve_items = true`. Or future: per-supplier item counter (`probationary_items_remaining`).
- **Platform-wide trust** (future): set global to `false` — all items auto-approve unless per-supplier requires approval explicitly
- **AI review** (future): global enum migrates from boolean to `'manual' | 'auto_approve' | 'ai_review'`

**Audit trail still applies** — auto-approval creates an `item_events` row with `actor_role = 'system'`. Every transition is recorded, automatic or human.

## Comments + audit trail (planned — STORE-02a)

**Single `item_events` table** combines comments + status transitions in one timeline:

```sql
CREATE TABLE item_events (
  id UUID PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES items(id),
  event_type TEXT NOT NULL,        -- 'transition' | 'comment' | 'note'
  from_status TEXT,                 -- nullable; only for transitions
  to_status TEXT,                   -- nullable; only for transitions
  actor_user_id UUID NOT NULL,
  actor_role TEXT NOT NULL,         -- 'supplier_admin' | 'ballpark_admin' | 'system'
  body TEXT,                        -- comment text; transitions may have body for reason
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**UI:** "Activity" section on item view page renders the timeline
chronologically. Admin sees full thread cross-supplier. Supplier sees
their own item's thread (own comments + admin responses).

**Add Comment action** visible on item view page when:
- Supplier viewing their own item in `draft`, `pending`, or `rejected` state
- Ballpark admin viewing any item in `pending` state (or later, for re-review context)

**Rejection MUST include a comment** (locked decision per Liam) — admin
cannot reject silently. Forces actionable feedback to supplier. UI may
provide quick-pick reasons that pre-fill the comment ("Image quality",
"Pricing missing", "Category mismatch") for speed.

## Notifications (planned — STORE-02b)

Email-first via existing Resend integration. Each moderation event
triggers an email:

| Event | Notify | Subject pattern |
|---|---|---|
| Supplier submits for approval | Ballpark admins (BCC) | "Item awaiting review: {{itemName}} ({{supplierName}})" |
| Ballpark admin approves | Supplier (TO) | "Your item is approved: {{itemName}}" |
| Ballpark admin rejects | Supplier (TO) + comment body | "Your item needs changes: {{itemName}}" |
| Supplier cancels submission | Ballpark admins (BCC) | "Submission cancelled: {{itemName}}" |
| Admin adds comment (item in pending) | Supplier (TO) | "Comment on your item: {{itemName}}" |
| Supplier adds comment | Ballpark admins (BCC) | "Supplier replied on: {{itemName}}" |

Reuses the welcome-email pattern (TO + BCC + signature + HTML escape).
Per-event enable/disable via app_config (future Feature Flags UI).

**In-app notifications:** deferred — email is the urgent channel.

## Review queue page (planned — STORE-02c)

Dedicated admin moderation page at `/admin/review-queue`. Replaces the
marketplace-with-?status=pending pattern with a workflow-optimized UI:

- Queue list (oldest pending first; configurable sort)
- Side-by-side view: item details + Approve/Reject + comment box
- Auto-advance to next item after action
- Keyboard shortcuts: **A** = approve, **R** = reject, **C** = comment, **J** / **K** = next/prev
- Queue stats header: "12 pending, oldest 3 days, by supplier: X(4), Y(8)"

Significantly better admin UX than the current marketplace-with-filter approach.

## Current gaps (audit 2026-06-23)

Surfaced by the data-model-vs-UI audit. Each gap has a clear remediation path.

### Items table — display / edit gaps

| Gap | Status today | Fix |
|---|---|---|
| **`unit` not editable** on Add/Edit Product (per_head/per_day/each/etc) — crucial buyer-clarity field | Displayed on item card + preview ("/ unit") but supplier can only set default via backend | Add unit dropdown to item-edit form. STORE-02 polish OR bundled with QUANTITY-01b integration |
| **`lead_time_days` edited but not displayed** | Form accepts; no surface renders the value | STORE-02 polish — add to item view + preview meta row |
| **`max_price` dual-role confusion** (Installed Cost add-on vs total) | Single column, ambiguous interpretation | STORE-FIELDS-01 — split into `install_cost_addon` for clarity, OR document one canonical meaning |
| `min_price` exists but never displayed/edited | Internal only currently | Defer — unclear use case |
| `tags` array exists, no UI tagging surface | Internal only | Defer — future tag-driven discovery feature |
| `coverage_area` (numeric, not place-name) — ambiguous | Internal only, no UI | Defer — likely Location Coverage column proper (STORE-FIELDS-01) |
| `external_url` exists, unused | Internal | Defer |
| `attributes` JSONB reserved for future per-item metadata | Internal | Defer — open extension point |
| `derived_from_id` / `parent_item_id` (item lineage) | Internal — drawer deferred | Defer — lineage view future feature |

### Orgs (supplier) table — display / edit gaps

| Gap | Status today | Fix |
|---|---|---|
| **`website` missing from profile edit form** | Displayed on supplier shopfront Contact card BUT not editable in /settings/profile | Next profile polish ship — add URL field to Company Information section |
| `vat_registered` / `vat_number` exist, not editable | Compliance deferred | Future Finance arc |
| `auto_publish_items` BOOLEAN exists (precursor of auto-approval) | Internal | Subsume into STORE-02d auto-approval policy |
| `image_display` (cover mode) — set to 'cover' default | Internal | Defer — no current UX need |
| `subscription_tier`, `balls_balance`, `balls_monthly_allowance` | Internal billing/ledger | Future billing arc |

### Hard gaps in DATA MODEL (no column for declared feature)

| Feature | Need | Status |
|---|---|---|
| ~~Install Cost as separate column from base~~ | RENAME `max_price` → `install_cost` | **SHIPPED v2.34p** |
| ~~Location Coverage (text)~~ | New `items.location_coverage TEXT NULL` | **SHIPPED v2.34p** |
| ~~Included Services~~ | Resolved via `install_description TEXT NULL` (free-text) | **SHIPPED v2.34p** |
| ~~Currency override per item~~ | New `items.currency VARCHAR(3) NULL` (defaults to supplier currency) | **SHIPPED v2.34p** |
| ~~Drop unused `min_price`~~ | Column dropped | **SHIPPED v2.34p** |
| Subcategory editable in form | Supplier-editable override of auto-classify | **STORE-FIELDS-02** |
| Tags editable in form | Surface existing `tags TEXT[]` column to supplier | **STORE-FIELDS-02** |
| Lead-time unit toggle (days vs weeks) | Add `items.lead_time_unit` enum; UI toggle | **STORE-FIELDS-02** |
| Lead-time display on item view + card | Currently editable but never displayed (audit gap) | **STORE-FIELDS-02** |
| Per-item currency in marketplace card display | Currently hardcoded GBP on cards; surface from `items.currency` | **STORE-FIELDS-02** polish |
| Subcategory auto-classify routine wired into item create endpoint | TaxonomyService exists in shared backend but not wired into `/api/items-v2` create flow; items currently rely on manual classification or backfill scripts | Deferred — not blocking; track here |
| Legacy seed scripts still reference `min_price`/`max_price` | Would error if re-run after STORE-FIELDS-01 schema change | Cleanup ship — touch when seeds get touched |
| **Codelist-driven extensible attributes** *(under consideration — not committed)* | Reuses existing `items.attributes` JSONB column + a new `item_attribute_extensions` codelist where ballpark admins define available attributes (key, type, help). Suppliers see an "Add Attribute" button on Add/Edit Product, pick from the codelist list, fill value, save. Significantly extensible without new dev cycles. Heavy lifting (codelist admin UI, JSONB column) already exists — implementation is ~3-4 days CC work if pursued. **Open: per-category filtering, required vs optional, search/filter by attribute value. Decision pending — see Open issues §9.** | pV2-ITEM-ATTRIBUTES-01 (maybe; future) |

## Open issues

Active product-level questions worth resolving:

1. **Reject reason format** — quick-pick presets or free-text only? My lean: BOTH (quick-pick pre-fills the comment textarea; admin can edit).
2. ~~**Rejected → re-submit transition**~~ **RESOLVED 2026-06-23** — rejected items ARE editable + re-submittable (behaves like draft). No need to duplicate.
3. **Admin-as-supplier confusion** — Ballpark admins can own items (admin's own org's items). UI implicit context today; could surface as mode toggle if confusion arises (RP-ST3).
4. **Comment editing/deletion** — can authors edit/delete their own comments? Or are item_events immutable (audit-trail purity)? My lean: immutable — comments are part of the audit; admin can post correction comments rather than editing.
5. **Notification frequency control** — admin gets emailed on every supplier submit. With volume, that's noisy. Should there be daily digest mode? Per-admin preferences? Defer to v2 of notifications.
6. **Bulk operations** (multi-select approve/reject in queue) — power-user feature; defer until volume warrants.
7. **Item view URL for public shareability** — `/items/:id` should be publicly accessible for approved+active items so suppliers can link to their product. Verify.
8. **Item delete is soft** — deleted items still occupy `items` table; recoverable. Hard-delete path needed? Defer unless GDPR demands.
9. **Edit-risk model — decision deferred; options + lean noted below** — current model is "approved items are locked; duplicate to edit." Google/industry research surfaces several alternatives. **Decision needs customer conversation (with suppliers) before locking.**

**Options on the table:**

| Model | Description | Pros | Cons |
|---|---|---|---|
| **Current: duplicate to edit** | Approved items locked. Supplier duplicates to edit. Original stays live; duplicate gets fresh approval cycle. | Simple, secure, no schema change | Catalog bloat, SEO/review loss on duplicates, pricing-typo lag (must wait for approval cycle to fix wrong price) |
| **Single-version edit-and-hide** | Edit transitions approved item back to `pending`; item disappears from marketplace until re-approved. No versioning. | Single source of truth; no schema additions; item identity preserved | Brief visibility gap during re-review (supplier loses business window) |
| **2-table: active + inactive pair (clone-based)** | `items` (canonical/live) + `item_drafts` (pending edits awaiting review). Live version stays visible during re-review. On approve: field-copy draft→items; delete draft. | No visibility gap; item identity preserved; clean separation | +1 table; clone-on-edit logic; admin needs draft-review UI |
| **3-table: 2-table + `item_history` (self-journaling)** | Above + `item_history` append-only table. Captures every past approved state automatically. | Free audit trail + revert capability + "what did buyer see when they added it?" queryability | +2 tables; slightly more storage; audit-trail discipline required |
| **Hybrid: tier by field-risk** | Pricing/active stay instant; content/images/category trigger one of the above re-approval flows | Best UX (no typo lag); industry standard (Walmart-style) | Adds tier classification per field; depends on which re-approval flow is chosen |

**Lean:** 3-table (active + inactive + history) hybrid with field-tiering. Gives free audit trail + maintains supplier visibility during re-review + lets pricing fixes go instant. Highest engineering cost; highest user-experience win.

**Action:** customer conversation (with suppliers as proxy, or Beth/Meg) before STORE-FIELDS-01 ships so edit behavior can lock alongside the new fields.
10. **Extensible attributes (codelist-driven EAV) — maybe** — see Enhancement backlog `pV2-ITEM-ATTRIBUTES-01`. Decision deferred; revisit after STORE-FIELDS-01 lands (universals as typed columns) to see if remaining attribute requests are common-enough to promote OR varied-enough to warrant the EAV path.

## Enhancement backlog

Future features mapped to ship arcs:

| Enhancement | Ship | Notes |
|---|---|---|
| Item comments + audit timeline | STORE-02a | Combined `item_events` table |
| Email notifications for moderation events | STORE-02b | 6 events covered |
| Dedicated `/admin/review-queue` page | STORE-02c | Workflow-optimized admin UX |
| Auto-approval policy (global + per-supplier) | STORE-02d | Boolean foundation; future AI/probationary migrate from this |
| `unit` editable on item form | STORE-02 polish OR QUANTITY-01b | Audit gap |
| `lead_time_days` displayed on item view | STORE-02 polish | Audit gap |
| `website` added to profile edit form | Next profile polish | Audit gap |
| ~~`install_cost_addon` column split from `max_price`~~ | **SHIPPED v2.34p** (renamed `max_price` → `install_cost`) | — |
| Subcategory editable + Tags editable + Lead-time unit toggle + Lead-time display + Per-item currency in marketplace cards | STORE-FIELDS-02 | Locked scope for next data-model ship |
| Auto-classify wiring on item-create endpoint | Deferred | TaxonomyService routine exists in shared backend; not yet wired into v2 item create. Run manually via backfill scripts for now. Update when next touched |
| Location Coverage text column | STORE-FIELDS-01 | Real field demand |
| Included Services column | STORE-FIELDS-01 | Real field demand |
| Lead-time unit toggle (days/weeks) | STORE-FIELDS-01 | Friction reduction |
| AI auto-review | Future | Migrates from boolean auto-approve to enum |
| Per-supplier probationary period | Future | Counter or expiration on orgs |
| Item analytics (views, adds-to-quote) | Analytics arc | Tracking layer needed first |
| Item lineage drawer (derived_from / parent_item) | Future | Schema reserved; UI deferred |
| Tag-driven discovery | Future tag arc | `tags` column ready |
| **Human-readable `ballpark_id` for items + orgs** (Liam's proposal 2026-06-23, locked format) | pV2-ITEM-ID-01 (future, deferred) | Fixed-length string IDs with brand prefix: orgs `BP-0001`, `BP-0002` (4-digit org counter); items `BP-0001-00001`, `BP-0001-00002` (org-id + 5-digit item counter). **No type marker** — URL/context disambiguates entity (avoids I/1, O/0 visual ambiguity). Sortable, copyable, predictable, brand-meaningful. Ceilings: 9999 orgs (probably plenty), 99999 items per org (asymmetric headroom — suppliers may have large catalogs). Implications: (a) projects under same scheme (`BP-0001-00001` — URL path distinguishes), OR project ref scheme retained separately; (b) backfill existing items + orgs in created_at order; (c) replace existing `orgs.ref_prefix`/`ref_counter` for projects with the unified scheme. |
| In-app notifications | Future | Email-first today |
| Bulk moderation operations | Future | Volume-driven |

## Locked architectural decisions

1. **Approval is the default; auto-approval is the override.** Global `require_item_approval = true` by default — safer fallback. Trust granted explicitly per-supplier or globally turned off via admin decision.
2. **`rejected` behaves like draft.** Editable + re-submittable (rejected → pending). Status stays `rejected` until re-submitted to preserve history. Rejection comment from prior cycle preserved on `item_events` timeline so supplier has context to fix.
3. **Edit lock on approved items.** Once approved, item is uneditable. Supplier duplicates to make changes. Preserves what was approved.
4. **Server-enforced everything.** Permissions, ownership, status transitions, visibility — all server-side. Client trust insufficient. UI gating is layered on top.
5. **Single `item_events` table** for comments AND transitions. One source of truth for "what happened to this item."
6. **Auto-approval still creates audit entries.** `actor_role = 'system'`. Every transition recorded.
7. **Rejection MUST include comment.** Forces actionable feedback. UI may pre-fill via quick-pick presets.
8. **Soft-delete everywhere.** `deleted_at IS NULL` filter on every items query.
9. **Items locked to ONE supplier.** `items.org_id` is exclusive ownership.
10. **Marketplace visibility = `is_active && approved`.** Canonical rule (RP-ST4); never bypassed.

## Risk patterns (cross-ref STORE.md)

- **RP-ST1** — status transitions bypassable via direct PATCH. Strip `approval_status` from accepted PATCH fields; only dedicated transition endpoints.
- **RP-ST2** — ownership enforcement on every write.
- **RP-ST3** — admin-as-supplier confusion.
- **RP-ST4** — marketplace visibility regression (`is_active && approved` rule).
- **RP-ST5** (NEW for STORE-02) — item_events must include actor + timestamp; never trust client-supplied actor.
- **RP-ST6** (NEW for STORE-02d) — auto-approval policy MUST be server-evaluated on every Submit. Never trust client-supplied approval state.
- **RP-ST7** (NEW for STORE-02a) — comments may contain user-supplied HTML; sanitize on render (RP-A2-equivalent rule).

## Version history (overview — see STORE.md for ship-by-ship)

| Phase | Ship | What landed |
|---|---|---|
| Foundation | STORE-01 (v2.33h-s) | Add/Edit Product page, draft/submit/approve flow, owner store filters, admin moderation tile + per-item approve/reject |
| Moderation extension | STORE-02 (planned) | Comments + audit timeline (02a), notifications (02b), review queue page (02c), auto-approval policy (02d) |
| Data model expansion | STORE-FIELDS-01 (deferred) | Install Cost split, Location Coverage, Included Services, lead-time unit toggle |
| Polish | STORE-02-polish (bundled with 02) | Audit gaps: unit editable, lead_time_days displayed, website on profile |

## When to update this doc

- New item state added → update Lifecycle + state table
- New transition added → update Transitions table
- Permissions matrix shifts (role gains/loses an action) → update Permissions matrix
- New gap discovered → log under Current gaps with remediation path
- Enhancement scope clarified → move from "future" to a named ship in Enhancement backlog
- Locked decision changes → update Locked architectural decisions
- New risk pattern surfaces → log under Risk patterns

## Pairs with

- `docs/STORE.md` — implementation details for the supplier-side flow + admin moderation (this doc is conceptual; STORE.md is technical)
- `docs/MARKETPLACE.md` — public browse + filter that consumes approved+active items
- `docs/PROFILE.md` — supplier identity that owns items
- `docs/BALLPARK_ADMIN.md` — admin Home tiles + moderation queue page
- `docs/CODELISTS.md` — `item_approval_status` codelist drives status pill + transitions; `draft` value added in STORE-01
- `docs/SHARED_SERVICES.md` — item endpoints in inventory; `/api/items-v2/*` and `/api/admin/items/*`
- `docs/AUDIT_LEDGER.md` — RP-ST* risk patterns + STORE arc learnings
- v1 reference (retiring at pV2-11): items existed but had no v2 management UI until STORE-01
