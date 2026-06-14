# Codelists — Reference data, not hardcoded enums

One-pager. The principle: **never hardcode a list of values that varies
by customer, market, or product evolution.** Reference data lives in
`shared.reference_codelists` + `shared.reference_codelist_values`;
components consume it via `CodelistService`. Adding or changing a value
is a SQL row, not a code change.

The `reference_` prefix is deliberate, not verbosity — it marks these as
reference data (Oracle RC/RCV lineage), never transactional tables, so
future readers don't shorten the names to `codelist*`.

## What it was (v1 — renamed to `reference_codelist_values` in v2.18a)

A single key/value lookup table holding every platform-wide reference
list — statuses, units, currencies, tiers, etc. One row per (list_name,
code) tuple, with display label, symbol, sort order, optional JSONB
`meta` (colors, flags, etc.), and audit fields.

```
shared.codelists (   -- now shared.reference_codelist_values
  id          UUID PK,
  list_name   VARCHAR(100),     -- the namespace ("project_status", "currency", …)
  code        VARCHAR(50),      -- machine code ("active", "GBP", …)
  label       VARCHAR(100),     -- display label ("Active", "GBP (£)", …)
  symbol      VARCHAR(20),      -- optional ("£", "m²", "ft²")
  meta        JSONB,            -- extra payload — colors, flags, anything
  sort_order  INTEGER,
  is_active   BOOLEAN,
  is_system   BOOLEAN,
  created_at  TIMESTAMPTZ
  UNIQUE(list_name, code)
)
```

Schema + seed in `server/src/db/migrate-schemas.js` (~line 1293).

## v2 target shape (locked 2026-06-12 — ships in pV2-CODELISTS-01)

Two-table model, inspired by Oracle Clinical's reference-codelist pattern
(thanks to Liam's old boss, mid-90s):

### Parent — `reference_codelists` (RC, new)

| Column | Notes |
|---|---|
| `list_name` (PK) | snake_case (`message_status`, `currency`, `item_unit`) |
| `description` | what the list controls — "Controls what status is supported by an Inbox message" |
| `is_active` | turn the whole codelist off without dropping it |
| `default_code` | FK to a value in this list; UI dropdowns pre-select this |
| `type` | ENUM: `system` (read-only — code paths depend on values) / `ballpark` (curatable by ballpark_admin in `/settings/codelists`) |
| `application` | subsystem tag (`messaging`, `catalogue`, `project`, `org`, `core`) — groups codelists in the admin UI |
| `consumer_table` | nullable; e.g. `messages` — used by deactivation UI to count in-use rows |
| `consumer_column` | nullable; e.g. `status` |
| audit cols | `created_at` / `updated_at` / `updated_by` |

**Deliberately not included** (Oracle had them, modern stack doesn't need):
`data_type`, `max_short_len`, `max_long_len`, schema reference. TypeScript
types + Zod schemas cover the data shape at the right layer today.

### Values — `reference_codelist_values` (RCV, extends existing)

Keeps current shape (`list_name`, `code`, `label`, `symbol`, `sort_order`,
`is_active`, `is_system`, `meta`) plus two new columns:

- `is_default` — one value per codelist flagged true; dropdowns open pre-selected with it
- `description` — help text per value (for the admin curation UI)

### Rich `meta` convention for status codelists

Status codelists carry a documented `meta` shape so the `<app-status-pill>`
primitive + transition helpers stay generic:

```jsonc
{
  "color":             "var token reference",     // pill foreground / dot
  "color_soft":        "var token reference",     // pill background
  "icon":              "lucide-name",             // optional Lucide icon
  "is_terminal":       false,                     // can it transition out?
  "allowed_next_codes": ["sent", "deleted"],      // state machine — DATA ONLY for now
  "required_permission": "message.delete"         // optional gate
}
```

**Transition data is stored but not yet enforced** — `canTransition()`
helper lands when the first service needs it (likely the inbox arc).
Costs nothing to seed the data correctly now.

### The two locked rules

1. **Values, not lists.** Admin UI lets ballpark_admin add VALUES to
   existing ballpark-type codelists. New codelists require code (a parent
   row + TS types + service consumers). Prevents orphan lists nothing reads.
2. **No DELETE — ever.** Historical entity rows reference codelist values;
   deletion orphans them, breaks audit trails, breaks time-series reports.
   Admin UI has only **Add / Deactivate / Reactivate**. Deactivation UI
   gates with a count query against `consumer_table.consumer_column`:
   *"1,247 records currently use this — they keep displaying it but no
   new writes will allow it."*

## The principle

**Don't hardcode values that can extend.** A hardcoded list of
`['agency_admin', 'agency_member', …]` becomes a 5-file refactor when
the customer needs a new role. A hardcoded `['draft', 'active',
'completed']` becomes a multi-PR retrofit when a new status emerges.
Codelists make those changes **one row of SQL**.

**Reference, never duplicate.** Every UI dropdown for a known
list should read from `CodelistService.list(list_name)`. Inline
`@Input options = [{label:'Draft', value:'draft'}, …]` is a smell —
it pins UI to a snapshot of the data instead of the live truth.

**Meta is the open extension point.** New per-entry attributes
(colors, icons, custom flags) land in `meta` JSONB without touching
the table schema. Read via `CodelistService.getMeta(list_name, code)`.

## Where it lives

- **Schema + seed:** `server/src/db/migrate-schemas.js` (~line 1293)
- **Service (server):** `server/src/services/codelist.service.js`
- **Routes:** v1 reads `server/src/routes/codelists.js` (ungated, until v1 retires — OWNS the single-segment `GET /api/codelists/:list`); v2 gated surface `server/src/routes/codelists-v2.js` (consumer read = `GET /:list/values`)
- **Client service:** `CodelistService` (`client-v2/src/app/core/codelists/`) — caches by list_name; reload triggered by `<app-codelists-admin>` writes
- **Admin UI:** `/settings/codelists` (ballpark_admin only) — same edit-table pattern as `/settings/pages` / `/settings/categories`

## Existing lists (as of 2026-06-12) + v2 type assignment

v1 lives in a single table today; pV2-CODELISTS-01 splits to RC+RCV +
assigns each list a v2 type.

| list_name | Entries | v2 type | Drives |
|---|---|---|---|
| `item_unit` | 6 active (+13 deactivated) | `ballpark` | Item unit dropdown + quote-line qty auto-fill. Consolidated to **Head / Day / Event / Hour / Each / m²** in pV2-QUANTITY-01 (single-list model — see note below). Carries `auto_fill_field` (Head→`guest_count`, Day→`duration_days`). |
| `item_time_unit` | 5 (parent **retired**) | `ballpark` | RETIRED in pV2-QUANTITY-01 — its codes leaked into `items.unit` and the column was 150/152 NULL. Parent `is_active=false`; values left intact. |
| `currency` | 6 | `ballpark` | Currency dropdown on Project Event drawer — admins extend (SGD/JPY/etc.) without dev |
| `budget_tier` | 4 | `ballpark` | Tier dropdown (Starter / Professional / Premium / Unknown) → `projects.tier` |
| `project_status` | 4 | `system` | Project status dropdown + pill — code reacts to specific codes |
| `category_status` | 9 | `system` | Brief-tab per-category status pill — code reacts to specific codes |
| `message_status` (NEW) | 4 | `system` | Inbox messages — Draft / Sent / Read / Deleted (the worked example below) |
| `country` | 249 | `system` | Profile org country select (`orgs.country`) — full ISO 3166-1 alpha-2, not extensible |

**Separate (legacy):** `shared.statuses` is an older statuses table for
project/lead/item statuses, distinct from codelists. v1 was migrating
off it; flagged for consolidation when projects arc lands.

### Units — single-list model + the multi-dimensional deferral (pV2-QUANTITY-01, 2026-06-14)

v1 carried **two** unit lists (`item_unit` + `item_time_unit`) intending to
support a unit × time rate (e.g. *hotel room × nights*: 2 rooms, 3 nights).
The audit found that never materialised: `items.time_unit` was 150/152 NULL,
and the time codes (`day` 25, `event` 41) had instead leaked into
`items.unit`. So QUANTITY-01 **collapsed to a single list** (`item_unit` is
the source of truth), folded `day`/`event`/`hour` in, retired the
`item_time_unit` parent, and merged the long tail (countable → `each`,
`project` → `event`, `sqft`/`linear_m`/`cbm` deactivated). The keeper set is
**Head / Day / Event / Hour / Each / m²**.

**DEFERRED — multi-dimensional units (unit × time).** A line that is genuinely
*per-unit-per-time* (rooms × nights, crew × days) is **not** modelled. The
single `quantity` field + a single unit covers the common case; users bump
the number for scale. If a real per-unit-per-time item resurfaces, the path
back is: reinstate a second dimension (re-activate `item_time_unit` or add a
`project_items.time_quantity`), not a code change buried elsewhere. Liam's
call (2026-06-14): defer until a real item needs it.

## Worked example — `message_status` (the template for every status codelist)

**RC (parent row):**

```
list_name:        message_status
description:      Controls what status is supported by an Inbox message
is_active:        true
default_code:     draft
type:             system
application:      messaging
consumer_table:   messages
consumer_column:  status
```

**RCV (values):**

| code | label | sort | `meta.color` | `meta.color_soft` | `meta.icon` | `meta.is_terminal` | `meta.allowed_next_codes` | `is_default` |
|---|---|---|---|---|---|---|---|---|
| `draft` | Draft | 1 | `--color-text-muted` | `--color-fill` | `pencil-line` | false | `["sent","deleted"]` | true |
| `sent` | Sent | 2 | `--color-info` | `--color-info-soft` | `send` | false | `["read","deleted"]` | false |
| `read` | Read | 3 | `--color-success` | `--color-success-soft` | `check-check` | false | `["deleted"]` | false |
| `deleted` | Deleted | 4 | `--color-danger` | `--color-danger-soft` | `trash-2` | true | `[]` | false |

**Transition state machine** (data stored; enforcement deferred to first writer):

```
Draft ──[send]──→ Sent ──[mark-read]──→ Read
  │                │                      │
  └─── delete ─────┴────── delete ────────┴──→ Deleted (terminal)
```

## When to use codelists

| Use case | Codelist? |
|---|---|
| Status enum (project, category, item, message, …) | **YES** |
| Currency dropdown | **YES** |
| Country selector | **YES** (`country` codelist, ISO-2 codes) |
| Unit / measurement / cadence | **YES** |
| Tier / plan / package level | **YES** |
| Language / locale | **YES** |
| **Platform-wide config setting** (single deployment-level value) | **YES — codelist namespace, not a new table** (see Hindsight section below) |
| Role enum (`agency_admin`, `supplier_member`, …) | **NO** — derived from (org.type, is_admin); see `auth/permissions.ts`. Roles are computed, not stored data |
| Free text fields (name, address, email, description) | **NO** |
| One-off boolean (is_active, is_admin) | **NO** — use a boolean column |
| User-owned arbitrary lists (project names, custom tags) | **NO** — model as proper tables |
| **Per-org-type / per-tenant config payload** | **NO** — use a typed JSONB column (e.g. `org_type_config.payload`). Codelists are global; per-tenant settings need per-tenant rows. |

## What belongs in a codelist — including the platform-config reach (hindsight, 2026-06-12)

**Honest retrospective.** Three of v2's existing settings surfaces —
`/settings/pages` (via `org_type_config`), the brand config (via
`bp_brand_config`), and the codelist admin itself — could have been
built as **one unified codelist machinery** if CODELISTS-01 had landed
before PAGES-01.

In hindsight, the simpler shape was:

| What we built | What codelists would have given us |
|---|---|
| `bp_brand_config` (single-deployment key/value table) + its own service | A `system_config` codelist namespace; admin curation page already exists |
| `org_type_config` (per-org-type typed JSONB payload) + `/settings/pages` | A `page_config` namespace (for global options) + per-org-type override rows |
| 3 admin surfaces (`/settings/codelists`, `/settings/pages`, `/settings/categories`) | 1 (`/settings/codelists` covers everything) |

**The train has left the station** for `org_type_config` and
`bp_brand_config` — both shipped, audited clean, consumed by multiple v2
surfaces. Refactoring them now would be meaningful work for minimal
user-visible benefit; **they stay as-is.**

**The forward-looking rule** (effective immediately):

> Any new system-level setting that emerges should default to a codelist
> namespace, not a new table. Reach for a specialised table only when:
> (a) the setting needs per-tenant variation that can't be modelled as
> codelist rows; or (b) the payload has strong typing requirements that
> Zod-validated `meta.value` can't satisfy. Otherwise, the codelist
> namespace + the already-built admin UI + the audit trail + the
> activation/deactivation + the description column do the job for free.

**Decision criteria when adding a new setting:**

| Question | If YES → codelist namespace | If YES → specialised table |
|---|---|---|
| Does the setting have ONE value for the whole platform? | ✓ (`system_config` row) | |
| Does the setting vary per tenant / org type? | (codelist row per type, OR override pattern) | ✓ (specialised JSONB column) |
| Does the payload have many nested fields that interact (e.g. `{ items: [...], rules: {...} }`)? | | ✓ (typed JSONB with Zod schema) |
| Is the setting a simple key/value the admin curates rarely? | ✓ | |
| Does the setting need its own custom admin UI (drag-drop, image upload, complex form)? | | ✓ (specialised page) |

**Examples that should reach for codelist namespace going forward:**

- Default upload size limit
- Email-template subject prefix
- Default project retention period
- Marketplace category sort order policy
- Notification cadence default
- Feature toggle flags

**Examples that should stay specialised:**

- `org_type_config.payload` (per-tenant, nested fields, Zod-validated)
- `bp_brand_config` — stays as-is (already shipped); would have been a codelist if rebuilt
- Project-level settings (per-project, owned by the project entity)

**Lesson source:** Oracle Clinical (mid-1990s, John's design) used the
reference codelist machinery as both the LOV store AND the system
configuration store. One table type, one curation UI, two functional
roles. Single-tenant by nature, so the unified pattern worked
beautifully. v2 partially adopts it — codelist options for our
dropdowns (after CODELISTS-02) — but the per-tenant config layer needs
its own machinery. The forward-looking rule above captures where the
unified pattern still applies in our multi-tenant world.

**The test:** if you find yourself writing `enum` or a hardcoded
`Option[]` array in component CSS/TS, ask: *will this list ever change
without a code change?* If yes → codelist.

## How to add a new list

1. **Add seed rows** to `server/src/db/migrate-schemas.js` in the
   codelists block. Use `ON CONFLICT (list_name, code) DO NOTHING` so
   re-running the migration is idempotent.
2. **Define types** (TS) in `client-v2/src/app/core/codelists/types.ts`
   if the list has a stable union (e.g. `ProjectStatus`).
3. **Expose via `CodelistService`** — usually automatic; only need to add
   helpers when consumers want sugar (e.g. `getProjectStatuses()`).
4. **Migrate** in dev → preview → master via the schema migration. New
   entries land via the admin UI (no code change).

## How components consume codelists

```ts
// Page-level dropdown:
@Component({ … })
export class ItemForm {
  private readonly codelists = inject(CodelistService);
  protected readonly units = this.codelists.list('item_unit'); // signal/resource
}
```

```html
<app-edit-field
  type="select"
  [options]="units().map(u => ({ label: u.label, value: u.code }))"
  …
/>
```

**Status pill** with codelist-driven color:

```ts
protected readonly meta = computed(() =>
  this.codelists.getMeta('project_status', this.status())
);
```

```html
<span class="bp-status-pill" [style.background]="meta()?.color">
  {{ codelists.label('project_status', status()) }}
</span>
```

## Audit — current v2 usage (post pV2-CODELISTS-02)

**Profile (`/settings/profile`)** — Country (codelist `country`, 249
ISO-2 entries, type-ahead filtered select) and Currency (codelist
`currency`) both live, persisted on `orgs.country` /
`orgs.default_currency` via /api/organisation. Remaining fields are
free-text/number primitives — correct. Future: default tax rate
(possibly `country_tax_default`, depends on country).

**Other v2 surfaces:**

- `/settings/pages` — title-mode + hero-align dropdowns read the
  `page_title_mode` / `hero_align` codelists (v2.19b).
- `/settings/categories` + `/settings/codelists` visibility — boolean
  (`is_active`) UI mappings, not codelists. Correct — binary.
- `/marketplace` filters — supplier + price options are DATA-derived;
  the tier filter targets `items.tier` (basic/mid/premium), a DIFFERENT
  enum from `budget_tier` — `item_tier` codelist candidate when the
  /store arc touches items.
- `<app-edit-field>` — type='select' takes an `options` input (+
  optional `filter` for long lists, v2.19b). The primitive itself
  doesn't know about codelists; consumers wire them in.

## Risk pattern (RP-04 — CLOSED v2.19b)

**Hardcoded inline option arrays where a codelist would extend better.**
Closed by the consumer sweep: every literal `EditFieldOption[]` left in
v2 is either a boolean UI mapping or data-derived — never a codelist
namespace. Ledger row carries the standing grep check.

## Version history

### Summary — skimmable status

Did this ship / has QC closed / has audit closed. Long-form notes live
in the **Detail** table below.

| Version | Date | What changed (1-line) | Ship | QC Done? | Audit Done? |
|---|---|---|---|---|---|
| v1.29–v1.53 | v1 era | Single-table `shared.codelists` + 5 ballpark-list seeds | v1 | n/a | inherited |
| v2.18a/b | 2026-06-12 | pV2-CODELISTS-01 SHIPPED — RC/RCV split, 12 locked parents seeded, `<app-status-pill>` primitive, three-layer no-DELETE, `/settings/codelists` admin UI | dev | ✓ accepted (1 styling nit) | ✓ clean |
| v2.18c | 2026-06-12 | Architect audit triage — 4 fixes accepted, 2 rejected with rationale, 1 noted (F-7 bloat) | (per shipped file) | n/a | ✓ clean |
| v2.18d | 2026-06-12 | QC fix — `appendTo="body"` on edit-field p-select (overlay was CLIPPED by `overflow-hidden`, not z-fought; closes pV2-04c thread app-wide) + RP-09 ledger row | dev `f4e6a05` | ✓ confirmed (dropdown over table; duplicate-code path exercised) | n/a |
| v2.19a/b + v1.70b | 2026-06-12 | **pV2-CODELISTS-02 SHIPPED** — consumer sweep: Profile Country + Currency selects (new `orgs.default_currency`); pages title-mode + hero-align codelist-fed; RP-04 + RP-09 CLOSED (13 hex → `--color-state-*` refs, tokens in both apps at original hues, v1 `resolveMetaColor()` at 4 sites); F-7 value-row extracted (248 → 198 + 63); 409 add copy confident | dev `7aa7986` / `415fbf2` / `72020d8` | ✓ accepted ("lov behaved lovely") — pending/approved pills render, Profile country/currency + /settings/pages dropdowns confirmed | ✓ clean |
| v2.19c | 2026-06-12 | Architect audit triage — 4 fixes accepted (the real catch was F-2: Profile save now per-section payloads — Company Info save no longer overwrites stale Financial values), 2 rejected with rationale, 1 noted (edit-field + codelists-settings + pages-settings in bloat watch) | (per shipped file) | n/a | ✓ clean |

### Detail — QC + Audit findings per version

Cross-reference by Version. Deferrals + risk-pattern pointers + verdict
phrasing all live here.

| Version | QC | Audit |
|---|---|---|
| v2.18a/b | Liam: tested currency add + visibility toggle on /settings/codelists; everything worked. **One styling nit:** select dropdown opens UNDER the table — z-index issue, related to deferred p-select overlay concern from pV2-04c. Bundle into the next styling pass at preset level (one `BallparkPreset.overlay.z-index` tweak; every dropdown inherits). | Server 48/48 + client 67/67 tests green. |
| v2.18c | (audit-only iteration — no functional change to QC) | **Architect (CC):** 7 findings; CC triaged with rationale. **4 accepted:** F-1 HIGH (`inUseCount` table/column identifiers now regex-validated `^[a-z_][a-z0-9_]*$` after whitelist check, fail-closed to null; whitelist-contract spec asserts every entry is identifier-shaped). F-2 MEDIUM (reworded 409 — "defaults can't be deactivated here; changing a list's default requires a data change" vs old misleading "pick a different default first"). F-3 LOW (comment documenting N pills share ONE fetch via service cache — not N+1). F-5 LOW (deactivation gate note leads with "Advisory:" + confirms hidden). **2 rejected with rationale:** F-4 (refetching whole list after save would double traffic; server's returned fresh row is authoritative for this surface). F-6 (seed assertion already halts loudly naming offending list; idempotent migration). **1 noted:** F-7 codelists-settings.component.ts at 248/250 lines — extract value-row component when next touched. Full report: `docs/audits/2026-06-12-codelists-arc-architect-audit.md`. Architect verdict: **"ships with strong architectural discipline and excellent safety guardrails"** — production-ready, no new risk patterns. **Chat audit:** ✓ clean. Verified architecture conformance (cache discipline + gating + Zod patterns mirror marketplace), three-layer no-DELETE (API 405 / DB trigger / seed assertion), F-1/F-2/F-3 fixes present in code, role classes used throughout, `.bp-type-badge` properly global (RP-05 holding). |
| v2.19a/b | Liam: "lov behaved lovely." Tested Profile → edit Company Information → pick a country (filter works by typing); edit Financial defaults → currency; /settings/pages dropdowns still behave; pending/approved status pills render (item_approval_status). | v2 build/lint/guard + 67/67 client, 48/48 server. |
| v2.19c | (audit-only iteration — no functional change to QC) | **Architect (CC):** 7 findings; production-ready verdict; independently re-verified the three closure claims (RP-09 sweep idempotent + case-normalized + jsonb_set NULL-safe; RP-04 walked every remaining EditFieldOption[] literal; F-7 emit-only row without state duplication). **4 accepted:** F-2 MEDIUM (the real catch — Profile's `save()` was sending the whole form regardless of section, so a Company Info save could write stale Financial values back; now builds per-section payloads). F-1 MEDIUM (RP-09 survivor check upper()s the hex match — mirrors the sweep, catches any case). F-3 LOW (`defaultCurrency` deliberately never-clearable, asymmetry with clearable `country` now schema-commented). F-4 LOW (RP-04 ledger grep note reworded — raw matches expected; bar is "no match mirrors a codelist namespace"). **2 rejected with rationale:** F-5/F-6 (no loading gate for codelist selects since session-cached + sub-second cosmetic window; `filterBy` stays 'label' until a consumer actually needs code-search). **1 noted:** F-7 — edit-field + codelists-settings + pages-settings sit in the warning band; watch on next touch. Full report: `docs/audits/2026-06-12-codelists-02-consumer-sweep-architect-audit.md`. Architect verdict: **"production-ready"**. **Chat audit:** ✓ clean. F-2 per-section save verified in `profile.component.ts:162`. F-7 extraction verified — `codelist-value-row.component.ts` exists as emit-only 67-line component; codelists-settings dropped 248 → 216 (out of warning band). RP-04 closure verified — every remaining `EditFieldOption[]` is either a `computed<>` mapping from codelist data or a boolean UI mapping; zero hardcoded arrays mirror a codelist namespace. Standards conformance clean. |

### Deferred — items pushed to a later prompt / arc

Surfaced during ship + audit cycles but deliberately not blocking the
current row's close. Each row names the deferral, why, and where it
lands.

| Item | Deferred from | Why | Lands in |
|---|---|---|---|
| ~~v1-inherited status lists retain literal hex `.color`~~ **RESOLVED v2.19a/v1.70b** | pV2-CODELISTS-01 seed | 13 rows migrated to `--color-state-*` refs; tokens live in BOTH apps' styles.css at the original v1 hues (zero visual change); v1's 4 raw `meta.color` consumers wrapped with `resolveMetaColor()`. RP-09 SQL check returns 0 rows. | shipped |
| ~~Dropdown z-index — `p-select` overlay opens UNDER the table~~ **RESOLVED v2.18d (`f4e6a05`)** | pV2-CODELISTS-01 QC (also pV2-04c thread) | **Root cause was NOT z-index** — it was overflow clipping. The `overflow-hidden` on the rounded table wrapper + `opacity-60` stacking contexts on inactive rows mean a preset-level z-index tweak (chat's original lean) would have changed nothing. Fixed with the OTHER option from the pV2-04c thread: `appendTo="body"` on `<p-select>` inside `<app-edit-field>` — panel portals out of the clipping container; every dropdown app-wide inherits (Profile / page settings / categories / codelists). **pV2-04c overlay concern now closed.** | shipped |
| ~~Extract value-row component~~ **RESOLVED v2.19b** | pV2-CODELISTS-01 F-7 (architect audit) | `<app-codelist-value-row>` extracted — codelists-settings 248 → 198 lines (+63-line row component). Row emits save/toggleActive; parent owns data + the deactivation gate. | shipped |
| `messages.status` consumer pointer (`consumer_table` / `consumer_column`) on `message_status` parent row | pV2-CODELISTS-01 seed | The `messages` table doesn't exist yet (inbox arc). | Inbox arc lands `messages` → update parent row |
| `projects.status` consumer pointer on `project_status` parent row | pV2-CODELISTS-01 seed | Projects still ride legacy `shared.statuses` FK — pointer lands with the projects-arc consolidation. | Projects arc |
| Transition enforcement (`canTransition()` helper using `meta.allowed_next_codes`) | pV2-CODELISTS-01 (data only, no enforcement yet) | First writer's choice — most likely the inbox arc when setting message status. | Inbox arc |

## When to update this doc

- New codelist seeded → add row to Existing lists
- Component starts consuming a codelist → log in Audit section
- Risk pattern surfaces → log under Risk pattern
- Admin UI shipped → bump Version History
