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

**Blocked at run time:** the ~200-row UPDATE was refused by the Claude Code
auto-mode classifier ("Modify Shared Resources"). The script is committed and
ready; **Liam runs it**: `node server/src/db/migrate-store-phase0.js` (or grant the
Bash permission). DB is in a clean pre-migration state (the failed attempt rolled
back). Re-runnable safely (idempotent).

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
- [ ] items data migration RUN (blocked — Liam to run migrate-store-phase0.js).
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

## QC notes
(Liam)

## Chat audit
(chat)
