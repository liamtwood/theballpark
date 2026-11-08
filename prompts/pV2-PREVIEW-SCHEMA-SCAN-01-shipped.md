# pV2-PREVIEW-SCHEMA-SCAN-01 — shipped (2026-11-08)

**Trigger:** a background check against PREVIEW (efqmhtnsxbbgxcfoyftj, via `.env.preview`
`MIGRATION_DATABASE_URL`) failed on `select id,email,is_admin from users` →
`column "is_admin" does not exist`. Assumed: a legacy-only column missing on run.js envs
(the org_type_config pattern, see memory `project_rebuild_ssot_table_gaps`).

**Outcome: false alarm, so no migration.** `users.is_admin` is missing on **dev2 too**. The
rebuild model removed it on purpose. The failing query was written for the legacy v2 schema.

## 1. users.is_admin

| | dev2 (jwerngwvensmmhwrcgul) | preview (efqmhtnsxbbgxcfoyftj) |
|---|---|---|
| `users.is_admin` | **absent** | **absent** |
| `users` columns | 20 | 20, identical type/null/default |

The rebuild `users` (0002_core_tables.sql) never had `is_admin`. In the v2dev model:
- **Org admin** = `user_orgs.role IN ('admin','owner')` (0003, "was is_admin").
- **Platform (Ballpark) admin** = an active membership of an org with `orgs.type='ballpark'`,
  which `require-active-membership.js` resolves per request and then sets the
  `app.is_admin` GUC → `app_is_admin()` (0001). A per-org admin NEVER gets the GUC.
- No app code reads `users.is_admin`. The only references are legacy `migrate-schemas.js`,
  `migrate-rls.js` and `seed-dev-users.js` (the deprecated v2 forward-build), which are not run on v2dev envs.

**Correct admin query** for checks/scripts:
```sql
select u.id, u.email, uo.role, (o.type = 'ballpark') as is_platform_admin
  from users u
  join user_orgs uo on uo.user_id = u.id and uo.deleted_at is null and uo.status = 'active'
  join orgs o on o.id = uo.org_id;
```

## 2. Whole-schema scan (preview vs dev2, `public`, via pg_catalog)

Read dev2 as `web_app_user` (its only URL in `.env`), so the scan used `pg_catalog` (which
ignores grants) rather than `information_schema`.

| Dimension | dev2 | preview | Real drift |
|---|---|---|---|
| Tables/views | 32 | 33 | none. Extra = `schema_migrations` (run.js ledger; dev2 is MCP-migrated, no ledger) |
| Columns (type/null/default) | — | — | **none** |
| RLS enabled/forced | 29 | 30 | none (the +1 is `schema_migrations`) |
| Policies (cmd/roles/USING/CHECK) | 69 | 69 | **none** |
| Triggers | 14 | 14 | none |
| Functions (signatures) | 11 | 11 | none |
| Function bodies | — | — | 4 differ, **all cosmetic**: CRLF vs LF, keyword case, comments only on preview (address_locality, app_is_org_admin, items_svc_moderate_guard, messages_pin_parties) |
| Indexes / constraints | 78 / 177 | 79 / 178 | cosmetic: dev2 `item_tags` keeps the old `item_tag_*` PK/FK names (renamed table); preview has `item_tags_*`. Same definitions |
| `web_app_user` table grants | — | — | none |
| anon/authenticated grants | not visible from dev2 | Supabase defaults | can't compare (dev2 read as web_app_user). RLS is forced on every table, so inert |

Preview ledger: 0001–0032 all applied (0012/0016 are numbering gaps, not missing files).

**Conclusion:** preview matches dev2 for every app-relevant object. No legacy-only gap found
in this pass (org_type_config was the last, fixed in 0025).

## 3. Fix
None needed. No migration added (adding `users.is_admin` would bring back the dropped
global-boolean model the security design replaced).

## 4. Admin read path verified on preview (as `web_app_user`, the API's role)
- Membership lookup (the `require-active-membership` SQL) resolves the Ballpark owner:
  `is_admin=true, status=active, org_type=ballpark`.
- `app.is_admin='f'`: orgs 1, users 2, user_orgs 2 (own-org only), `app_is_admin()=false`.
- `app.is_admin='t'`: orgs 10, users 7, user_orgs 11 (cross-org), `app_is_admin()=true`.

Read-only; every probe ran inside `begin … rollback`. Nothing written to preview, nothing promoted or pushed to preview.

## Follow-up (optional)
The scan scripts are throwaway (scratchpad). If "scan before prod" will recur for the
prod env, promote them to `server/db/rebuild/tests/schema-parity.js`.
