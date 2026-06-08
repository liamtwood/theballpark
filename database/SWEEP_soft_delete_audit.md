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
| ai_search_hints | uuid | CHANGED | low-stakes; SKIP if you prefer |
| statuses | uuid | CHANGED | reference data |
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

## is_active → deleted_at convergence (per-table; report before running)
The `softDelete()` services that set **`is_active=false`** (reads filter
`WHERE is_active=true`) — converge to stamping **`deleted_at`** + read
`deleted_at IS NULL`:
- **is_active cohort:** orgs, users, clients, categories, items, projects,
  project_categories, estimates, statuses (confirmed pattern: e.g.
  category/client/estimate/project-category `softDelete` = `SET is_active=false`).
- **already deleted_at (standard):** messages, marketing.guestlist_signup.
- **Plan (post-migration, app layer):** per service, (1) `softDelete` stamps
  `deleted_at=now()`, (2) list reads filter `deleted_at IS NULL`, (3) keep
  `is_active` writes during transition, then drop the `is_active` filter, then
  drop the column. Done one service at a time so each is independently verifiable.

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

## Open items for sign-off
1. `ai_search_hints` / `statuses` — CHANGED, or SKIP (low value)?
2. Junction exemptions confirmed? (`supplier_item_tag` MUST stay deletable.)
3. Keep `is_active` after convergence, or drop the column once reads move over?
