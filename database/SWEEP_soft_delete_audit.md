# Sweep Completeness — Universal Audit Columns + Hard-Delete Guard (Item 1)

Every business table is classified below. **Nothing is unaccounted for.**
Companion to `migration_universal_audit_columns.sql`. Source of truth:
`server/src/db/migrate-schemas.js`.

**This migration:** 6 universal audit columns (`created_at/by`, `updated_at/by`,
`deleted_at/by`) + a BEFORE stamp trigger + a hard-delete guard on entity tables.
**Deferred to a separate commit this week:** the `audit_log` table + entity-scoped
audit trigger (Option A, entity-scoped). Versioning is deferred indefinitely.

Legend: **CHANGED** = 6 columns + stamp + hard-delete guard. **JUNCTION** = 6
columns + stamp, guard OFF (delete-reinsert is its normal op). **EXEMPT** = no
change. **SKIPPED** = deferred, with reason.

## Per-environment business schema (public=dev / preview / master)

| Table | PK | Class | Notes |
|---|---|---|---|
| orgs | uuid | CHANGED | is_active today → converge to deleted_at |
| users | uuid | CHANGED | is_active → converge |
| clients | uuid | CHANGED | is_active → converge |
| categories | uuid | CHANGED | is_active → converge |
| items | uuid | CHANGED | is_active → converge |
| projects | uuid | CHANGED | is_active → converge |
| project_categories | uuid | CHANGED | is_active → converge; **hard-delete site** (project-category.service:183) |
| estimates | uuid | CHANGED | is_active → converge |
| estimate_items | uuid | CHANGED | **hard-deletes** (estimate-item.service:135) — convert before guard |
| messages | uuid | CHANGED | **already deleted_at** ✓; `hardDelete` (msg.service:81) — convert |
| message_items | uuid | CHANGED | |
| message_item_events | uuid | CHANGED | |
| message_item_decisions | uuid | CHANGED | |
| quote_requests | uuid | CHANGED | |
| tag | uuid | CHANGED | |
| ai_search_hints | uuid | **SKIPPED** | reference/regenerable (sign-off) — no audit columns |
| statuses | uuid | **SKIPPED** | reference/regenerable (sign-off) — no audit columns; is_active stays |
| balls_transactions | uuid | CHANGED | append-only ledger — guard ON (immutable); updated_/deleted_ cols moot |
| project_items | uuid | **JUNCTION** | cart toggle = delete/reinsert (project-item:434, taxonomy:909) |
| project_item_suppliers | **composite** | **JUNCTION** | delete/reinsert (project-item:281) |
| supplier_item_tag | (junction) | **JUNCTION** | full re-sync every item save (taxonomy:425,483) — **must stay deletable** |
| favourites | uuid | **JUNCTION** | is_active toggle (no delete); guard moot |

## Shared / Marketing / Internal

| Table | PK | Class | Notes |
|---|---|---|---|
| shared.feedback | uuid | CHANGED | **hard-deletes** (feedback.service:244-245) — convert before guard |
| shared.feedback_categories | uuid | CHANGED | **hard-deletes** (feedback.service:220) — convert |
| shared.codelists | uuid | CHANGED | **hard-deletes** (codelist.service:103) — convert |
| shared.feature_flags | uuid | CHANGED | |
| marketing.guestlist_signup | uuid | CHANGED | **already deleted_at** ✓ |
| marketing.welcome_content | **text** | CHANGED | CMS config |
| marketing.welcome_settings | **int=1** | CHANGED | single-row config |
| internal.project_log | uuid | **EXEMPT** | append-only commit log |
| shared.backlog | uuid | **SKIPPED** | internal dev/ops tracking — revisit if it becomes a product surface |
| shared.bugs | uuid | **SKIPPED** | internal dev/ops tracking |
| org_type_config | text | **SKIPPED** | Piece 2, not yet created; add columns when its migration runs |

## is_active → deleted_at convergence (SIGNED OFF)
`softDelete()` services that set `is_active=false` (reads filter `is_active=true`)
converge to stamping `deleted_at` + read `deleted_at IS NULL`. **Per-table call:**
- **KEEP `is_active`** (genuine distinct concept — publish / visibility / access),
  alongside the new `deleted_at`: **items, orgs, users**.
- **DROP `is_active`** (was disguised soft-delete → fully replaced by `deleted_at`):
  **clients, categories, projects, project_categories, estimates, codelists,
  favourites**. (`statuses` is SKIPPED entirely — see below — so its is_active is moot.)
- **Already `deleted_at` ✓:** messages, marketing.guestlist_signup.
- **Default rule:** drop unless a distinct non-deletion meaning is confirmed by grep.
- **Plan (post-migration, ONE service per commit, each independently verifiable —
  do NOT bundle):** (1) `softDelete` stamps `deleted_at=now()`, (2) reads filter
  `deleted_at IS NULL`, (3) for DROP tables, remove the `is_active` filter/writes
  then drop the column; for KEEP tables, `is_active` stays as a separate flag.

## Entity base shape (architectural standard — `is_active` vs `status` PENDING Liam)
Every entity table converges to: `id`, `name`, `description`,
`status`-or-`is_active` (**Liam picking one** — Opt 1 `status` everywhere /
Opt 2 `is_active` everywhere + `status_id` on projects+estimates), + the 6 audit
columns. Dormant columns default NULL/sensible. Junction tables stay minimal:
FKs + **4** audit columns (`created_at/by`, `deleted_at/by`) — they have no
meaningful update, so `updated_*` are omitted there.
*(This migration adds all 6 to junctions for one uniform applier; trimming
junctions to 4 is a follow-up if the redundancy bothers us.)*

## Blast radius — 5 hard-delete sites the guard blocks (convert before guard=true)
- `estimate-item.service.js:135` — estimate_items
- `feedback.service.js:220/244/245` — shared.feedback(_categories)
- `codelist.service.js:103` — shared.codelists
- `message.service.js:81` — messages.hardDelete (softDelete already exists)
- `project-category.service.js:183` — project_categories

Junction sites that **stay** hard-delete (guard OFF, no change):
`project-item.service.js:281/434`, `taxonomy.service.js:425/483/909`.

## Backend (post-migration, coordinated with the run)
1. **`SET LOCAL app.current_user_id` middleware** — wrap each request's DB work in
   a txn that sets the GUC from the resolved user, so the stamp trigger attributes
   correctly (until then: app-supplied value, else NULL).
2. **Convert the 5 hard-delete sites** to `softDelete`.
3. **is_active → deleted_at convergence** (above).

## Sign-offs (RESOLVED)
1. ✅ `ai_search_hints` + `statuses` — **SKIP** both (reference/regenerable).
2. ✅ Junction exemptions — **all 4 stay deletable**.
3. ✅ `is_active` — KEEP items/orgs/users; DROP the rest (see convergence above).
4. ✅ Guard — convert 5 sites first; migration runs `v_guard=true` from the start.
5. ⏳ Entity base shape `is_active` vs `status` — **PENDING Liam** (Opt 1 vs Opt 2).
