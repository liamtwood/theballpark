# pV2-CODELISTS-01 — Reference codelists: RC/RCV split, seeds, gated API, admin UI

**Shipped:** 2026-06-12, chips `[Dev v2] v2.18a` (server) + `v2.18b` (client)
**Commits:** `3f00144` (RC/RCV migration + seeds + gated v2 API + no-DELETE three-layer), `00c727e` (CodelistService + status-pill + /settings/codelists admin UI)

## What landed

- **DB (applied live + idempotency re-verified)**: `shared.codelists` renamed to `shared.reference_codelist_values` (to_regclass-guarded; +`is_default`/`description`/`updated_at`, one-default partial unique index); new parent `shared.reference_codelists` (type system|ballpark CHECK, default_code, application, consumer pointers, audit cols). Seeded the locked 12 + 249 ISO 3166-1 countries (Intl.DisplayNames); 4 v1-era lists backfilled as 'v1-inherited — undocumented'; `message_status` matches the CODELISTS.md worked example verbatim. Seed-time default-invariant assertion throws on drift.
- **Server**: service split v1 reads / v2 RC-aware fns; consumer-pointer whitelist extracted to PURE `codelist.consumers.js` (Rule 8 — specs run without opening pool connections; the inline version made `node --test` hang on live connections). v1 `/api/codelists` write verbs **retired** (were ungated — RP-03 class; accepted breakage: v1 ballpark-settings codelist editor). New gated v2 router; **DELETE → 405 always** with the full rationale (layer 1 of 3; trigger + seed assertion are 2 and 3).
- **Routing fix found during build**: v1's ungated `GET /api/codelists/:listName` is mounted BEFORE the v2 router, so a v2 `GET /:list` was shadowed and dead. The v2 consumer read moved to `GET /:list/values` (mirrors the POST path); documented in route header + prompt + ARCHITECTURE.md.
- **Client**: `core/codelists` (contracts, `metaColor` pure fn — token refs wrap in `var()`, v1 hex passes through; session-cached `CodelistService`, invalidate-on-write); `shared/status-pill` (meta-driven label/icon/colors, neutral fallback); `/settings/codelists` (ballparkAdminGuard) master/detail — rail grouped by application with type badge + active/total counts; ballpark lists edit-in-place + Add row, system lists read-only (locked rule 1), deactivation surfaces the in-use gate count, no delete anywhere. Codelists tile on BALLPARK_TILES.
- **Docs**: CODELISTS.md updated to the approved `reference_` names + "prefix is deliberate" note + version-history bump; ARCHITECTURE.md §7 codelists section; prompt amended in place (chat-approved naming arrived post-draft, pre-implementation).

## Files touched

| File | Lines (Δ) | SHA | Notes |
|---|---|---|---|
| server/src/db/migrate-schemas.js | +50 / -114 | 3f00144 | rename DO-block, legacy INSERTs retargeted, §4f seed call |
| server/src/db/codelists-seed.js | +413 (new) | 3f00144 | parents, net-new values, countries, backfills, assertion, trigger |
| server/src/services/codelist.service.js | +189 / -1 | 3f00144 | v1 reads + v2 RC-aware + inUseCount w/ deleted_at detection |
| server/src/services/codelist.consumers.js | +27 (new) | 3f00144 | PURE whitelist (Rule 8, pool-free specs) |
| server/src/routes/codelists.js | +18 / -13 | 3f00144 | v1 write verbs retired; reads kept for :4200 |
| server/src/routes/codelists-v2.js | +130 (new) | 3f00144 | gated router; DELETE regex catch-all → 405 |
| server/src/schemas/codelist-value.schema.js(.test) | +43/+45 (new) | 3f00144 | Zod create/patch/params + 5 specs |
| server/src/index.js | +3 | 3f00144 | v2 mount |
| docs/CODELISTS.md, docs/ARCHITECTURE.md, prompt | ~+70 | 3f00144 | naming, prefix note, §7 section |
| client-v2/.../core/codelists/* (3 files) | +160 (new) | 00c727e | types + metaColor (+3 specs), service |
| client-v2/.../shared/status-pill/status-pill.component.ts | +55 (new) | 00c727e | meta-driven pill |
| client-v2/.../pages/settings/codelists/codelists-settings.component.ts | +248 (new) | 00c727e | master/detail curation |
| client-v2/src/app/app.routes.ts, app.config.ts, launcher-tiles.ts, styles.css | +45 | 00c727e | route, icons, tile, .bp-pill/.bp-type-badge |

## Acceptance — 8 / 8 verified

- v1 dropdowns unaffected — ✓ `GET /api/codelists/item_unit` 200 (19), `currency` 200 (7), `message_status` 200 raw-row shape after rename
- Migration idempotent — ✓ second full run clean ("default invariant asserted"), old table gone, 16 parents / 249 countries
- `message_status` = worked example — ✓ live API returns draft (default, pencil-line, muted) / sent (info) / read (success) / deleted (danger, terminal)
- Gated v2 surface — ✓ live matrix: unauth 401; member read 200 / write 403; admin POST 201 (SGD); system POST 403 with locked-rule-1 message; default deactivate 409; DELETE 405; `/:list/values` consumer shape camelCase + meta
- Admin UI — ✓ preview: 16 lists grouped CATALOGUE/CORE/MESSAGING/ORG/PROJECT with counts + type badges; system list 0 edit inputs/no Add; ballpark currency 24 edit inputs + Add row; all four message_status pills render token colors + icons
- No DELETE anywhere — ✓ API 405 (regex catch-all), trigger DO-block, seed assertion, UI has no delete affordance
- Green run — ✓ client build (4.5s, pre-existing initial-budget warning only) + 67/67 tests + lint + style-guard; server 47/47
- Backlog flipped to Shipped — ✓

## API audit checklist (Rule 10)

#### `GET /api/codelists` (v2, parents+counts)
- ✓ Method semantics / ✓ Auth (authenticate + requireActiveMembership) / N/A input / ✓ 200 only / ✓ camelCase shape / ✓ no info disclosure (counts only) / ✓ errors → next(err) / ✓ Idempotent / ✓ one GROUP-BY query

#### `GET /api/codelists/:list/values` (v2 consumer read)
- ✓ Method / ✓ Auth (member) / ✓ ListNameSchema 400 on bad name / ✓ 200/400 / ✓ shape incl. meta / ✓ Observability / ✓ Idempotent / ✓ single indexed query. NOTE: deliberately NOT bare `/:list` — v1 owns that path until retirement (mount-order shadow).

#### `GET /api/codelists/:list/all` + `GET /:list/values/:code/usage` (admin)
- ✓ Method / ✓ Auth (`admin.cross_org_view`) / ✓ ListName+Code schemas / ✓ 200/400 / ✓ usage count NEVER interpolates request input — identifiers from the PARENT ROW, double-checked against the pure whitelist (Rule 8, tested with poisoned rows) / ✓ warn+null on missing consumer table (gate is advisory)

#### `POST /api/codelists/:list/values`
- ✓ POST=create / ✓ admin gate / ✓ Zod (code regex ≤50, label ≤100, strips unknowns) / ✓ 201/400/403-system/404/409-conflict / ✓ created row returned / ✓ 23505 → 409 not 500 / ✓ rate limit inherited from API chain / ✓ sort_order auto-next

#### `PATCH /api/codelists/:list/values/:code`
- ✓ PATCH=partial / ✓ admin gate / ✓ Zod non-empty refine / ✓ 200/400/404/409-default / ✓ fresh row / ✓ no identifier interpolation (column map is hardcoded) / ✓ updated_at bumped

#### `DELETE` (any path under /api/codelists, v2)
- ✓ 405 with the no-DELETE rationale (Express 4: regex catch-all — `'/{*splat}'` is v5 syntax and 404'd in testing)

#### v1 `/api/codelists` (modified: writes removed)
- ✓ Reads only, unchanged shape; retirement documented in route header

## Concerns not in spec

### v1 GET shadows the v2 namespace
**Where:** server/src/index.js mounts (v1 line ~208, v2 line ~271)
**What:** While v1 lives, `/api/codelists/:list` (single segment) is v1's ungated raw-row read. Any future v2 single-segment route under /codelists will silently dead-end. Same hazard exists for every other shared namespace if a v2 router reuses a v1 mount path.
**Suggested fix:** none now (documented in three places); the v1-retirement prompt (pV2-11 era) should delete the v1 router and move the consumer read back to `/:list`.
**Severity:** LOW (documented), MEDIUM if forgotten at retirement.

### Save-on-change PATCH volume from p-inputnumber
**Where:** codelists-settings.component.ts sort field (same pattern as categories-settings)
**What:** p-inputnumber emits ngModelChange per keystroke, so editing "10" can fire two PATCHes. Inherited from the categories page pattern; harmless (last-write-wins, optimistic UI) but chatty.
**Suggested fix:** debounce in edit-field for type=number — one shared fix benefits both pages. Deferred — needs a design decision on commit semantics.
**Severity:** LOW

### Usage gate is advisory, not blocking
**Where:** codelists-settings toggleActive + service inUseCount
**What:** Per spec the in-use count informs ("N records currently use…") but deactivation proceeds. If Liam expected a hard block on in-use values, this needs a confirm step.
**Severity:** LOW (matches CODELISTS.md semantics — display continues for historical rows)

### Initial-bundle budget warning (pre-existing)
**Where:** client build — 580 kB vs 500 kB budget
**What:** Pre-dates this ship (PrimeNG initial chunk); the 6 new Lucide icons add ~2 kB. Logged so it isn't mistaken for codelists fallout.
**Severity:** LOW

## Iteration — v2.18c (2026-06-12)
**Triggered by:** end-of-module architect audit — report saved to `docs/audits/2026-06-12-codelists-arc-architect-audit.md`
**Commit:** see chip v2.18c
**Triage (7 findings):**
- **F-1 HIGH — accepted.** inUseCount now validates split identifiers against `^[a-z_][a-z0-9_]*$` (fails closed to null), + a new spec asserts every CONSUMER_WHITELIST entry is identifier-shaped. Server tests 48/48.
- **F-2 MEDIUM — accepted** (option 2). 409 message no longer suggests "pick a different default" (no such affordance exists); now states defaults can't be deactivated and changing one requires a data change. Verified live.
- **F-3 LOW — accepted as comment.** Status-pill now documents the per-instance-resource / service-level fetch dedup so it isn't misread as N+1.
- **F-4 LOW — rejected.** Refetching valuesAll after every save doubles request volume on a save-on-change surface for an edge case (cross-tab staleness) the cache invalidation already handles for OTHER consumers; the server's returned fresh row is authoritative for THIS surface. Same pattern as categories-settings.
- **F-5 LOW — accepted.** Gate note now reads "Advisory: N records… The value was hidden." — mode explicit.
- **F-6 LOW — rejected.** The seed assertion already halts loudly with the offending list named, and the migration is idempotent — a pre-check is the same outcome with more code.
- **F-7 LOW — noted, no change.** 248/250 lines; extract `CodelistValueRowComponent` when the page is next touched.

## Iteration — v2.18d (2026-06-12)
**Triggered by QC:** dropdown panel opened under/behind the table ("bring to front")
**Commit:** chip v2.18d
**Root cause (verified in preview before fixing):** the p-select panel renders INLINE inside the values table's `overflow-hidden` rounded wrapper — it's *clipped*, not z-fought. Chat's preset-level z-index lean couldn't fix this (overflow clipping ignores z-index entirely; and rows with `opacity-60` create stacking contexts no z-index escapes). The other option from the pV2-04c thread is the one that works: `appendTo="body"`.
**Fix:** one place — `appendTo="body"` on the p-select inside the shared `<app-edit-field>` primitive, so EVERY dropdown in the app (profile, pages, categories, codelists) escapes clipping. PrimeNG 21's `appendOverlay()` portals the panel to `document.body`, absolute-positions it against the trigger (min-width pinned to trigger width) and assigns a managed z-index. Verified: `$appendTo()` resolves to `'body'` on the live component; the open animation can't run in a hidden preview tab (rAF-throttled — known environment limit), so the visual click-check is Liam's hard-refresh.
**Also:** RP-09 logged in AUDIT_LEDGER.md (v1-era hex meta colors — transition state, closes with the CODELISTS-02 sweep + a 0-rows SQL check).
**This closes the pV2-04c floating-overlay thread** for every edit-field consumer.

## QC notes
(Liam, 2026-06-12, relayed via CC) Tested: added a test currency, set it not visible — everything worked. Grouping etc. look good. One issue: the dropdown opened under the table (bring to front) — same root cause as the pV2-04c floating p-select overlay thread. → fixed in v2.18d above. Some styling still wanted but accepted.

## Chat audit
(chat, 2026-06-12, relayed via CC) **Audit pass complete.** Verified: architecture conformance (RC/RCV split, status-pill signal-driven + resource-cached + sanctioned dynamic-style case, CodelistService cache discipline matches CatalogueService, v2 routes gate + Zod + catch-all DELETE 405); three-layer no-DELETE confirmed in code; audit-finding fixes F-1/F-2/F-3/F-7 verified in code; seed inventory matches locked spec (12 parents, message_status verbatim, 249 Intl-resolved countries, defaults correct); standards conformance (standalone/OnPush/inject/host, role classes, no raw colors, TYPE-01 holding). Two non-blocking notes: (1) v1-inherited hex meta colors are a deliberate transition state — **track as RP-09** → logged, closes with CODELISTS-02; (2) verify `.bp-type-badge` is defined in styles.css not component-local → confirmed: defined in styles.css §codelists (RP-05 guard would fail the build otherwise).
