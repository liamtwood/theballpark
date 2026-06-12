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
- **Route:** `server/src/routes/codelists.js` (mounted at `/api/codelists`)
- **Client service:** `CodelistService` (`client-v2/src/app/core/codelists/`) — caches by list_name; reload triggered by `<app-codelists-admin>` writes
- **Admin UI:** `/settings/codelists` (ballpark_admin only) — same edit-table pattern as `/settings/pages` / `/settings/categories`

## Existing lists (as of 2026-06-12) + v2 type assignment

v1 lives in a single table today; pV2-CODELISTS-01 splits to RC+RCV +
assigns each list a v2 type.

| list_name | Entries | v2 type | Drives |
|---|---|---|---|
| `item_unit` | 19 | `ballpark` | Item unit dropdown (Units / Covers / Head / m² / ft² / Linear m / Each / Package / Set / Project / Item / Pair / Panel / Platter / Letter / Load / Pallet / m³ / Table) |
| `item_time_unit` | 5 | `ballpark` | Time-billable items (Days / Hours / Event / Half Day / Month) |
| `currency` | 6 | `ballpark` | Currency dropdown on Project Event drawer — admins extend (SGD/JPY/etc.) without dev |
| `budget_tier` | 4 | `ballpark` | Tier dropdown (Starter / Professional / Premium / Unknown) → `projects.tier` |
| `project_status` | 4 | `system` | Project status dropdown + pill — code reacts to specific codes |
| `category_status` | 9 | `system` | Brief-tab per-category status pill — code reacts to specific codes |
| `message_status` (NEW) | 4 | `system` | Inbox messages — Draft / Sent / Read / Deleted (the worked example below) |
| `country` (NEW, future) | (ISO-2) | `system` | Profile / org country — fixed list, not extensible |

**Separate (legacy):** `shared.statuses` is an older statuses table for
project/lead/item statuses, distinct from codelists. v1 was migrating
off it; flagged for consolidation when projects arc lands.

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
| Role enum (`agency_admin`, `supplier_member`, …) | **NO** — derived from (org.type, is_admin); see `auth/permissions.ts`. Roles are computed, not stored data |
| Free text fields (name, address, email, description) | **NO** |
| One-off boolean (is_active, is_admin) | **NO** — use a boolean column |
| User-owned arbitrary lists (project names, custom tags) | **NO** — model as proper tables |

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

## Audit — current v2 usage

**Profile (`/settings/profile`) — uses ZERO codelists today.**

Fields are all free text or number primitives: name, city, address,
email, phone, refPrefix, vat (number), margin (number), contingency
(number). None reference `CodelistService`.

This is **correct for the current shape** — the fields are open-ended
inputs, not enumerated choices.

**Where Profile MUST use codelists when extended:**

| Future field | Codelist | Status |
|---|---|---|
| Country | `country` (NEW — ISO-2 codes) | column exists in DB; codelist not seeded; UI not built |
| Currency default | `currency` (existing) | not surfaced on Profile yet; lives on Event drawer in v1 |
| Default tax rate | depends on country; possibly `country_tax_default` (NEW) | future |

**Other v2 surfaces:**

- `/settings/pages` — title mode dropdown is currently a hardcoded
  inline `[{label:'Greeting', value:'greeting'}, …]` array. **This is a
  codelist smell** — title modes are a fixed product enum today but
  could extend (personalised, brand-quote, custom-html, …). Worth
  promoting to a `page_title_mode` codelist when next touched. Low
  priority; the inline list works for now.
- `/settings/categories` — visibility is a boolean (`is_active`), not a
  codelist. Correct — it's binary.
- `<app-edit-field>` — type='select' takes an `options` input. The
  primitive itself doesn't know about codelists; consumers wire them in.

## Risk pattern (RP-04 candidate)

Logged: **hardcoded inline option arrays where a codelist would extend
better**. Sweep when next touching a settings/form surface; promote to
codelist if the list is expected to grow or vary by customer.

## Version history

| Version | Date | What changed | Ship | QC | Audit |
|---|---|---|---|---|---|
| v1.29–v1.53 | v1 era | Single-table `shared.codelists` + seeds (item_unit, currency, budget_tier, project_status, category_status) | v1 | n/a | inherited |
| v2.18a/b | 2026-06-12 | **pV2-CODELISTS-01 SHIPPED** — Split to parent `reference_codelists` (RC) + values `reference_codelist_values` (RCV; renamed from `shared.codelists`). Add `type` (system/ballpark), `default_code`, `consumer_table/column`, `application`, `description` on values, `is_default` on values. Rich `meta` for status (color / color_soft / icon / is_terminal / allowed_next_codes / required_permission — data only, no transitions enforced yet). Seed `message_status` as worked example. `<app-status-pill>` primitive. "No DELETE" rule enforced three-layer (API 405 / DB trigger / seed assertion). v1 write verbs retired. `/settings/codelists` admin UI. | dev | — | — |
| **target** | TBD post-CODELISTS-01 | **pV2-CODELISTS-02** — Refactor Profile (country dropdown), Items (units / status / approval_status), `/settings/pages` (title-mode) onto codelist machinery. Sweep `EditFieldOption[]` arrays. RP-04 closed. | — | — | — |

## When to update this doc

- New codelist seeded → add row to Existing lists
- Component starts consuming a codelist → log in Audit section
- Risk pattern surfaces → log under Risk pattern
- Admin UI shipped → bump Version History
