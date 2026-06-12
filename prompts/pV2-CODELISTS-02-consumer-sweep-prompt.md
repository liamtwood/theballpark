# pV2-CODELISTS-02 — Consumer sweep: hook surfaces onto the codelist machinery

**Status:** Ready (relayed by Liam 2026-06-12; spec by chat)
**Spec:** `docs/CODELISTS.md` (Deferred list — 3 items close here), `docs/AUDIT_LEDGER.md` (RP-04 + RP-09 + F-7 bloat row), `docs/PILLS.md` / `BUTTONS.md` / `CARDS.md` (primitive layer)
**Chip target:** `[Dev v2] v2.19a` (server) / `v2.19b` (client) + v1 chip for the v1-side resolve helper
**Process:** shipped-file contract; end-of-module architect audit when it lands.

## Scope

- `/settings/profile` — country dropdown (codelist `country`, full ISO seed
  exists), currency dropdown (codelist `currency`)
- `/settings/pages` — title-mode dropdown (codelist `page_title_mode`),
  hero_align dropdown (codelist `hero_align`)
- Items (v2 = /marketplace render only; refactor when /store arc lands, but
  seed item_unit / item_time_unit / item_approval_status consumers in place)
- Sweep grep `EditFieldOption[]` arrays across v2 components; promote any
  that match a codelist namespace

## Three loose threads to close

1. **RP-04** — inline option arrays smell. Replace inline arrays with
   `codelists.list(name)` reads. Acceptance: grep returns zero matches
   (interpreted: zero hardcoded arrays that mirror a codelist namespace —
   the `EditFieldOption` interface + data-derived/binary arrays remain).
2. **RP-09** — v1-inherited status lists (project_status / category_status)
   carry literal hex `.color` in meta. Migrate to token refs so the status
   pill resolves via `metaColor()` cleanly. Acceptance:
   `meta->>'color' LIKE '#%'` returns zero rows.
3. **F-7** — codelists-settings 248/250 bloat: extract value-row component.
   Required, not optional.

## Folded-in UX fix

- 409 add copy: "Could not add the value (duplicate code?)" → confident
  "Couldn't add — a value with this code already exists in this list."

## Implementation notes (CC, pre-flight findings)

- `orgs` has `country` but NO currency column → add `orgs.default_currency`
  (VARCHAR(3) DEFAULT 'GBP') in migrate-schemas (×3 schemas) + surface
  country/defaultCurrency through /api/organisation GET/PUT + Zod.
- v1 consumes `meta.color` RAW at 4 sites (dashboard, projects-list,
  project-event-form, category-context-panel) — bare token refs would break
  v1 pills. Fix: one `resolveMetaColor()` helper in v1's codelist.service
  applied at the 4 sites + the state-hue tokens added to v1 styles.css with
  v1's ORIGINAL hex values → zero visual change in v1.
- The 13 hex rows map to a 9-token extended state-hue set
  (`--color-state-blue/indigo/sky/violet/orange/amber/green/emerald/gray/
  gray-light`) defined in BOTH apps' styles.css; project_status+
  category_status keep their exact current hues per-app.
- Marketplace `tierOptions` (basic/mid/premium) filters `items.tier` — a
  DIFFERENT enum from the `budget_tier` codelist (starter/professional/
  premium/unknown). NOT promoted; flagged as a future `item_tier` codelist
  candidate when the /store arc touches items.
- `/settings/team` renders no member-status pill yet (suspend toggle only)
  — `<app-status-pill list="membership_status">` joins when that surface
  shows status (inbox/team arc).
- `currency` parent gets consumer pointer `orgs.default_currency`
  (+ whitelist entry) so the deactivation gate counts org defaults.

Same shipped-file contract as CODELISTS-01. End-of-module audit when it lands.
