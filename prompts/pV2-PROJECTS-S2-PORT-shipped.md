# pV2-PROJECTS-S2 — Estimate line layer PORT onto freeze + overlay (v2dev rebuild)

**Shipped:** 2026-10-14, chip `[Dev v2] v2.750` (auto-bumped by the post-commit hook)
**Branch:** rebuild/org-slice
**Commits:** `<sha>` (server: project-line.service + routes + schema)

## What landed
- **New `server/src/services/project-line.service.js`** — the S2 line layer on the
  freeze + overlay tables (`project_items` frozen requirement · `project_item_quotes`
  sparse overlay · `project_item_matches` AI provenance). Add / remove / list / qty /
  installed / details / quote-description / estimate, all reading
  `COALESCE(quote, project_items)`. Replaces UNIFY-01's merged line-state logic
  (the dormant item/estimate functions in `projects.service.js`, which read the
  dropped `price_current`/`flat_total`/`logical_line_id`/`supplier_org_id` columns).
- **ADD = freeze clone.** The catalogue item's full definition
  (name/description/attributes/unit/currency/base_price/variant/install_*/image_url —
  hero derived from `items.images`) is cloned into `project_items`; `item_id` is
  provenance (NULL = custom). A `project_item_matches` row records `source`
  (`catalogue` for a marketplace add, `custom` for an ad-hoc line). Idempotent: a live
  clone of the same item is returned as-is; a soft-deleted one is revived.
- **Category bucketing.** A marketplace add find-or-creates the `project_categories`
  bucket for the item's catalogue category and sets `project_category_id`, so the line
  hangs off a bucket (the data-model spine) and counts as a HARD cost. `categoryId` in
  the returned `QuoteLine` is that bucket id — the stable grouping key the client sends
  back on a custom add.
- **Pricing SSOT reused unchanged.** `line-total.util.js` `lineTotalSql` runs over a
  derived `pi` that resolves the overlay (so `pi.price_current`/`pi.base_price`/
  `pi.quantity`/… are COALESCE-resolved) joined to the live `items i` for volume tiers
  + install fallback — exactly the two relations `lineTotalSql` reads. **No change to
  `line-pricing.js` / `line-total.util.js`**, so the golden contract test stays green
  (25/25, run against v2dev). The estimate cascade is the one `services/estimate.js`
  `computeEstimate` (margin on hard costs; contingency/insurance of project costs; fees
  flat), rates = `project_settings` COALESCE org defaults.
- **Routes wired** in `server/src/routes/projects-v2.js`: real `GET /:id/items` +
  `GET /:id/estimate`, plus `POST /:id/items`, `POST /:id/items/custom`,
  `DELETE /:id/items/:lineId`, `PATCH /:id/items/:lineId`,
  `PATCH /:id/items/:itemId/details`, `PUT /:id/items/:itemId/quote-description`. The
  shelved buildup endpoints (`my-components`, `/components`, `/parse-intent`,
  `/question`, `/recommend`) stub to safe empties (not 404).
- **No client changes.** The server returns the exact existing `QuoteLine` +
  `EstimateBreakdown` DTO shapes, so `project-estimate.component.ts` /
  `project-marketplace.component.ts` consume them unchanged (per the "minimal change"
  brief — the returned shape does not differ).

## Files touched
| File | Lines (Δ) | Notes |
|---|---|---|
| server/src/services/project-line.service.js | +587 / 0 (new) | S2 line layer on freeze+overlay |
| server/src/schemas/project-line.schema.js | +63 / 0 (new) | zod bodies for the line routes |
| server/src/routes/projects-v2.js | +133 / -21 | real item/estimate handlers + new routes + buildup stubs |

## Acceptance — verified by an end-to-end smoke test against v2dev
(Mimicked the request middleware: pinned client with the org/user/admin GUCs; created a
throwaway project, ran the flow, hard-deleted it — children cascade.)
- **+ adds the item (writes project_items), appears in Ballpark cost list, total updates** — ✓
  add → `QuoteLine{ categoryId=<bucket>, categoryName='Gazebos', status='to_send', isCustom=false }`;
  `listItems` count=1; estimate hardCosts=104.99 → projectCosts=125.988 (20% margin) →
  +contingency 10% → projectTotal=138.59.
- **Idempotent re-add** — ✓ returns the same row.
- **qty persists** — ✓ qty=3 → estimate hardCosts=314.97, projectTotal=415.76.
- **installed persists** — ✓ (gazebo has no install cost, so total unchanged — correct).
- **details persist** — ✓ written to the agent self-quote overlay; `name` (project_items)
  and `details` (overlay) both resolve together.
- **quote-description persists** — ✓ overlay `quote_description`, name/details intact.
- **custom line** — ✓ `isCustom=true`, categoryId=null → counts as a FEE (fees=100 for
  £50×2, NOT marked up), projectTotal=515.76.
- **remove** — ✓ soft-delete; gazebo gone, custom fee line remains.
- **golden contract test** — ✓ 25/25 pass against v2dev.
- **boot** — ✓ `curl /api/health` ok after each server edit; `/items` + `/estimate`
  routes return 401 unauth (mount proven, not 404).

## API audit checklist (server routes touched)
All routes inherit `authenticate` + `requireActiveMembership` (gated v2 router). `org_id`
comes from `req.user.org_id` (JWT) on every call — NEVER the body. UUID path slots
(`:id`/`:lineId`/`:itemId`) validated by `router.param` → clean 400.

#### `GET /:id/items`
- ✓ Method semantics (read) · ✓ Authorization (service scopes by JWT org; null→404) ·
  ✓ Status (200 / 404) · ✓ Response shape (`QuoteLine[]`) · ✓ Info disclosure (generic
  "Project not found") · ✓ Observability (error → `next(err)`) · N/A Idempotency ·
  ✓ Performance (one indexed query; buildup children excluded).

#### `GET /:id/estimate`
- ✓ Method · ✓ Authorization (JWT org; null→404) · ✓ Status (200/404) · ✓ Shape
  (`EstimateBreakdown`) · ✓ Info disclosure · ✓ Observability · ✓ Performance (single
  LATERAL aggregate; the one SSOT cascade).

#### `POST /:id/items`
- ✓ Method (201 on create) · ✓ Input validation (`ItemAddSchema`) · ✓ Authorization
  (org from JWT; project/item ownership + RLS; null→404) · ✓ Status (201/400/404) ·
  ✓ Shape (`QuoteLine`) · ✓ Info disclosure · ✓ Observability · ✓ Idempotency (live
  clone returned as-is) · ✓ Performance (one txn, Rule 1).

#### `POST /:id/items/custom`
- ✓ Method (201) · ✓ Input validation (`CustomItemSchema`) · ✓ Authorization (JWT org) ·
  ✓ Status (201/400/404) · ✓ Shape (`QuoteLine`) · ✓ Info disclosure · ✓ Observability ·
  N/A Idempotency (each custom line is new) · ✓ Performance (one txn).

#### `DELETE /:id/items/:lineId`
- ✓ Method (soft-delete) · ✓ Authorization (JWT org; null→404) · ✓ Status (200/404) ·
  ✓ Shape (`{removed}`) · ✓ Info disclosure · ✓ Observability · ✓ Idempotency (re-delete
  → removed:false) · ✓ Performance (single scoped UPDATE).

#### `PATCH /:id/items/:lineId`
- ✓ Method · ✓ Input validation (`ItemPatchSchema`, requires qty or installed) ·
  ✓ Authorization (JWT org; null→404, false→404) · ✓ Status (200/400/404) · ✓ Shape
  (`QuoteLine`) · ✓ Info disclosure · ✓ Observability · ✓ Idempotency (set to same value
  is a no-op write) · ✓ Performance (single scoped UPDATE).

#### `PATCH /:id/items/:itemId/details`
- ✓ Method · ✓ Input validation (`LineDetailsSchema`) · ✓ Authorization (PROJECT
  ownership; null→404, false→400) · ✓ Status (200/400/404) · ✓ Shape (`QuoteLine`) ·
  ✓ Info disclosure · ✓ Observability · ✓ Idempotency · ✓ Performance (one txn — Rule 1:
  definitional → project_items, details → overlay upsert).

#### `PUT /:id/items/:itemId/quote-description`
- ✓ Method (PUT, full replace of the one field) · ✓ Input validation
  (`QuoteDescriptionSchema`) · ✓ Authorization (PROJECT ownership; null→404) ·
  ✓ Status (200/400/404) · ✓ Shape (`QuoteLine`) · ✓ Info disclosure · ✓ Observability ·
  ✓ Idempotency · ✓ Performance (one txn, overlay upsert).

Shelved buildup stubs (`GET/POST /:id/items/:lineId/components`, `/parse-intent`,
`/question`, `/recommend`, `/my-components`) do no work — safe empties so client calls
don't 404. Not walked (no behaviour).

## Concerns not in spec

### `project_items.installed` is NOT NULL (default false) — lost the tri-state "assume installed"
**Where:** `project-line.service.js` addItem/addCustomItem/updateItem; `project_items` DDL 0020.
**What:** The locked DDL makes `installed boolean not null default false`. Old dev
`project_items.installed` was nullable, and `lineTotalSql` reads `NOT COALESCE(installed,
true)` so NULL meant "assume installed." On the rebuild a freshly-added line is
`installed = false`, so install cost is NOT added until the user toggles it on — i.e.
install is now **opt-in**, not assumed-on. A client PATCH of `installed: null` ("reset to
default") is coerced to `false` (the schema default). The `QuoteLine.installed` field is
therefore never null in practice.
**Suggested fix:** confirm the intended behaviour. If "assume installed" should survive,
make `project_items.installed` nullable (additive) and clone NULL at add. Otherwise this
is correct per the locked schema — just a behavioural note for QC.
**Severity:** LOW (the ballpark total is correct either way; only the install default differs).

### No unique index guards a concurrent double-add
**Where:** `project-line.service.js` addItem.
**What:** The idempotency check (SELECT … FOR UPDATE on `(project_id, item_id)`) cannot
lock a not-yet-existing row, and 0020 defines no unique index on `(project_id, item_id)`
(old dev had `uq_project_items_canonical`). Two simultaneous adds of the same item could
create two clones. The client is optimistic-guarded (quoteIds Set), so this is only a
racing-request edge.
**Suggested fix:** add a partial unique index `(project_id, item_id) WHERE item_id IS NOT
NULL AND deleted_at IS NULL` in a follow-up rebuild migration if desired.
**Severity:** LOW.

### Soft-removed line leaves its overlay row behind
**Where:** removeItem (soft-delete) + the resolved join.
**What:** A soft-deleted `project_items` row keeps any self-quote overlay row (not
soft-deleted). The resolved join filters `pi0.deleted_at IS NULL`, so the line correctly
disappears; on revive, the overlay re-attaches (its details/quote_description come back).
Acceptable at S2, but worth noting for the S3 cleanup pass.
**Severity:** LOW.

### `status` is hardcoded `to_send` at S2
**Where:** toQuoteLine.
**What:** Every line reads `status: 'to_send'` — the real send-state (out_for_quote /
quoted / booked / declined) is DERIVED from engagement + `message_events` in S3, which
don't exist yet. Deliberate; noted so S3 wires it in rather than reading the self-quote's
default `pending` status (which would wrongly flip a line to out_for_quote).
**Severity:** LOW (expected S2 state).

### `created_by`/`updated_by` audit-user columns left null
**Where:** all inserts.
**What:** The rebuild tables carry audit-user columns but no audit-stamp trigger is
attached (unlike dev). Consistent with the S1 service (which also leaves them null). The
GUCs are set (withTransaction), so a future trigger would attribute correctly without a
service change.
**Severity:** LOW.

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in)
