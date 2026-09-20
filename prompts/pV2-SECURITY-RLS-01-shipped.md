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

## NOT done (staged follow-on — do not start without the gate)
- **FR-00209** (§1 RLS policies + `web_app_user` role + `orgs_public` view),
  **FR-00210** (coverage test). Requires the resolved per-table decisions + the
  3-persona tests green BEFORE the `DATABASE_URL` flip. Rollout order in the spec.
- Rollout step 6 (delete `x-bp-user-id` / `user-context.js`) — after the flip.

## QC notes
(Liam)
