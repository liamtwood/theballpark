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

## Rules — creating a new table

1. **Classify it on three axes first** — the class (and its columns) is *derived*, not invented:
   - **A. entity vs attachment** — is it its own thing (referenced / user-facing) → **object**; or does it hang off a parent → **non-object**.
   - **B. cardinality to parent** (non-objects) — 1:1 → **satellite** (PK = parent FK, no own `id`); 1:N → **child** (own `id` + parent FK); M:N → **junction** (composite PK).
   - **C. mutability** (orthogonal) — editable → full audit; link-only → `created`+`deleted`; immutable/ledger → `created` only.
2. **Apply the class template** (above) for the standard columns; don't hand-pick the header.
3. **Column order:** objects = `id · ref · name · description · status · type · [org_id + FKs] · [domain groups] · audit`; non-objects = `[keys] · status · type · [domain] · audit`. Group domain columns by sub-topic.
4. **Naming:** snake_case; **plural** entity tables (`items`, `projects`); **owner-prefix** children/satellites (`project_items`, `org_credits`); self-ref FK = `parent_id`, cross-ref = `<table>_id`.
5. **`org_id` NOT NULL** (owning tenant, or Ballpark #1 for global) — **denormalized onto children** for uniform RLS. Exceptions: `orgs` (it *is* the tenant → `parent_id`), identity layer.
6. **`ref`** nullable on objects (fill where user-facing: slug/handle/number); **omit on non-objects**.
7. **`status`** only where there's a real lifecycle; codelist/enum, **never `is_active`/`enabled`/`status_id`**.
8. **Schema placement:** tenant/business data, or app config you *iterate per-env* → `public`. Cross-env **single-copy, non-staged** reference/ops → `shared`.
9. **read via `security_invoker` views, write to base tables via services** (ADR-0002); no `INSTEAD OF` triggers.

## Rules — adding a column

1. **Column vs jsonb:** queryable / filtered / FK'd / aggregated → a **real column**; read-as-a-unit with no query need → a field in an existing **jsonb** value-object. Promote jsonb→column when it becomes query-hot.
2. **Derive before you store.** If it's computable (a balance from the ledger, a role from `org.type`, "before" from the prior event), derive it — don't add a column that can drift.
3. **One name per concept.** Reuse the standard names — `status`, `type`, `org_id`, `ref`, `target_id`, `parent_id` — don't coin a synonym (`is_active`, `kind`, `ref_code`, `supplier_org_id` are retired).
4. **Types:** strings = `text` (not `varchar`); money/qty = `numeric`; ids = `uuid`; time = `timestamptz`; flags = `boolean`; bags = `jsonb`.
5. **Discriminator the code branches on** (a role/type in `permissions.service` or a formula) → **enum / `CHECK`**, *not* a codelist. Data-driven LOVs → codelist.
6. **Live ref → FK; frozen copy → jsonb snapshot.** Addresses: `*_address_id` → `addresses` when live/geo; a snapshot in jsonb when it must freeze (documents, buyer). **Never flat `address`/`city` columns.**
7. **Duplicated-across-a-boundary data needs enforcement** (FK + trigger, a test, or codegen) — or derive it instead.
8. **Additive nullable column** = not a "migration" — add it (NULL for existing) after a quick confirm. Heavy/backfill changes need an explicit ask.
9. **Update `migrate-schemas.js`** (the single source of truth) in the same change; put new DDL **early** (it fatals partway) and verify via `information_schema`.
10. **Place it in the right group** per the column-order rule — physical append is fine (reference columns by **name**, never ordinal).

## Delete & visibility (soft-delete) — one rule, every parent

**Decision (2026-10-04):** soft-delete the **parent only**; **never stamp children**.
Derive a child's visibility from its owner key in **one hop**. Applied **uniformly to
every parent→subtree** (projects, orgs, and any future parent) — not case by case.

**Why uniform even if it's later judged wrong:** a single rule applied everywhere is
reversible as **one predictable sweep** (e.g. "stamp-on-delete everywhere" or "add a
branch gate everywhere"); a pile of per-table choices is archaeology. Consistency is
the hedge, not the model being provably optimal.

**The model:**

1. **Parent delete = set `parent.deleted_at`.** Children are untouched. Undelete =
   clear the flag — a pure, exact restore (no cascade to run *or reverse*).
2. **Two-predicate visibility gate:** a row is live iff `row.deleted_at IS NULL AND
   <owner>.deleted_at IS NULL`. The owner predicate handles parent deletes; the row's
   own predicate handles a child deleted **independently**. Both are required.
3. **One hop, via the denormalised owner key** — `project_id` on every project
   descendant, `org_id` on every tenant row (the RLS key). One join gates the whole
   subtree; no recursive walk. (This is *why* denormalising those keys is mandatory.)
4. **The view owns the gate** (ADR-0002). Counts/aggregates run through the read view
   so the gate can't be forgotten; a count hitting a **base table directly** is the
   only way to get a stale number — forbid it.
5. **Partial unique indexes** — `UNIQUE (…) WHERE deleted_at IS NULL`; a soft-deleted
   row still holds its handle/`ref`.
6. **Owner key gates; referenced (non-owning) key does not.** A row naming two orgs
   (`supplier_org_id`, two-party docs) is gated by its **owning** `org_id` only. A
   *referenced* org/parent being deleted is a **display** concern ("unavailable"),
   never a reason to hide another tenant's row.
7. **Identity is membership-scoped, not owner-gated.** A user belongs to many orgs via
   `user_orgs`; deleting an org must not hide shared users.
8. **Delete vs Cancel vs Purge.** User "delete" = the flag (private/throwaway, hides the
   subtree for everyone). An **engaged** parent uses **Cancel** (a status — two-party,
   stays visible). **Purge** (hard delete + FK `CASCADE`) is a rare admin/retention path;
   everyday delete never fires the cascade. **Ballpark org #1 is never deletable.**
9. **Out of scope:** hiding an **intermediate node** inside a self-ref tree (the one-hop
   owner gate doesn't encode "under node A"). Resolved by the self-ref tree rules —
   lines die with the project or via their own status, not by branch-hiding.

**Regression test (the invariant):** delete child → delete parent → undelete parent →
**child stays deleted.** If that holds, the orthogonal-flag model is intact.

## Self-referencing trees — one rule, every tree

**Decision (2026-10-04):** adjacency-list (`parent_id`) everywhere; same rule on **all**
self-ref trees — `taxonomy_categories`, `feedback_categories`, `feedback` (items), and
the dormant `items` / `project_items` buildup columns. (Feedback already lives this way —
two working trees, 90 nested rows incl. Test Run→Test Case, **no `level`** — which is the
proof the rule is sufficient.)

1. **Cycle guard, two layers:**
   - DB `CHECK (id <> parent_id)` — blocks the self-loop.
   - **App-level ancestor-walk on reparent** — walk up from the proposed new parent; if
     you meet the node being moved, reject. Handles the multi-node loop a `CHECK` can't see.
2. **No stored depth.** `level` is **dropped** — it's derived, drifts, and maintaining it
   re-levels the whole subtree on reparent (the exact O(n) cost the adjacency list exists to
   avoid). `feedback_categories`/`feedback` already run with none.
   - **Depth cap** (taxonomy's 3-deep) = **ancestor-count on write** (recursive CTE, reject
     if depth > 2 / 409 `too_deep`), not a stored number.
   - **Display `level`** = **computed in the read view** (ADR-0002) — always correct, costs
     a cached recursive CTE on a tiny table.
3. **Reparent = a single `UPDATE parent_id`.** O(1), nothing downstream. (Drops the
   "re-level the subtree" step from the current move endpoint.)
4. **All self-ref FKs `NO ACTION`** — consistent with "purge is the only hard delete";
   kills the lone `project_items.option_of_line_id` CASCADE.
5. **Dormant columns stay dormant-but-safe** (`items.parent_item_id`/`derived_from_id`,
   `project_items.parent_id`/`option_of_line_id`) — exist, nothing writes them, same rule
   applies if/when the buildup feature ships.

**Parked (revisit ~2026-10-08):** a dedicated `shared.feedback` walk — the 36-column
kitchen-sink (issues + meetings + sprints + test runs), its `object_type` (folder/issue) +
`type` (sub-kind) two-tier discriminator, and the broader tracker model. Off the launch
critical path; the standards above still apply to its trees in the meantime.

## Constraints — the three buckets + mandatory guards

**Decision (2026-10-04):** today's DB is *under*-constrained (~15 CHECKs across 25+ tables).
Constraints are **rules applied at build time**, not a column-by-column walk — the rebuild
DDL follows the checklist below.

### Allowed-values: which gate, by scope (the three buckets)

| bucket | examples | codelist? | gate | add a value |
|---|---|---|---|---|
| **1 — security / logic discriminator** | `org.type`, `user_orgs.role`, `direction`, `selection_type`, `reason` | **no** | hard-coded `CHECK` | **code release** |
| **2 — system list, needs labels** | `status` family, `country` | **yes — labels/pills only** | `CHECK` / generated-from-seed (values release-gated) | code release |
| **3 — ballpark / org list** | `tier`, `mood`, `project_type` | **yes — the source** | validate against the codelist **at write** (not a hand-copied list) | admin adds live, no deploy |

**Why bucket 1 is never a codelist:** code/permissions branch on it — a runtime-added value
no code path knows about is a security hole or a crash. A release is the *correct* gate.
**Why bucket 3 is never a hard `CHECK`:** the DB wins, so a `CHECK` would block the admin
from adding a value without a deploy — defeating the editable list. Enforce by asking the
codelist "is this valid?" at write, so garbage is still rejected (closes the `event_type`
dirty-data gap: *register AND enforce*).

### Mandatory guards — every new table runs this checklist

1. **Money / qty `≥ 0`** — `CHECK (price >= 0)` etc. on every `numeric` amount. (None exist today.)
2. **`org_id NOT NULL`** on every tenant row — a null `org_id` silently escapes RLS.
3. **`ref` / handle / slug** — **unique per scope, partial on `deleted_at`**
   (`UNIQUE (…) WHERE deleted_at IS NULL`). Soft-deleted rows must not block reuse.
4. **Self-ref** — `CHECK (id <> parent_id)` + app ancestor-walk (see self-ref rules).
5. **Status** — enforced via codelist validation (bucket 2/3), never a hand-copied `CHECK`.
6. **Mutual-exclusion** — model "either/or" money fields as a **real `CHECK`**, not app-only
   (e.g. `project_items`: `price_current` XOR `price_override` — exactly one non-null).

### Cleanup fixes (rebuild)

- `orgs.type` → `agency / supplier / ballpark` (drop stray `admin`; align with `org_type_config`).
- `users.role` → **drop** the column + CHECK (dead in v2; authority = `user_orgs` + derived role).
- `projects.tier` → **bucket 3** (the merged `tier` codelist); `orgs.subscription_tier` → **bucket 1**
  hard `CHECK` (billing branches on it).
- Partial-unique: add `WHERE deleted_at IS NULL` to `orgs.name`, `favourites`, `tag`.
- `coachmarks (page, name)` — dedupe (defined as both a constraint and an index).
- Legacy-table CHECKs (`quote_requests.status`, etc.) vanish with their superseded tables.

## FK delete rules

**Decision (2026-10-04):** default every FK to `NO ACTION` + rely on soft-delete (above);
`CASCADE` only where a parent *purge* should sweep an empty shell.

- **Frozen-copy FKs never `CASCADE`.** A frozen line must **outlive** its source. Fix:
  `project_items.item_id → items` is `CASCADE` today → change to **`SET NULL`** (the project
  line survives the catalogue item being removed). Same rule for any freeze/snapshot ref.
- **`project → its children` `CASCADE` stays** — but only ever fires on **purge** (a provably
  empty project); the everyday "delete" is the soft flag, which never triggers it.
- **Self-ref FKs `NO ACTION`** (see self-ref rules; kills the lone `option_of_line_id` CASCADE).
- **Same relationship, same rule** — today `project_id → projects` is CASCADE on 6 children but
  NO ACTION on `balls_transactions`; `supplier_org_id → orgs` is NO ACTION except
  `project_item_suppliers`. Make each relationship consistent in the rebuild.

## Row-level security (RLS) — acquisition-grade, EP-00020

**Status (verified 2026-10-04):** implemented and **passes review**. 26/27 public tables have
RLS with a uniform helper-function model — do **not** rebuild it; the work is alignment + cleanup.

**The model (keep):**
- Per-request identity via SQL helpers — `app_current_org()` / `app_current_user_id()` (GUC-backed
  from the validated `bp_session` JWT), `app_is_admin()`, and relationship helpers
  `app_owns_project()`, `app_is_project_supplier()`, `app_shares_project()`,
  `app_can_access_project_item()`, `app_owns_item()`, `app_is_org_admin()`.
- Uniform **two-party** gate, e.g. `USING (app_is_admin() OR supplier_org_id = app_current_org()
  OR app_owns_project(project_id))` — owner **or** counterparty supplier, admin override.
- App connects as **`web_app_user`** (`bypassrls = false`); never `service_role`/`postgres` for
  app queries. This is the "enforce context" that the per-query `WHERE` alone didn't give.

**Alignment + cleanup (rebuild):**
1. **Drop 2 dead legacy policies** — `tag` (`tags_read_all`, `tags_write_admin`) and
   `supplier_item_tag` (`item_tags_read_all`, `item_tags_write_supplier`): `roles=authenticated`,
   using `auth.uid()` + dead `users.role`. Supabase-Auth leftovers; inert but clutter.
2. **Enable RLS on `catalogue_extract_job`** (only table with it off) + standard org policy.
3. **`USING (true)` reads are intentional** on global reference tables (`bp_brand_config`,
   `coachmarks`, `statuses`, catalogue `categories`/`tag`) — keep. Caveat: `categories` open-read
   leaks **feedback-namespace** rows until feedback leaves that table in the split.
4. **Re-point helper functions** at the redesigned tables (estimates gone, overlay model) — the
   pattern stays; the joins inside update.
5. **Close the `app_is_admin()` backdoor (FR-00215)** — today it grants blanket cross-org access;
   tighten to **membership-based** pre-launch.
6. **Confirm role + `FORCE`** — policies are PUBLIC (`roles=-`) and no table is `FORCE`d (owner
   bypasses). Confirm the app connects as `web_app_user`; add `FORCE ROW LEVEL SECURITY`.
