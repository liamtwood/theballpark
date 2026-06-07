# Sweep Completeness — Soft-Delete + Audit Trail (Item 1)

Every business table is classified below. **Nothing is unaccounted for.**
Companion to `migration_soft_delete_and_audit_trail.sql` (read its DESIGN
DECISIONS block first). Source of truth: `server/src/db/migrate-schemas.js`.

Legend: **CHANGED** = gets `deleted_at` + audit (+ hard-delete guard).
**JUNCTION** = audit only, guard OFF (delete-reinsert is its normal op).
**EXEMPT** = no soft-delete, no audit. **SKIPPED** = deferred, with reason.

## Per-environment business schema (public=dev / preview / master)

| Table | PK | Class | Notes |
|---|---|---|---|
| orgs | uuid | CHANGED | is_active today → converge to deleted_at |
| users | uuid | CHANGED | has softDelete (is_active); converge |
| clients | uuid | CHANGED | converge |
| categories | uuid | CHANGED | converge |
| items | uuid | CHANGED | converge |
| projects | uuid | CHANGED | converge |
| project_categories | uuid | CHANGED | has `DELETE` site (project-category.service:183) — convert before guard |
| estimates | uuid | CHANGED | converge |
| estimate_items | uuid | CHANGED | **hard-deletes today** (estimate-item.service:135) — convert before guard |
| messages | uuid | CHANGED | **already uses deleted_at** ✓; has `hardDelete` (msg.service:81) — drop/convert |
| message_items | uuid | CHANGED | conversation model |
| message_item_events | uuid | CHANGED | conversation model |
| message_item_decisions | uuid | CHANGED | conversation model |
| quote_requests | uuid | CHANGED | |
| tag | uuid | CHANGED | tag dictionary (entity) |
| ai_search_hints | uuid | CHANGED | low-stakes; could SKIP if you prefer |
| statuses | uuid | CHANGED | reference data; audit valuable, rarely deleted |
| balls_transactions | uuid | CHANGED* | **append-only ledger** — guard=immutable, audit on insert, never soft-deleted |
| project_items | uuid | **JUNCTION** | cart toggle = delete/reinsert (project-item:434, taxonomy:909) — guard OFF |
| project_item_suppliers | **composite** | **JUNCTION** | delete/reinsert (project-item:281) — guard OFF; record_id NULL (D1) |
| supplier_item_tag | (junction) | **JUNCTION** | full re-sync on every item save (taxonomy:425,483) — guard OFF; **must stay deletable** |
| favourites | uuid | **JUNCTION** | uses is_active toggle (no delete); audit only |

## Shared / Marketing / Internal

| Table | PK | Class | Notes |
|---|---|---|---|
| shared.feedback | uuid | CHANGED | product data; **hard-deletes** (feedback.service:244-245) — convert before guard |
| shared.feedback_categories | uuid | CHANGED | **hard-deletes** (feedback.service:220) — convert |
| shared.codelists | uuid | CHANGED | **hard-deletes** (codelist.service:103) — convert |
| shared.feature_flags | uuid | CHANGED | config; audit valuable |
| marketing.guestlist_signup | uuid | CHANGED | **already soft-deletes** ✓ (marketing.service) |
| marketing.welcome_content | **text** | CHANGED | CMS config; record_id = the text key (D1) |
| marketing.welcome_settings | **int=1** | CHANGED | single-row config; record_id = '1' (D1) |
| internal.project_log | uuid | **EXEMPT** | append-only commit log; auditing it is recursive/pointless |
| audit.audit_log | bigserial | **EXEMPT** | the audit log itself |
| shared.backlog | uuid | **SKIPPED** | internal dev/ops tracking, not customer business data — revisit if it becomes a product surface |
| shared.bugs | uuid | **SKIPPED** | internal dev/ops tracking — same reason |
| org_type_config | text | **SKIPPED** | Piece 2, not yet created. When its migration runs: add audit (config changes), no soft-delete (fixed 3 rows) |

## Blast radius — hard-delete call sites the guard blocks
Convert these to `softDelete` (set `deleted_at`) **before** enabling the guard
(`v_guard=true` / the shared+marketing PART) on their table:
- `estimate-item.service.js:135` — estimate_items
- `feedback.service.js:220/244/245` — shared.feedback(_categories)
- `codelist.service.js:103` — shared.codelists
- `message.service.js:81` — messages.hardDelete (softDelete already exists)
- `project-category.service.js:183` — project_categories

Junction sites that **stay** hard-delete (guard OFF, no change needed):
`project-item.service.js:281/434`, `taxonomy.service.js:425/483/909`.

## Open items for sign-off
1. **is_active → deleted_at convergence** — app-layer follow-up converts the
   ~11 is_active services to stamp deleted_at. Keep is_active too, or drop it?
2. **ai_search_hints / statuses** — CHANGED as above, or SKIP (low value)?
3. **Junction exemptions** confirmed? (supplier_item_tag MUST stay deletable.)
4. **changed_by attribution** — backend must `SET LOCAL app.current_user_id`
   per request (D3); until then all writes attribute to the SYSTEM sentinel.
