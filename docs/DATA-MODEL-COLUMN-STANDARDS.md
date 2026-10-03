# Data model — column standards (by table class)

How columns are shared across tables. Every table belongs to **one class**; the class fixes its
**standard (shared) columns**. Companion to `DATA-MODEL-REDESIGN.md` (the per-table detail) and
`adr/ADR-0002` (read-views/write-tables). Status: 2026-10-03.

## The object base contract

An **object** carries this header, then its own domain columns, then audit:

```
id          uuid  pk
ref         text  nullable        -- stable public handle/slug; populated where user-facing, else null
name        text
description  text  nullable
status      text                  -- codelist/enum lifecycle (replaces is_active)
org_id      uuid  not null        -- owner (tenant org, or Ballpark #1 for global)
… domain columns …
created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
```

- **`ref` is nullable on ALL objects** (uniform header); filled where there's a public handle, null otherwise.
- **Non-objects omit the header entirely** — they are *parent-anchored* (below).
- **Audit is scaled to the row's real lifecycle** — present columns = mutations the row allows (see each class).
- **`org_id` is denormalized onto children** for one uniform RLS policy (`WHERE org_id = current_org`) everywhere.

## The five classes

### A — Object (full contract)
`id, ref(nullable), name, description, status, org_id, + full audit(3 pairs)` + domain columns.
**Members:** `orgs`·, `users`·, `items`, `taxonomy_categories`, `taxonomy_tags`, `projects`, `project_items`,
`project_documents`, `addresses`.
· **Exceptions:** `orgs` has **no `org_id`** (it *is* the tenant — `parent_id`, Ballpark = root);
`users.org_id = Ballpark #1` (instance ownership). `project_items`/`addresses` carry a **null `ref`**
(addressed via parent / not slugged). `messages` is a **party-anchored** object — `from_org_id`+`to_org_id`
instead of `org_id`, `subject`/`body` instead of `name`/`description`.

### B — Satellite 1:1 (extends one parent)
`parent_id  pk  → parent` (the parent FK **is** the PK — no own `id`) · `org_id` (denormalized) · domain
columns · `+ full audit`. **No `ref`/`name`/`description`/`status`** (the parent owns those).
**Members:** `project_settings` (pk `project_id`), `project_item_matches` (pk `project_item_id`).

### C — Child 1:N (many per parent)
`id  uuid pk` · `<parent>_id` FK(s) · `org_id` (denormalized) · `status` **only where it has a lifecycle** ·
domain columns · `+ full audit`. **No `ref`/`name`/`description` header.**
**Members:** `project_categories`, `project_item_quotes`, `project_providers`, `project_links`,
`org_subscription`, `org_credits`, `org_favourites`, `item_extract_jobs`.
(status: `project_categories`/`project_item_quotes`/`project_providers`/`org_subscription` = yes;
`project_links`/`org_credits`/`org_favourites` = no.)

### D — Junction m2m (links two parents)
`(<a>_id, <b>_id)  composite pk` · link attributes · `created_at/by` **+ `deleted_at` for soft-unlink**
(re-add preserves). **No `id`, no header, no `updated_*`** (you add/remove a link, never edit it).
**Members:** `user_orgs` (`+role, status, job_title, invite fields`), `item_tag`, `message_reads` (`+read_at`).

### E — Append-only (immutable journal)
`id  uuid pk` · parent FK(s) · event columns · **`created_at, created_by` ONLY** (no `updated_*`/`deleted_*` —
the *absence* of those columns enforces immutability). **No header.**
**Members:** `message_events` (`message_id, message_relation_id, status, price_*, changes, …`),
`message_relations` (`message_id, typed target FKs`).

## Audit scaling (summary)

| class | created_at/by | updated_at/by | deleted_at/by |
|---|:--:|:--:|:--:|
| Object (A) | ✓ | ✓ | ✓ |
| Satellite (B) | ✓ | ✓ | ✓ |
| Child (C) | ✓ | ✓ | ✓ |
| Junction (D) | ✓ | — | ✓ (soft-unlink) |
| Append-only (E) | ✓ | — | — |

Rule: **the audit columns present = the mutations the row is allowed.** A present-but-forever-null `updated_at`
is a false contract (and a silent place to violate an append-only invariant) — so omit it where updates can't happen.

## Every table → its class

| table | class |
|---|---|
| `orgs` | A (no `org_id`; `parent_id`) |
| `users` | A (`org_id`=Ballpark) |
| `items` | A |
| `taxonomy_categories` | A |
| `taxonomy_tags` | A |
| `projects` | A |
| `project_items` | A (null `ref`) |
| `project_documents` | A |
| `addresses` | A (null `ref`) |
| `messages` | A (party-anchored: from/to_org) |
| `project_settings` | B (pk `project_id`) |
| `project_item_matches` | B (pk `project_item_id`) |
| `project_categories` | C |
| `project_item_quotes` | C |
| `project_providers` | C |
| `project_links` | C |
| `org_subscription` | C |
| `org_credits` | C |
| `org_favourites` | C |
| `item_extract_jobs` | C |
| `user_orgs` | D |
| `item_tag` | D |
| `message_reads` | D |
| `message_events` | E |
| `message_relations` | E |

**`shared` schema** (config / reference / ops — cross-env, not tenant data):
`brand_config`, `coachmarks`, `org_type_config` (app config) · `reference_codelists` + `reference_codelist_values`
(reference) · `feature_flags`, `feedback`, `feedback_categories` (ops) · `migration_flags` (infra). These follow
the object contract where they're objects (`feedback`, `feedback_categories`), key/value or payload shapes
otherwise; they are **not** tenant-scoped (no `org_id`).
