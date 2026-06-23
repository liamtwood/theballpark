# pV2-CODELISTS-01 — Reference codelists: RC/RCV split, rich meta, admin curation

**Status:** Ready
**Spec:** `docs/CODELISTS.md` (locked 2026-06-12 — read end-to-end first)
**Amendment (chat-approved post-draft):** table names are
`shared.reference_codelists` + `shared.reference_codelist_values` —
the `reference_` prefix is deliberate (Oracle RC/RCV lineage; signals
"reference data, never transactional"). Names below updated in place.
**Chip target:** `[Dev v2] v2.18a` (multi-commit arc, letters per commit)
**Process:** shipped-file contract (one `pV2-CODELISTS-01-*-shipped.md`,
QC iterations stack); end-of-module architect audit when the module lands.

## Context

v1 holds every reference list in a single `shared.codelists` table
(list_name/code/label/symbol/meta/sort/is_active/is_system). The locked
v2 shape (Oracle RC/RCV pattern) splits it: a parent `reference_codelists`
table describing each LIST (type, default, application, consumer pointers)
and a `reference_codelist_values` table holding the entries — plus the rich `meta`
convention so status pills + future transition helpers stay generic.

This prompt builds the machinery + seeds + admin UI. Consumer refactors
(Profile country, items units, pages title-mode, the `EditFieldOption[]`
sweep that closes RP-04) are **pV2-CODELISTS-02 — out of scope here**.

## Scope

### 1. Schema migration (`migrate-schemas.js` — all three schemas)

- **Rename** `shared.codelists` → `shared.reference_codelist_values` (the
  existing table IS the RCV; one server service reads it — repoint it same
  commit so v1 never breaks). Idempotent: guard with to_regclass checks.
- **Extend** `reference_codelist_values`: + `is_default BOOLEAN DEFAULT false`,
  + `description TEXT`. Existing columns unchanged.
- **Create** parent `shared.reference_codelists` per the locked shape:
  `list_name` PK, `description`, `is_active`, `default_code`,
  `type` (`system`|`ballpark` — CHECK constraint, not a PG enum),
  `application`, `consumer_table`, `consumer_column`,
  `created_at`/`updated_at`/`updated_by`.
- **Backfill** parent rows from `SELECT DISTINCT list_name` so any
  v1-era list not in the seed inventory still gets a parent (type
  `system`, description 'v1-inherited — undocumented', application
  `core`).
- **No DELETE rule**: a `forbid-hard-delete`-style trigger on BOTH
  tables if the audit helper is installed (same DO-block pattern as
  org_type_config), plus the admin UI never exposes delete.

### 2. Seeds — the locked 12 (ON CONFLICT DO NOTHING, idempotent)

Parent row for each + values where net-new. v1-inherited values stay as
they are (they already exist); their parents + `is_default` flags are
the new data.

| list_name | type | application | default_code | consumer table.column |
|---|---|---|---|---|
| `item_unit` (v1) | ballpark | catalogue | `each` | items.unit |
| `item_time_unit` (v1) | ballpark | catalogue | `day` | items.time_unit |
| `currency` (v1) | ballpark | **core** (moved per locked inventory) | `GBP` | — |
| `budget_tier` (v1) | ballpark | project | `unknown` | projects.tier |
| `project_status` (v1) | system | project | `draft` | projects.status |
| `category_status` (v1) | system | project | (current default) | project_categories.status |
| `message_status` (NEW) | system | messaging | `draft` | messages.status |
| `page_title_mode` (NEW) | system | core | `greeting` | org_type_config (payload) |
| `hero_align` (NEW) | system | core | `center` | org_type_config (payload) |
| `membership_status` (NEW) | system | org | `active` | user_orgs.status |
| `item_approval_status` (NEW) | system | catalogue | `pending` | items.approval_status |
| `country` (NEW) | system | core | `GB` | orgs.country |

- `message_status` seeds EXACTLY the worked example in CODELISTS.md —
  4 values with full rich meta (color/color_soft/icon/is_terminal/
  allowed_next_codes) + is_default on draft. **This is the template**;
  copy its shape for the other status lists.
- `project_status` + `category_status` + `item_approval_status` +
  `membership_status` get rich meta too (color/color_soft tokens from
  the §4 semantic-state set, icon, is_terminal, allowed_next_codes —
  derive sensible transitions; data only, nothing enforces them).
- `page_title_mode` values: greeting / username / orgName / fixed
  (labels per the current pages-settings inline array). `hero_align`:
  center / left.
- `membership_status` values: active / invited / suspended — MUST match
  the `user_orgs_status_check` constraint exactly.
- `item_approval_status`: approved / pending / rejected (rejected
  seeded inactive — no consumer writes it yet).
- `country`: full ISO 3166-1 alpha-2 set, generated from a constant
  array in the migration (code = alpha-2, label = English short name,
  symbol = NULL). Static data; one-time cost beats drip-feeding.
- Every list: exactly ONE value `is_default = true`, matching the
  parent's `default_code` (enforce with a seed-time assertion in the
  migration script — fail loudly on drift).

### 3. Server

- `services/codelist.service.js`: repoint to `reference_codelist_values`; add
  parent-aware reads: `lists()` (parents + value counts),
  `values(list_name)` (active, sorted), `valuesAll(list_name)` (incl.
  inactive — curation), `inUseCount(list_name)` (COUNT against
  consumer_table/column via a WHITELISTED identifier map — never
  interpolate request input into identifiers).
- v1 route `/api/codelists` (ungated reads) keeps working unchanged.
  **Check v1 write verbs — if any exist ungated, retire them in this
  ship** (the categories/RP-03 treatment; favourites-style flag if
  consumers exist).
- New gated v2 router `v2.use('/codelists', …)`:
  - `GET /api/codelists` → parents + counts (any member)
  - `GET /api/codelists/:list/values` → active values incl. meta (any
    member; this is what `CodelistService` consumes). NOT bare `/:list` —
    that single-segment path belongs to v1's ungated read (mounted first)
    until v1 retires; a v2 route there would be shadowed.
  - `POST /api/codelists/:list/values` → add value (ballpark_admin via
    `admin.cross_org_view`; **ballpark-type lists only** — system lists
    403 with a clear message; Zod: code snake/upper ≤50 unique-in-list,
    label ≤100, symbol ≤20, description, sort)
  - `PATCH /api/codelists/:list/values/:code` → label/symbol/sort/
    description edits + `isActive` flip (deactivate/reactivate). Same
    gate. Deactivating the default_code → 409.
  - **NO DELETE route.** Add an explicit `router.delete` returning 405
    with the doc's rationale string (self-documenting API).
- Zod schemas + node:test specs (schema specs minimum; the
  one-default-per-list invariant + the identifier whitelist are Rule-8
  pure functions — test them).

### 4. Client

- `core/codelists/codelist.types.ts`: `Codelist` (parent),
  `CodelistValue` (incl. typed `StatusMeta` for the rich-meta shape),
  type guards.
- `core/codelists/codelist.service.ts`: the marketplace
  CatalogueService pattern — session cache by list_name, shared
  in-flight, invalidate-on-write; `list(name)` returns a
  signal-friendly Promise; `label(name, code)` + `getMeta(name, code)`
  helpers per the doc's consumption examples.
- **`<app-status-pill>` primitive** (`shared/status-pill/`): inputs
  `list`, `code`; renders label + meta-driven color/color_soft (+icon
  when present) on the `.bp-status-pill` type class. Classes in
  styles.css (RP-05). This ships consumed by the admin UI's own status
  column so it's born with a consumer.
- **`/settings/codelists`** (ballparkAdminGuard; Codelists tile on the
  ballpark home, `list-checks` icon or similar): master/detail on the
  settings-table pattern — left: parent list grouped by `application`
  (name, type badge, value count, active); right/drill: the values
  table (code read-only, label/symbol/sort/description edit-fields
  save-on-change, Visible/Hidden select). "Add value" row for
  ballpark-type lists only. Deactivation shows the in-use count gate
  copy from the doc ("N records currently use this…") fetched from
  `inUseCount`. System lists render read-only with the type badge
  explaining why.

### 5. Docs

- `docs/CODELISTS.md`: bump Version History; move the 12 lists into
  "Existing lists" with their types; log the admin UI under Where it
  lives. RP-04 row in `docs/AUDIT_LEDGER.md`: log as OPEN here (it
  CLOSES in CODELISTS-02, not this prompt).
- `docs/ARCHITECTURE.md`: codelists section (two tables, the two locked
  rules, the gated/ungated route split).

## Out of scope (explicit)

- Consumer refactors (Profile country, items units/status, pages
  title-mode) — CODELISTS-02.
- Transition ENFORCEMENT (`canTransition()`) — first writer (inbox arc).
- `shared.statuses` legacy-table consolidation — projects arc.
- New-codelist creation UI (locked rule 1: values, not lists).
- Per-customer codelist overrides.

## Acceptance

1. Migration idempotent (run twice, no errors); v1 on :4200 still reads
   every dropdown it did before (spot-check item unit + currency on the
   v1 item drawer).
2. All 12 parents exist with correct type/application/default_code;
   every list has exactly one is_default value matching default_code
   (assertion in migration output).
3. `message_status` values match the worked example exactly, meta
   included.
4. v2 endpoints: member can read lists/values; non-admin 403 on writes;
   POST to a SYSTEM list 403; deactivate default 409; DELETE → 405.
5. `/settings/codelists`: ballpark_admin adds a value to a ballpark
   list (e.g. item_unit) → appears; deactivates a value → in-use count
   copy shown, value dimmed, excluded from `values()` reads; reactivate
   restores. System list read-only.
6. `<app-status-pill list="message_status" code="sent">` renders Sent
   with `--color-info` chrome (admin UI consumes it).
7. Style guard, lint, build green; client + server suites green; every
   new component inside ledger budgets.
8. Ship report incl. per-endpoint API audit checklist; ledger rows for
   new files; end-of-module architect audit after QC settles.

## Verify (CC walk before ship)

Migration twice → seed assertions → v1 spot-check → authz matrix via
preview fetches (as Beth + as Sarah) → admin UI add/deactivate/
reactivate round-trip with DB confirmation → pill render check →
full green run.
