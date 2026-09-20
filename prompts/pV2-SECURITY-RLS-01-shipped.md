# pV2-SECURITY-RLS-01 — Steps 1-2 SHIPPED (app guards + GUC plumbing)

**Epic:** EP-00020 (pre-launch security hardening). **Owner:** CC (f2). Greenlit by
Liam via ballpark-bd, 2026-09-20. This ship = the **low-risk, reversible** first
batch: §2 app-layer guards + §3 GUC plumbing. **No role flip, no RLS policies**
(that's the gated FR-00209/210 follow-on — do NOT flip `DATABASE_URL` until those
+ 3-persona tests are green). Server-only; no client build (no chip bump).

## BE-00108 (§2) — shared ownership guard + taxonomy IDOR wiring
- **NEW `server/src/lib/authz.js`** — `assertOwnedByActiveOrg(table, id, orgId,
  {isAdmin})`; whitelist table→ownership lookups (items/projects/orgs/
  project_items, incl. two-party supplier match); throws **404** (no
  enumeration) unless owned or admin.
- **`routes/taxonomy.js`** — assert project ownership up front on the
  project-bearing endpoints: `add-match`, `remove-match`, `request-quotes`
  (RFQ authorized *by* the owned project), and — only when a `projectId` is
  present (both are optional there) — `match-items` and `search-hint`. Existing
  `assertItemInOrg` on the item-mutating routes kept.

## BE-00109 (§2c) — v1 legacy org-from-query hole gated
- **NEW `server/src/middleware/force-org-from-jwt.js`** — overwrites any
  client-supplied `org_id` (query/body) with the verified JWT org.
- **`index.js`** — the four v1 mounts (`/api/categories`, `/api/items`,
  `/api/projects`, `/api/project-items`) now sit behind
  `authenticate → requestContext → requireActiveMembership() → forceOrgFromJwt`
  (chose **gate**, not delete — reversible; the spec's fallback). Closes
  `/api/items?org_id=<other-org>`. Verified no live consumer breaks: v2 does not
  call these paths (grep clean) and v1 client-angular is not deployed.

## BE-00110 (§3) — audit/RLS GUCs from the JWT, request-pinned client
- **NEW `server/src/middleware/request-context.js`** — seeds ALS
  {userId, orgId, isAdmin} from `req.user` and PINS one pooled client per
  request, `set_config`-ing `app.current_org_id` / `app.current_user_id` /
  `app.is_admin` once; `RESET ALL` + release on `finish`/`close` (idempotent).
- **`db/pool.js`** — `pool.query` now prefers the request-pinned client (GUCs
  already set, single round-trip); the per-write txn wrapper stays as the
  fallback, and its `WRITE_RE` is broadened to `/\b(insert|update|delete)\b/i`
  so CTE/multi-statement writes still attribute.
- **`db/with-transaction.js`** — sets all three GUCs (txn-local) on its own
  client from ALS.
- **`index.js`** — `requestContext` mounted after `authenticate` in the v2 group
  and both `/api/admin` chains.
- **Behaviour-neutral today:** `DATABASE_URL` is still the schema owner → owner
  bypasses RLS, so the GUCs enforce nothing yet. This is the plumbing §1 builds on.
- Left `middleware/user-context.js` + the `authenticate.js` `store.userId` line
  in place (audit for un-pinned/v1 paths) — their removal is rollout step 6,
  after the role flip.

## Verification
- All edited server files `node --check` clean; **server boots healthy** on :3001
  (had to clear a duplicate-nodemon EADDRINUSE race from rapid saves — one clean
  supervisor now).
- **GUC smoke test (real DB):** pinned client → `pool.query` sees the request's
  `app.current_org_id`/`user_id`; after `RESET ALL`+release a no-context query
  sees empty; a second org sees only its own — **PASS** (no cross-request leak).
- Full server test suite still green (69/69) — unchanged by these edits.

## BE-00113 — v1 convenience routes gated (follow-up to BE-00109)
The ungated direct `app.<verb>` v1 convenience routes now sit behind the same
`v1Gate` (hoisted to the top of the middleware section): `/api/org` (GET+PUT),
`/api/org/balls-balance`, `/api/org/users`, `/api/items/:id/images`,
`/api/suppliers/:id/images`, `/api/clients/:id/projects`. Verified `/api/org` →
**401** unauthenticated; health still 200. v2 calls none (grep clean).

## materialize-proposed — RESOLVED (Liam 2026-09-20: require projectId)
- Route: `projectId` now **required** (400 if missing) →
  `assertOwnedByActiveOrg('projects', projectId, org)` up front — closes the last
  taxonomy IDOR. The write is authorized BY the caller owning the RFQ's project.
- Service: the supplier-owned item INSERT (`org_id = supplier_id ≠ caller`) now
  runs inside `withTransaction` with a **txn-local `app.is_admin='t'`** around
  just that INSERT (§1-A elevation) so `items_insert` passes once RLS is on;
  drops at COMMIT, no effect pre-RLS.
- Callers: **none** in client-v2 or client-angular call `materialize-proposed`
  today (grep clean) — nothing to wire through; if a future caller is added it
  must pass `projectId`.

## FR-00209 / FR-00210 (§1 RLS core) — WRITTEN + DRY-RUN VALIDATED, pending apply
Inert until applied; apply + `DATABASE_URL` flip are Liam's to run (shared-DB
writes), only after his BE-00110 sanity-check and green persona tests.

**Deliverables**
- `server/src/db/migrate-rls.js` — idempotent, standalone. Creates the
  `web_app_user` role, the `public` GUC readers, per-schema `SECURITY DEFINER`
  membership helpers (`app_owns_project` / `app_is_project_supplier` /
  `app_is_org_admin` / `app_can_access_project_item` / `app_owns_estimate` /
  `app_owns_item`), scoped grants (explicit per-table — grant scope is a control),
  the full tenant policy set (all §1f archetypes over the real introspected
  columns), and the `orgs_public` view. **Standalone, not folded into
  migrate-schemas.js** (that file fatals ~2139/BE-00095, so it can't apply
  end-to-end) — fold in once BE-00095 is fixed.
- `server/src/db/rls-coverage.test.js` (FR-00210) — asserts every base table
  granted to `web_app_user` has ≥1 policy (deny-all guard). Skips pre-apply.
- `server/src/db/rls-personas.test.js` (FR-00210) — seeds A(agency)/B,C(supplier)
  + project + items as owner, then asserts the supplier / agency / admin / no-context
  matrix as `web_app_user`. Skips until `WEB_APP_DATABASE_URL` is set.

**APPLIED to public + GREEN (2026-09-20).** Liam applied migrate-rls.js to public;
coverage + all personas now pass — **suite 74/74** (was 5-skipped pre-apply). Two
fixes found during the live persona run:
- **Missing audit grant (would break ALL writes post-flip).** Every write fires
  `audit.stamp_audit_cols()` / `forbid_hard_delete()` (SECURITY INVOKER) in schema
  `audit`; `web_app_user` had no access → `permission denied for schema audit`.
  Added `GRANT USAGE ON SCHEMA audit` + `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA
  audit` to migrate-rls.js (global). Applied to dev + validated. **Liam: re-run
  `node migrate-rls.js` so it's recorded (idempotent), and it's needed for
  preview/master.**
- **Persona test teardown:** `trg_forbid_hard_delete` blocks hard DELETE on
  orgs/items/projects, and `orgs_name_unique` ignores soft-delete — so the test
  now uses a RANDOM tag + DISTINCT per-org keys (B/C were both `_supplier` → an
  intra-run collision) and soft-deletes fixtures by prefix in `after()` (mops up
  leftovers too). Green + idempotent across runs.

Persona matrix proven as web_app_user: supplier reads own drafts+approved + the
agency project (line context) + own line, NOT another supplier's draft, edits only
own item, can't mutate the agency project; agency browses approved only, owns its
project, item write denied; admin cross-org R/W; no-context sees only approved,
writes nothing.

- **Dry-run** (earlier): the full migration compiled against the live public
  schema (BEGIN/ROLLBACK, nothing persisted).
- **Finding:** the **preview** schema lags public (missing `supplier_org_id` on a
  table) → applying RLS there fails until the additive delta lands. So the
  migration defaults to **public only**; `--schemas=public,preview,master` opts
  in per env once each is caught up (matches the rollout: dev first).

**Runbook for Liam (in order — do NOT skip the gate):**
1. Confirm the BE-00110 app sanity-check passed on localhost.
2. Set `WEB_APP_PW` (new secret) in the env.
3. Apply to dev: `WEB_APP_PW=<pw> node server/src/db/migrate-rls.js` (public).
4. Set `WEB_APP_DATABASE_URL` (same DB URL, user/pass = web_app_user) and run
   `node --test server/src/db/rls-personas.test.js` + `rls-coverage.test.js` —
   all must be green.
5. Only then flip `DATABASE_URL` → web_app_user (keep the owner URL as
   `MIGRATION_DATABASE_URL`). Smoke-test the whole app as each persona (spec step 4).
6. Roll to preview/master (after catching up their schemas):
   `--schemas=preview` / `--schemas=master`, then flip those envs.

**Open decisions flagged (need a call before/at apply):**
- `categories` has an `org_id` column — spec says admin-write only; if per-org
  categories are real, write should also allow `org_id = app_current_org()`. Left
  admin-write per spec; confirm.
- `shared.feedback` / `marketing.guestlist_signup` writes: NOT granted to
  web_app_user (PII / tracker). The tenant feedback + guestlist-signup write paths
  will break at the flip unless routed through an elevated (owner) path — needs a
  small refactor before the flip, or explicit grants if we accept them as tenant
  writes. Flagged.
- Grant list is the enumerated v2 tenant set; step-4 whole-app testing under
  web_app_user will surface any missing grant as a fail-closed broken feature
  (never a leak) → add its table + policy then.

## NOT done
- Rollout step 6 (delete `x-bp-user-id` / `user-context.js`) — after the flip.

## QC notes
(Liam)
