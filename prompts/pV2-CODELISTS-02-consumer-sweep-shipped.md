# pV2-CODELISTS-02 — Consumer sweep: surfaces onto the codelist machinery

**Shipped:** 2026-06-12, chips `[Dev v2] v2.19a` (server) + `v2.19b` (v2 client) + `[Dev] v1.70b` (v1 compatibility)
**Commits:** `7aa7986` (server: orgs country/currency surface + RP-09 hex→token), `415fbf2` (v2 client: profile/pages/F-7), `72020d8` (v1: resolveMetaColor + tokens)

## What landed

- **Profile consumes codelists**: Country select (codelist `country`, 249 ISO-2 entries, type-ahead filter — new `filter` input on edit-field) in Company Information; Currency select (codelist `currency`) in Financial defaults. Persisted on `orgs.country` + NEW `orgs.default_currency` (VARCHAR(3) DEFAULT 'GBP', ×3 schemas) through /api/organisation GET/PUT with ISO-2/ISO-4217 Zod shape checks. `currency` parent gained the consumer pointer `orgs.default_currency` (+ whitelist entry) so the deactivation gate counts org defaults.
- **`/settings/pages` consumes codelists**: title-mode + hero-align dropdowns read `page_title_mode` / `hero_align` — the option space is now data (RP-04's flagship smell gone).
- **RP-09 CLOSED**: the 13 v1-era hex meta colors (project_status ×4, category_status ×9) migrated to `--color-state-*` token refs — idempotent `HEX_TO_TOKEN` sweep in codelists-seed (+ token-native seed INSERTs for fresh installs + a loud warn if any hex survives). The 10-token state-hue set is defined in BOTH apps' styles.css **at the original v1 hex values — zero visual change anywhere**; each app owns its hues from here. Acceptance verified live: `meta->>'color' LIKE '#%'` → 0 rows.
- **v1 kept whole (v1.70b)**: v1 consumed `meta.color` RAW at 4 sites (dashboard, projects-list, project-event-form, category-context-panel) and would have rendered invalid CSS. New `resolveMetaColor()` (wraps `--x` refs in `var()`, passes legacy hex) applied at all 4; tokens added to v1 styles.css. v1 build green; :4200 resolves the tokens live.
- **F-7 CLOSED**: `<app-codelist-value-row>` extracted — codelists-settings 248 → 198 lines (+63-line row). Row emits `save`/`toggleActive`; parent keeps data, saves, and the gate.
- **UX**: 409 add copy now confident — "Couldn't add — a value with this code already exists in this list."
- **Docs**: CODELISTS.md audit section rewritten post-sweep + version row + 2 deferred rows resolved; AUDIT_LEDGER RP-04 row added-and-closed, RP-09 closed.

## Files touched

| File | Lines (Δ) | SHA | Notes |
|---|---|---|---|
| server/src/db/migrate-schemas.js | +12 / -6 | 7aa7986 | orgs.default_currency ×3; seed INSERTs token-native |
| server/src/db/codelists-seed.js | +44 | 7aa7986 | HEX_TO_TOKEN sweep + survivor warn + currency consumer pointer |
| server/src/routes/organisation.js + schemas/organisation.schema.js | +12 | 7aa7986 | country/defaultCurrency through GET/PUT + Zod |
| server/src/services/codelist.consumers.js | +1 | 7aa7986 | orgs.default_currency whitelisted |
| client-v2/.../profile.component.ts | +32 / -3 | 415fbf2 | country + currency selects, codelist resources |
| client-v2/.../pages-settings.component.ts | +20 / -12 | 415fbf2 | codelist-fed titleModes/aligns |
| client-v2/.../codelists/codelist-value-row.component.ts | +63 (new) | 415fbf2 | F-7 extraction |
| client-v2/.../codelists-settings.component.ts | -50 | 415fbf2 | consumes the row; 409 copy |
| client-v2/.../edit-field.component.ts | +5 | 415fbf2 | filter input → p-select type-ahead |
| client-v2/src/app/core/organisation.service.ts | +6 | 415fbf2 | country/defaultCurrency on OrgProfile |
| client-v2/src/styles.css | +16 | 415fbf2 | --color-state-* set (original v1 hues) |
| client-angular: codelist.service.ts + 4 components + styles.css | +34 / -9 | 72020d8 | resolveMetaColor + tokens + chip v1.70b |

## Acceptance

- RP-04 grep — ✓ every remaining literal `EditFieldOption[]` is a boolean visibility mapping (categories/codelists — correct per CODELISTS.md "booleans stay booleans") or data-derived (marketplace suppliers/price). The literal interpretation ("zero grep matches") is impossible — the interface definition itself matches; the honest closure is "zero codelist-namespace arrays", which holds.
- RP-09 SQL check — ✓ 0 rows live (`meta->>'color' LIKE '#%'`).
- Profile country/currency — ✓ live: 249/7 options in the selects, GB/GBP round-trip through PUT verified via API + preview.
- Pages dropdowns codelist-fed — ✓ preview: titleModes/aligns arrive from the API with the same labels as before.
- F-7 — ✓ 198 + 63 lines, both under warning.
- v1 unaffected visually — ✓ tokens carry the original hex; v1 build green; :4200 resolves `--color-state-amber` → #F59E0B live. (Visual spot-check of a v1 project pill = Liam QC.)
- Green run — ✓ v2 build/lint/guard + 67/67; server 48/48; v1 build clean.

## API audit checklist (Rule 10)

#### `PUT /api/organisation` (modified — country/defaultCurrency added)
- ✓ Method semantics (partial update) / ✓ Auth unchanged (org.manage_billing; org identity from req.user.org_id only) / ✓ Zod: country `^[A-Z]{2}$` (or '' → null), defaultCurrency `^[A-Z]{3}$` — shape-checked here, value space owned by the codelists / ✓ 200/400/404 / ✓ fresh row returned incl. new fields / ✓ no info disclosure / ✓ single UPDATE, hardcoded column map (no identifier interpolation) / ✓ Idempotent

#### `GET /api/organisation` (modified — projection + mapping only)
- ✓ Reads the caller's own org; two new columns in the explicit SELECT; defaultCurrency defaults 'GBP' in the mapper.

(No other endpoints touched. The seed/migration changes are not request surfaces.)

## Concerns not in spec

### Codelist value-space not enforced at the org PUT
**Where:** server organisation route — country/defaultCurrency are regex-shaped but not checked against active codelist rows.
**What:** A crafted PUT could store `country='XX'` or `defaultCurrency='ZZZ'`. Display degrades gracefully (code shown raw). Cross-checking would add a per-PUT codelist read.
**Suggested fix:** acceptable for now (admin-gated surface, UI only offers codelist values); a `validateAgainstCodelist()` helper is a natural CODELISTS-03 if more codelist-backed columns land.
**Severity:** LOW

### `items.tier` filter is a codelist-shaped enum with no codelist
**Where:** marketplace-page tierOptions (basic/mid/premium) → `items.tier`.
**What:** Deliberately NOT promoted — it's a different enum from `budget_tier` (starter/professional/premium/unknown); blind promotion would have changed filter semantics. Candidate `item_tier` codelist when the /store arc touches items.
**Severity:** LOW (flagged in RP-04's closed ledger row so the grep check keeps catching it)

### v1 codelist admin write methods now dead
**Where:** client-angular codelist.service.ts create/update/delete → retired v1 /codelists/admin write verbs (404 since v2.18a).
**What:** Pre-existing accepted breakage (documented at v2.18a); noting here because this ship touched the file.
**Severity:** LOW (v1 retires at pV2-11)

### Two near-identical metaColor helpers (v1 + v2)
**Where:** v2 `core/codelists/codelist.types.ts` metaColor vs v1 `resolveMetaColor`.
**What:** Same logic, two codebases — intentional (no shared package between apps; v1 dies at pV2-11). Not extractable without cross-app tooling.
**Severity:** LOW (transitional duplication with a death date, not a shared-piece violation)

## Iteration — v2.19c (2026-06-12)
**Triggered by:** end-of-module architect audit — report saved to `docs/audits/2026-06-12-codelists-02-consumer-sweep-architect-audit.md`. Verdict: "production-ready"; RP-09/RP-04 closures and the F-7 extraction independently verified sound.
**Triage (7 findings):**
- **F-1 MEDIUM — accepted.** The RP-09 survivor check now `upper()`s to mirror the sweep's case-handling (any case of surviving hex is caught).
- **F-2 MEDIUM — accepted.** Profile `save()` now builds per-section payloads — Company Information saves no longer write possibly-stale Financial values back (and vice versa). The PUT was already partial-capable; the component now uses it that way.
- **F-3 LOW — accepted as documentation.** `defaultCurrency` is deliberately never-clearable (an org always has one) — the asymmetry with clearable `country` is now a schema comment, not an accident.
- **F-4 LOW — accepted.** RP-04 ledger grep note clarified: raw matches are expected (binary mappings, data-derived); the bar is "no match mirrors a codelist namespace".
- **F-5 LOW — rejected.** No loading gate on the two codelist selects: the session cache makes the empty window one network round-trip on first visit only, and selects populate in place. A form-wide gate for a sub-second cosmetic state isn't worth the complexity.
- **F-6 LOW — rejected (deferred).** `filterBy` stays hardcoded to 'label' until a consumer needs code-search — YAGNI; the input is a 2-line addition when needed.
- **F-7 LOW — noted.** edit-field (~213) and codelists-settings (~200) in the warning band; watch on next touch.
**Greens after fixes:** v2 build/lint/guard + 67/67; server 48/48; fin-section save round-trip verified live.

## QC notes
(Liam, 2026-06-12, relayed via CC) Pending and Approved pills render; Profile edit and the LOV (country/currency selects) behaved lovely. **QC passed.**

## Chat audit
(chat, 2026-06-12, relayed via CC) **Audit pass complete.** ✓ F-2 per-section save verified in code (org keys vs fin keys — the stale-overwrite bug structurally eliminated). ✓ F-7 extraction verified (67-line emit-only row; parent owns data; visibility binary correctly excluded from RP-04). ✓ RP-04 closure verified — every remaining `EditFieldOption[]` is a codelist-mapping computed or the visibility binary; zero hardcoded arrays mirror a codelist namespace. ✓ Consumer wiring verified (country/currency resources + computeds; ISO-2 storage; item_approval_status pills codelist-fed via `<app-status-pill>`). ✓ Standards clean (standalone/OnPush/inject/input/output, role classes, TYPE-01, emit-only discipline). **Three non-blocking flags:** (1) pages-settings grew 162 → 223/250 in this sweep — approaching warn band, watch; (2) edit-field 204/250 stable in the warn band — type-specific body extraction owed on next touch; (3) F-3 asymmetry worth a note in the Profile component too → landed (one-line comment at the fin payload, follow-up commit).
