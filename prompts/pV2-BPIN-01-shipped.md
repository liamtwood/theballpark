# pV2-BPIN-01 — BPIN item URLs + supplier name handles + BPIN in the UI

**Shipped:** 2026-11-21 (rebuild/org-slice) — targets preview after next promote
**Commit:** `<sha on push>` (client + server + 2 rebuild migrations)
**Depends on:** EP-00021 (no raw DB PKs in URLs — `[[project_no_raw_ids_in_urls]]`), ADR-0002 (BPIN identity)

## What shipped
Human-readable identifiers at the URL boundary + BPIN surfaced in the UI, per EP-00021:
- **Item URLs** carry the **BPIN** (`/store/items/BP…`) instead of the UUID.
- **Supplier URLs** carry a **name handle** (`/suppliers/anomis-flowers`) instead of the UUID.
- **BPIN shown in the UI:** a quiet "Ballpark ID · BP…" line under the quick-view details drill; a
  read-only **Ballpark ID (BPIN)** field in item-edit, on one row with Lead Time (BPIN first),
  rendered in the standard field style (hairline border + field rounding, no fill).
- **Admin `/admin/*` routes stay UUID-keyed** (Liam's call) — only the public-facing supplier page
  and item routes use the human id.

## Server
- **`0066_orgs_handle.sql`** (new) — `orgs.handle` + `slugify_org_name()` / `gen_org_handle()` +
  a `BEFORE INSERT` trigger that fills it when null, a dedup backfill (row_number), a unique partial
  index, and `supplier_directory` recreated with the trailing `handle` column.
- **`0067_gen_bpin_security_definer.sql`** (new) — `gen_bpin()` was `SECURITY INVOKER`, so an app-side
  INSERT (request-pinned `web_app_user`) ran `nextval('items_bpin_seq')` as a role with no sequence
  USAGE → **"permission denied for sequence items_bpin_seq"** on every app item create/edit. Now
  `SECURITY DEFINER SET search_path = public, pg_temp`, so it runs as the sequence owner. **Applied to
  dev2; still owed on preview** (fold into the next promote).
- **`marketplace-query.schema.js`** — `supplier` relaxed from `z.uuid()` to a bounded string
  (UUID *or* handle). **This was the My Shop re-entry regression:** the handle URL 400'd at Zod
  *before* the handler's resolution code ran (same shape as BE-00150). Every value still reaches SQL
  bound; the handler maps a handle → org id (unknown → no-match sentinel).
- **`marketplace.js`** — `/items` resolves a non-UUID `supplier` via `supplier_directory`; list SELECT +
  projection add `i.bpin`; the public item route resolves `(i.id::text=$1 OR i.bpin=$1)`.
- **`marketplace-suppliers.js`** — `/suppliers/:id` + `/subcategories` accept handle OR UUID
  (`id::text=$1 OR handle=$1`); responses include `handle`.
- **`item.service.js`** — `getById` resolves `(i.id::text=$1 OR i.bpin=$1)`; downstream tag/component
  queries use the resolved UUID.
- **`auth.service.js`** — session payload adds `activeOrgHandle` (both org + null-org branches).

## Client
- **URL wiring** — item links (`item-edit-link`, `item-preview`, `item-card`, quick-view) emit
  `item.bpin ?? item.id`; supplier links (`supplier-grid`, `store-redirect`) emit `handle ?? id`.
- **`isOwnerStore` / `isOwner`** — match the viewer's org by UUID **or** handle (the URL param is now
  either). A missed second copy of this compare in `marketplace-store` was the first grid-blank symptom.
- **Canonical URL rewrite** (`supplier-detail`) — on load, a raw-UUID supplier URL `replaceUrl`s to
  `/suppliers/<handle>` once detail resolves, so admin links / bookmarks / every entry point settle on
  one clean URL. UUID still resolves (back-compat); guard short-circuits after the rewrite (no loop).
- **BPIN UI** — `item-attribute-cards` adds a `bpin` input (quiet caption line); `item-edit` renders a
  `readonlyAlways` `app-edit-field`; `edit-field` gains a `--readonly` modifier (border + rounding,
  no fill).
- Types threaded: `CatalogueItem.bpin`, `CatalogueSupplier.handle`, `SupplierDetail.handle`,
  `StoreItem.bpin`, `SessionUser.activeOrgHandle`.

## Verification (dev2)
- Item create/edit via the app no longer hits the sequence-permission error (`gen_bpin` definer).
- Anomis My Shop: 5 drafts render; `[items-trace]` confirmed `reqOrg === supplierId`, `ownerScope=true`,
  `rows=5`. The disappear-on-re-entry repro (My Shop → Home → My Shop) is fixed — the handle URL now
  passes validation (previously `GET /items?supplier=anomis-flowers → 400`).
- `admin → org → Anomis → My Shop` rewrites the UUID URL to `/suppliers/anomis-flowers` (Liam QC'd).
- BPIN edit-field + quick-view line QC'd by Liam.
- All temporary diagnostics (`[items-trace]`, `[myshop-dbg]`) removed before commit.

## Owed / follow-ups
- Apply `0067` to **preview** (next promote).
- Peripheral supplier redirects (item-edit post-save, profile-shopfront, orgs-admin) still emit UUIDs;
  functional via server resolution + the canonical rewrite, so cosmetic only — optional cleanup.
- Unrelated: dev2 `relation "favourites" does not exist` (missing table on dev2) — left out of this ship.
