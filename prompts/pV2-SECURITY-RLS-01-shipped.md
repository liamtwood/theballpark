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

## Spec-vs-code flags (raised to ballpark-bd)
- **`materialize-proposed`** has **no `projectId`** — body is
  `{ supplier_id, category_id, name, … }` and it creates a **supplier-owned**
  item (`org_id = supplier_id`) on an agency's behalf. The project-ownership
  assertion can't apply; left authed-but-unscoped with a code flag. Real
  enforcement is the §1 decision-A elevated RFQ write. Needs a decision (require a
  projectId to assert, or rely on §1-A).
- The v1 **convenience routes** in index.js (`/api/items/:id/images`,
  `/api/suppliers/:id/images`, `/api/org*`, `/api/clients/:id/projects`) are
  direct `app.<verb>` handlers using `getCurrentAgency()` — ungated, out of
  BE-00109 scope. Flagged for a follow-up (not in this batch).

## NOT done (staged follow-on — do not start without the gate)
- **FR-00209** (§1 RLS policies + `web_app_user` role + `orgs_public` view),
  **FR-00210** (coverage test). Requires the resolved per-table decisions + the
  3-persona tests green BEFORE the `DATABASE_URL` flip. Rollout order in the spec.
- Rollout step 6 (delete `x-bp-user-id` / `user-context.js`) — after the flip.

## QC notes
(Liam)
