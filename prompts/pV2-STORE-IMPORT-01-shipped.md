# pV2-STORE-IMPORT-01 — Phase 0 (codelists + unit-model tidy-up)

**Shipped:** 2026-09-17 (server + DB only; no client change → no chip bump).
**Owner:** CC. Chat (f4) authored the spec/mappings; Liam gave the directional go
("first step is some tidy up to prepare a phase 0"). This is the FIRST slice —
NO profiles, NO import pipeline, NO write-path fix (those are later slices).

## What landed
1. **`item_tier`** — new codelist (consumes `items.tier`): budget/standard/premium/
   luxury/aim_for_the_moon (sort 0–4), default `standard`. Distinct from
   `budget_tier` (projects.tier) — untouched.
2. **`mood`** — new codelist (relaxed/celebratory/impressive/sophisticated/intimate).
   Seeded, no UI surface yet (classifier-fed later).
3. **`item_attribute`** — new codelist, one value `size` meta `{value_type:'char'}`
   (a free-text label like "8.25 inch"; does NOT drive qty). No profile grouping
   (deferred).
4. **`item_unit` pruned to 5** — each · per_guest · platter · time · size, each with
   `meta.needs` (each/per_guest=null, platter=serves, time=time, size=size). The
   other 20 values deactivated (rows kept). Time granularity now lives only in
   `item_time_unit` (added **week** + **night**).
5. **`codelist.service.js`** — `addValue`/`patchValue` now read/write value `meta`
   (was dropped before; needed so `meta.needs` is settable + future admin curation).
6. **`items_tier_check`** dropped (public/preview/master) — the old free-text CHECK
   (basic/mid/premium) blocked the new codes; `items.tier` is now governed by the
   `item_tier` codelist.

**Applied to DB:** codelist changes applied via `seedCodelists()` and verified
(item_unit = 5 active w/ meta.needs; item_tier/mood/item_attribute present;
item_time_unit +week/night). `items_tier_check` dropped (verified: 0 schemas).

## Data migration — WRITTEN + READY, NOT YET RUN (needs Liam)
`server/src/db/migrate-store-phase0.js` re-points existing items (idempotent,
transactional, prints before/after):
- **unit:** each/event/job/box/sheet/pack/roll→each · head→per_guest · sqm→size ·
  day/week/night→time (+ `time_unit` = the original). (event = flat fee → each.)
- **tier:** mid→standard · basic→budget · premium unchanged · null left null.

Pre-checked distribution (412 items): unit each285/event45/day31/head25/sqm16/
week3/night2/job+box+sheet+pack+roll5; tier mid355/premium21/basic18/null18.

**RUN 2026-09-18** (Liam gave the direct go; auto-mode had gated it twice prior).
Results — unit: each 335 · time 36 · per_guest 25 · size 16 (stray-guard clean);
tier: standard 355 · premium 21 · budget 18 · null 18. time_unit granularity
preserved on the 36 time items (day 31 / week 3 / night 2, zero nulls); zero
tiers outside the item_tier codes. Idempotent — re-run is a no-op.

## Files touched
| File | Notes |
|---|---|
| server/src/db/codelists-seed.js | 3 new parents + values + item_unit prune block + item_time_unit week/night |
| server/src/services/codelist.service.js | addValue/patchValue read+write `meta` |
| server/src/db/migrate-schemas.js | drop items_tier_check (public/preview/master) |
| server/src/db/migrate-store-phase0.js | NEW — idempotent items unit/tier data migration |

## Acceptance
- [x] 3 new codelists seeded + verified; item_unit pruned to 5 w/ meta.needs.
- [x] codelist.service reads/writes value meta.
- [x] items_tier_check dropped (new tier codes accepted).
- [x] items data migration RUN (2026-09-18) — unit ∈ the 5, tier ∈ codes, time_unit preserved, stray-guard clean.
- [x] Idempotent seed + migration; server syntax-clean.

## Concerns not in spec
### items.unit / items.tier are not codelist-validated (future guard)
**Where:** `public.items.unit` (free-text — that's why it drifted to 12 values)
and now `items.tier` (CHECK dropped). **What:** nothing enforces that a written
unit/tier is a live codelist code. **Suggested fix:** a validation guard (trigger
or app-layer) in the write-path slice. Deferred — noted, not this slice.
### Legacy QUANTITY-01 units block in migrate-schemas — RESOLVED (was HIGH)
The QUANTITY-01 "units consolidation" block (migrate-schemas ~695–739) silently
reverted Phase 0 on every run — deactivated `platter`, re-pointed
`items.unit='platter'→'each'`, reactivated day/event/hour, and retired the
`item_time_unit` parent. It only "won" because the BE-00095 fatal aborted
migrate-schemas before `seedCodelists` (§4f) could re-fix it.
**Fixed (2026-09-18):** the block is **removed** (replaced with a removal note);
`item_unit` is now owned solely by codelists-seed.js and the items re-point by
migrate-store-phase0.js. Kept the `serves` column ALTER + Rocket Food corrections.
Data-model call from f4: `auto_fill_field` and `meta.needs` **coexist** (quote-time
default qty vs edit-form field visibility), so the seed now ALSO sets
`auto_fill_field` on the new active units (per_guest→guest_count, time→
duration_days; each/size/platter null) — the re-point head→per_guest / day→time
would otherwise break `defaultQuantity()`. And the seed reactivates the
`item_time_unit` parent (Phase 0 needs it for day/week/night). f4 logged a BE for
the block removal; it's now done.

### migrate-schemas full run still fatals (BE-00095)
The codelist seed + constraint drop were applied via `seedCodelists()` directly and
the early migrate-schemas block; a full forward run still aborts on
`message_item_id` (~line 2139). Unrelated; place new DDL early + verify.

## Iteration — BE-00099: secure the taxonomy routes (2026-09-18)
**Triggered by:** the classifier audit (before wiring auto-classify) — `/api/taxonomy/*`
was mounted **outside** the authenticated v2 group (index.js:204), so all 16
endpoints were unauthenticated + un-org-scoped: an open AI-cost endpoint
(`/classify`) and cross-org IDOR item rewrites (`/apply-classification`,
`/dismiss-classification`, `/item-tags`). Liam greenlit **option A** (secure now;
v1's undeployed item-drawer classifier on :4200 breaks — v1 sends no JWT).

**What changed**
- **`index.js`** — moved `taxonomy` from the ungated `app.use('/api/taxonomy', …)`
  into the v2 group (`v2.use('/taxonomy', …)`), so it inherits `authenticate` +
  `requireActiveMembership()`. Path unchanged (`/api/taxonomy`).
- **`routes/taxonomy.js`** — the 5 **item-by-id** endpoints (`classify`,
  `apply-classification`, `dismiss-classification`, `item-tags`,
  `suggest-subcategory`) now require `item.create` **and** call
  `assertItemInOrg(itemId, req.user.org_id)` (404 on a foreign item — no
  existence leak). `backfill` (bulk reclassify) is `admin.cross_org_view`-gated.
- Engine (`taxonomy.service`) untouched — the audit found its logic sound.

**Deferred (noted):** the project-match endpoints (`add-match`, `remove-match`,
`request-quotes`, `materialize-proposed`, `match-items`, `search-hint`,
`quote-requests`) now require auth (from the group) but not yet deeper
**project-org** scoping — a follow-up; they don't rewrite items, so not the
BE-00099 core.

### API audit checklist (ENGINEERING Rule 10) — taxonomy item endpoints
`POST /classify · /apply-classification · /dismiss-classification · /item-tags · /suggest-subcategory`
- ✓ HTTP method (POST, mutating/AI) · ✓ Input validation (itemId required; service validates cat/subcat/tag scope)
- ✓ **Authorization** — `authenticate` + `requireActiveMembership('item.create')` + `assertItemInOrg` (org from JWT, never body)
- ✓ Status codes (400 no itemId · 401 unauth · 403 perm · 404 foreign/missing item · 502 AI parse)
- ✓ Info disclosure (404 not 403 on a foreign item) · ✓ Observability (`[taxonomy.classify]` log)
- N/A Idempotency (classify re-runnable; apply is a deliberate rewrite) · ✓ Performance (single AI call; taxonomy payload noted)
`POST /backfill` — ✓ admin-gated (`admin.cross_org_view`).

## Iteration — auto-classify on create (step 2, 2026-09-18)
**Greenlit by Liam** after BE-00099 landed. Lazy, implicit, no UI.

- **`taxonomy.service.classifyAndApply(itemId)`** — new helper: `classifyItem` →
  `applyClassification` with the suggestion (category_id + subcategory_id +
  tag_ids). Derives **subcat + tags only** (classifier doesn't set tier — stays
  the item's default `standard`).
- **`routes/store-items.js` POST /** — after `ItemService.create`, calls
  `TaxonomyService.classifyAndApply(item.id)` **fire-and-forget + error-swallowed**
  (`.catch` logs `[auto-classify]`), so a classifier hiccup (missing
  `ANTHROPIC_API_KEY` / AI error / unparseable) never breaks or delays item
  create. Runs **once, on create only** (not on PUT/update). Called internally
  from the already-authenticated, org-scoped handler — not via the (now-secured)
  route. **Nothing surfaced in the UI** — the subcat/tags just populate silently.

**Notes / future:** classify runs at create even for a draft with a sparse
description (classifier tolerates missing description); if we want richer input
we could move the trigger to first-submit later. One Haiku call per create (cost
accepted). No chip bump (server-only).

## QC notes
(Liam)

## Chat audit
(chat)
