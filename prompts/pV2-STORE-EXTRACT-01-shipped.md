# pV2-STORE-EXTRACT-01 — Website catalogue extract (Analyse → Pull) — SHIPPED

**Build:** v2.519 (dev) · **Date:** 2026-09-21 · **Owner:** CC (ballpark-f2)
**Spec:** [pV2-STORE-EXTRACT-01-prompt.md](pV2-STORE-EXTRACT-01-prompt.md) · design [[project_catalogue_extract_design]]

Admin points at a supplier's web page → AI **analyses** what's there → on the admin's
go, **pulls** the catalogue in as **pending** items on that supplier org. Two guided-Haiku
steps, mostly assembly over existing infra. Deliberately minimal — the real extract data
tells us what to build next.

## What shipped
**Server**
- `services/ai.service.js` — extracted a shared `callHaikuJson({system,user,maxTokens})` helper
  (Haiku + maxRetries:8 + JSON-out/fence-fallback + 503 overload mapping); **refactored the
  inbox `parseBrief` onto it** (no behaviour change) so there's one AI-call definition. Added
  two guided prompts + functions: `analyseCatalogue` (guided-but-honest report) and
  `extractProduct` (one product → item shape).
- `services/org-import.service.js` — generalised the SSRF-safe, IP-pinned guarded fetch into an
  exported `guardedFetch(url)` (any page, redirects re-vetted per hop); `extractOrg` now uses it
  (no fetch-stack duplication).
- `services/catalogue-extract.service.js` (NEW) — orchestrates: `guardedFetch` → `htmlToText`
  (+ on-page hrefs for listing detection) → AI → `ItemService.createForOrg` (**pending**).
  Maps to **real item columns** where homes exist (base_price, unit, description,
  install_description, install_cost, lead_time_days, category_id); dimensions + other key:values
  → `attributes` bag; volume tiers → `attributes.price_tiers`; single-group options →
  `kind='option'` child items (0/upcharge, hidden from browse). Source identity: primary URL →
  the dedicated **`external_url`** column; sku/product_id/supplier_ref/extracted_at/batch → an
  internal **`attributes._source`** block (`_`-prefixed → view/editor skip it). **Dedup** on
  `external_url` or `_source.sku` → a re-run adds only new products.
- `services/taxonomy.service.js` — brief-matcher no longer falls back to `external_url` for an
  image (it's a product-page URL now, never an image).
- `routes/admin-orgs.js` — `POST /:orgId/extract/analyse` (read-only) + `POST /:orgId/extract/pull`
  ({urls[]}). Platform-admin gated (inherits the `/api/admin` gate); org from the URL, never the body.
- **No schema change** — everything fits existing columns.

**Client (client-v2)**
- `core/admin-org.service.ts` — `extractAnalyse` / `extractPull` + `ExtractReport` / `PullResult` types.
- `pages/suppliers/website-import-panel.component.ts` (NEW) — "Import from website" panel: URL →
  Analyse (page shape, verdict, mapped chips, "also found", sample, product-link picker for
  listings) → Pull → per-URL result summary. Curation stays in the existing item editor.
- `pages/suppliers/supplier-detail.component.ts` — mounts the panel on the **Shop tab, admin-only**.

## QC (preview, platform admin)
1. Admin → a supplier → **Shop** tab → **Import from website**.
2. Paste a **Yahire** product URL → **Analyse** → report (detail page, verdict, price/tiers/options/SKU
   chips, "also found", sample). Paste a Yahire **category** URL → listing + product-link picker.
3. Paste **Rocket Food** (caterer homepage) → verdict "no catalogue — onboard manually" (no junk).
4. **Pull** → items created **pending** on the supplier → review in **Approvals**. Check: attributes/
   dimensions in the bag, tiers in `attributes.price_tiers`, single-group options as hidden children,
   `external_url` = the product page.
5. **Re-run** the same URL(s) → skipped (dedup), only new products added.

Requires `ANTHROPIC_API_KEY` on the server env (already set on preview). Runs on preview first.

## NOT in v1 (analyse NAMES these; prioritise from real data)
Promote-attribute-to-codelist, description-vs-attribute routing UI, multi-group priced variant
matrices, venues, packages, scheduled/auto refresh, a hard-dedup indexed `source_ref` column.

## QC iterations
_(append below)_
