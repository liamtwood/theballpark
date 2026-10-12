# Items slice — end-of-arc audit (2026-10-12)

Branch `rebuild/org-slice`, commits `fe692b84 → HEAD` (migration `0015` + the service/
routes/extractor/client alignment to the rebuilt `items`/`tags`/`item_tags`). Two
independent read-only audits, split by lane:
- **Spec/data-model** — `bp-v2.65- designer` (vs DATA-MODEL-REDESIGN groups 1-7 + COLUMN-STANDARDS + item-model memory).
- **Code/architecture** — independent review agent (vs the plan + docs/ENGINEERING.md, runtime reachability, RLS).

Net: **ship-quality rebuild** — the item model conforms column-for-column. Gating issues
below before the slice is "done": two HIGH security/runtime findings from the code audit,
the unproven FR-00215 INSERT close from the spec audit, and one moderation-scope MED.

---

## Findings (consolidated, ranked)

### HIGH

**H1 — `/api/items` is a live, unvalidated second write path that bypasses moderation (code audit).**
`routes/items.js` POST/PUT/DELETE (mounted at `/api/items`, v1Gate) call `ItemService.create/update`
directly — no Zod, no `createForOrg`/`applyEdit`, no `item.create` permission — and `item.service.create()`
defaults `approval_status ?? 'approved'`. An authenticated v2 supplier can `POST /api/items {name,
category_id}` → an **approved** item in their own org (RLS permits `org_id = app_current_org()`), then
`PATCH …/active` to go live — bypassing the ballpark-admin moderation gate FR-00215 exists to enforce.
client-v2 doesn't call it, but it's a live authenticated surface = a moderation-bypass landmine.
*Fix (this slice):* retire/gate the `routes/items.js` WRITE routes (v1 remnant; v2 surface is
`/store/items` + `/admin/items`), and change `create()`'s default to `'draft'` (defense-in-depth).
Also: `PATCH /api/items/:id/images` writes the dropped `image_url` → silent no-op (same stale path).

**H2 — `/api/taxonomy/*` is mounted live but its service queries tables/columns `0015` dropped (code audit).**
`taxonomy.service.js` functions behind `routes/taxonomy.js` reference `tag` (→ `tags`), `supplier_item_tag`
(never created), `items.subcategory_id`/`pending_classification`/`image_url`/`is_active`, `categories.namespace`,
`orgs_public.city` — all gone. `match-items`, `add-match`, `request-quotes` (agent Brief/RFQ write paths)
500 against the live schema. The slice correctly short-circuited `classifyAndApply` but left its siblings wired
to the old model. *Scope:* these belong to the **projects/inbox slice** (not built in v2dev yet — "a screen is
broken only where its slice isn't in v2dev"), so arguably out-of-items-slice — BUT it's a live surface that
500s. *Decision (Liam):* disable the taxonomy router now (remove the landmine) vs track for the projects/inbox slice.

**H3 (spec audit) — the FR-00215 INSERT close is LIVE but UNPROVEN.**
`0015` `items_insert` is `org_id = app_current_org()` with no admin escape — the hole is CLOSED. But
`db/rebuild/tests/fr00215_write_close.test.js` still has assertion (e) "non-member admin INSERT = DENIED"
as a TODO, its comment wrongly says "INSERT escape intentionally OPEN this slice," and the drift-guard watches
UPDATE but not INSERT. *Fix (this slice):* implement (e), fix the stale comment, extend the drift-guard to INSERT.

### MEDIUM

**M1 — `images[]` write contract loses `is_hero`/`sort_order` (code audit).**
`0015` defines `images jsonb = [{url, sort_order, is_hero}]` and the read path (`heroFromImages`/`heroUrl`)
depends on it, but the write schema `GalleryImageSchema` + client `GalleryImage` model only carry
`url/focalX/focalY/attribution`. Every store save strips `is_hero`/`sort_order` → `hero` can only ever be
`images[0]`. Not data loss today (extractor writes hero-first, single-image typical), but a future set-hero/
reorder UI silently no-ops. *Fix:* carry `is_hero`/`sort_order` in the write schema + client model, OR make
"hero = images[0]" explicit and drop them from the DDL/read contract.

**M2 — moderation UPDATE is row-scoped, not column-scoped (both audits).**
`items_update` `WITH CHECK … OR (app_svc_moderate() AND approval_status IN (4 values))` — the `IN (...)` is a
tautology (the column CHECK already guarantees it), so under `svc_moderate` a moderation write can change ANY
column on ANY org's item. "Moderation only touches approval_status" rests on route discipline, not the DB.
*Fix (this slice):* add a test proving `svc_moderate` CANNOT change name/price cross-org. *Follow-up (Liam):*
a column-guard trigger narrowing `svc_moderate` to `approval_status` (belt-and-braces).

### LOW

- **L1 — delete vs update admin mismatch.** `items_delete` allows `app_is_admin()` (broad); `items_update` uses
  `app_svc_moderate()` (narrow). Align delete → `svc_moderate` (admin-reject-is-moderation) — agreed by designer.
- **L2 — storefront subcategory query** is per-item LATERAL + per-subcat correlated cover subquery; fine at
  10-50 subcats (3-level cap bounds it; already flagged cards-F-3). Precompute a `cover` column if a supplier >100.
- **L3 — detached extract-job error-UPDATEs run context-less** (`startPull`/`startAnalyseJob` `.catch`), so a
  genuinely failed job can sit at `running` until `failStaleJobs()` ages it out. (The analyse *runner* itself was
  fixed to run in `withAdminContext`; only the terminal error-write is context-less, same as the pull path.)
- **L4 — deep-classification edit display gap** (deferred-by-design): an item at a deep `category_id` shows a
  blank Category field + empty cascade in item-edit until the breadcrumb lands. Confirmed **no data loss** — a
  no-touch save falls back to the preserved `category_id`.
- **NIT — `tags_dim_name_uidx`** on `(coalesce(category_id,''), dimension, lower(name))`: free tags (dimension
  NULL) won't de-dup (NULL distinct in PG); moods dedupe fine. OK for now.

---

## Open rulings for Liam (build pre-decided; record + flip items LOCKING → LOCKED)

1. **`tier`** — build went **ballpark/editable** (validated at write). Matches COLUMN-STANDARDS bucket-3. Confirm.
2. **`item_unit`** — arguably `type='system'` (pricing formula branches on its 5 values) but still `ballpark`
   (from seed `0007`/`0011`, not `0015`). Fix now or track.
3. **Naming** — kept `categories` / `tags` / `item_tags` vs COLUMN-STANDARDS' `taxonomy_` prefix. Confirm keep.
4. **Doc fork** — `dev`'s DATA-MODEL-REDESIGN.md has `addresses` LOCKED (type/name/ref); this branch still shows
   it DRAFT (kind/label). Plan doc is the SSOT — reconcile.

---

## Verified correct (both audits)

- Item model conforms **column-for-column** to the locked spec (groups 1-7): one `category_id` any depth, two
  axes + CHECKs, `type` not `kind`, `ref` partial-unique, `external_url`/`_source`, variants-only, `images` jsonb
  no `image_url`, dormant lineage + self-CHECKs, `install_unit` CHECK, `item_status` SYSTEM codelist, `item_tags`
  Class-D junction, mood facet, `location_coverage` dropped, `size`→attributes.
- **Extractor INSERT satisfies the closed `items_insert` policy** — `withAdminContext` pins `current_org=target`
  + `is_admin='t'`, `createForOrg` inserts `org_id=ctx.orgId` (sacred), so `org_id = app_current_org()` holds.
- **`createForOrg` keeps org sacred** (session/`:orgId`, never body; `.strip()` drops body `org_id`); `status`
  forced `'new'`; defaultStatus draft/pending.
- **`classifyAndApply` is a clean no-op** — no half-wired writes to dropped columns/tables on item-create.
- **`is_active→status` consistent** across every aligned read/write (service, store-items `/active`, marketplace
  list/detail, admin approval sets only `approval_status`).
- **Recursive category CTEs correct + bounded** (descendant filter + ancestor rollup; 3-level cap; per-distinct-
  category, not per-item-to-root).
- **Analyse RLS fix** (`797ffa6e`) — `runAnalyseJob` in `withAdminContext` so detached writes satisfy RLS.
- **Image selection** (`isProductImage`/`looksProduct`/handle-match) — drops placeholders, prefers
  handle/`product-images` URLs, empty → coming-soon; worst case degrades to placeholder, never wrong data.
- **`item-card.component.ts`** — OnPush, signals, `firstValueFrom`, token colours. Clean v2.
- **`tags`/`item_tags` RLS** — global-read/admin-write vocab; junction rides the parent item via EXISTS; no
  `org_id`-from-body.

---

## Triage / plan

**Fix in this slice (gates):** H1 (retire `/api/items` writes + `create()` default→draft), H3 (INSERT-denied
test + comment + drift-guard), M2 (svc_moderate column-scope test), L1 (align delete→svc_moderate).
**Liam decision:** H2 (disable taxonomy router now vs defer to projects/inbox slice), M1 (carry hero/sort_order
vs explicit `images[0]`), rulings 1-4, the M2 column-guard trigger follow-up.
**Deferred-by-design (confirmed clean):** auto-classify short-circuit, tags/What's-Hot UI, cat▸subcat breadcrumb.
