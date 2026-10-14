# v2dev — environment topology & promote runbook

**Status:** LOCKED 2026-10-14 (Liam). First execution target: **stand up v2preview**.
**Scope:** how the v2dev rebuild gets dev / preview / prod environments, how code + schema
promote through them, and the concrete v2preview stand-up checklist.

---

## Locked topology + WHY

**Three fully-isolated, full-stack environments** — `dev` / `preview` / `prod` — each with its
**own Supabase DB + own Railway backend service + own frontend build**. Same code promoted
through them; the ordered rebuild migrations (`0001→00NN`) run per env. Plus a **dedicated 4th
"tracker" DB** holding `shared.feedback` (the EP/FR/BE backlog + ref sequences).

**Why (environment parity — the standard pattern):**
- It IS the rebuild's **database-per-instance** thesis, and the **standalone-prod** end state.
  dev/preview/prod become one uniform model, so **prod cutover is just "promote again"** with
  the identical mechanic — no second re-architecture.
- Corrects v2's shortcut (one DB, environments-as-schemas, shared middle tier) that this
  rebuild is explicitly leaving.
- A separate **preview DB lets preview run RLS-FLIPPED** = a true prod rehearsal: the flipped
  security posture (FR-00215 done · BE-00132 · taxonomy gates) is PROVEN on preview before prod.
- **Tracker is the exception to isolation** — it's team ops/PM data (refs + nextval sequences),
  not tenant data; three copies would fragment the backlog AND collide the ref sequences. One
  shared store, reached by a SEPARATE connection. (Codelists, by contrast, ARE per-env.)

**Run posture per env:** `dev` = owner-ok (velocity). **`preview` + `prod` = RLS-FLIPPED**
(app connects as `web_app_user`, no owner bypass).

---

## Per-env provisioning trio

Each environment = three matched pieces:
1. **Supabase project** — own connection string, `JWT_SECRET`, owner creds, **`web_app_user`**
   role creds, anon/publishable key.
2. **Railway backend service** — branch-watched (dev→`dev`, preview→`preview`, prod→`prod`),
   with that env's vars: `DATABASE_URL` (app = web_app_user for flipped envs),
   `MIGRATION_DATABASE_URL` (owner, for migrations + auth-bootstrap pool), `JWT_SECRET`,
   Supabase keys, `TRACKER_DATABASE_URL` (the shared tracker — see below).
3. **Frontend build** — the matching env file (`environment.ts` / `environment.staging.ts` /
   `environment.prod.ts`), each carrying its API base URL (its Railway backend) + Supabase key
   + `versionChip`. Build `ng build --configuration=staging|production`.

**Secrets — per env, never shared.** A dev JWT must not validate in preview/prod → distinct
`JWT_SECRET` per env. Distinct owner + web_app_user DB creds per env.
**Google OAuth** — register a callback/redirect URI **per env domain** (local is pinned to
:4201; preview + prod each need their own registered redirect URI).

---

## The forward path — ordered migrations + a runner + a ledger

**Single source of truth for schema = `server/db/rebuild/0001..00NN`**, applied **in numeric
order by filename** (gaps like 0012/0016 are fine). Every env is built from `0001`; there is
**no additive-delta-SQL and no `migrate-schemas.js`** in the rebuild path (that's the deprecated
v2 forward-build).

**The migrations are SELF-SEEDING for system/reference data** (verified):
- `0002_core_tables.sql` — BOOTSTRAP inserts the **sentinel Ballpark org #1** (`…0001`) + the
  **system user** (`…0000`) + stamps authorship (while audit FKs are still nullable).
- `0007_codelists_seed.sql` — system codelists (56 inserts).
- `0008`/`0009` — categories + seed.
So running `0001→NN` reproduces **schema + sentinels + system reference** in one pass — no
separate system-seed step. (Tenant/demo data is NOT seeded and NOT copied between envs.)

> ⚠️ `server/src/db/seed-preview.js` is the **OLD v2** preview-*schema* seeder (DESTRUCTIVE —
> truncates `preview.*` in the one-DB model). **Do NOT use it** for the separate-DB preview.
> `seed-dev-users.js` is dev-only test logins (convenience, not system seed).

**A runner does NOT exist yet** — the `0001..NN` files have been applied ad hoc (Supabase MCP).
**Write one** at `server/db/rebuild/run.js`:
- Maintains a **`schema_migrations` ledger table** in each target DB (`filename`, `sha256`,
  `applied_at`).
- Applies **pending** files in numeric order, **each in its own transaction**, recording the
  row on success; skips already-applied (idempotent).
- Connects as the **owner** (`MIGRATION_DATABASE_URL`) — migrations create tables + policies and
  must bypass RLS.
- Fails loudly on a checksum mismatch for an already-applied file (migrations are **forward-only
  + immutable once any upstream env has run them** — never edit a run migration; add a new one).

**Promote flow (replaces `git push origin dev:preview` + delta-SQL):**
1. Advance the env branch to the dev commit (code).
2. Run `run.js` against that env's DB → applies the new `00NN` gap (schema + any new seed).
3. Railway redeploys that env's backend; frontend builds its configuration.
"In lockstep" = **the three DBs have applied the same migration numbers.**

---

## RLS-flipped bootstrap order (per env; prod from day one)

Owner does schema + bootstrap (RLS bypassed, correctly); the **app runtime connects as
`web_app_user`** (RLS-subject). Order:
1. Create the DB.
2. `run.js` as **owner** → tables + policies (+ the self-seed: sentinels, codelists, categories).
   The `web_app_user` role + its table grants are created by the migrations.
3. Sentinels exist from `0002` (step 2) — **before any RLS-subject access**.
4. App backend connects as **`web_app_user`** with the per-request **GUC middleware**
   (`app.current_org_id` / `app.is_admin` / `app.svc_moderate` from the JWT); the
   **auth-bootstrap owner pool** is the one elevated path (login/onboarding write before a
   tenant context exists).

**Known flipped-env traps (both already fixed in code/migrations — verify on the first flipped
env):**
- **GUC helpers must `nullif('')`**, not just `coalesce` — the middleware sets false GUCs as
  `''`, and plain coalesce throws `''::boolean` intermittently on pooled connections (bit
  `app_svc_moderate`).
- **Sentinel UUIDs fail zod `.uuid()`** (not RFC-4122) — validate org/user ids with the
  canonical-uuid regex, not `.uuid()`.

---

## Tracker DB (shared.feedback)

- **One shared tracker, all three envs write to it** — NOT per-env. It's the team backlog +
  the EP/FR/BE `nextval` ref sequences; splitting it fragments the roadmap and collides refs.
- Lives in its **own DB**, reached by a **separate connection** (`TRACKER_DATABASE_URL`; the
  tracker harness already uses a distinct owner connection, so it's env-independent).
- **Near-term:** point `TRACKER_DATABASE_URL` at the existing shared schema.
- **Before prod cutover:** provision the dedicated tracker DB + migrate the backlog into it, so
  the tracker **survives v2's retirement** (it must not die with the v2 DB it currently lives in).
- It is **NOT** part of the `0001..NN` migrations and must never be rebuilt per env.

---

## FIRST TARGET — v2preview stand-up checklist

1. **Supabase:** create the `v2preview` project. Record connection string, `JWT_SECRET`,
   anon/publishable key, owner creds.
2. **Roles:** confirm `0001..NN` create `web_app_user` + grants (they do). Set the app
   connection to `web_app_user` (flipped); migrations use the owner connection.
3. **Migrate:** run `run.js` against v2preview's DB (owner) → applies `0001→NN` =
   schema + sentinels + codelists + categories. Verify the `schema_migrations` ledger lists all
   applied files.
4. **Railway:** create the `v2preview` backend service, branch-watch `preview`, set its env vars
   (app = web_app_user `DATABASE_URL`, owner `MIGRATION_DATABASE_URL`, `JWT_SECRET`,
   Supabase keys, `TRACKER_DATABASE_URL` → existing shared schema).
5. **Frontend:** point `environment.staging.ts` at the v2preview API URL + Supabase key + chip;
   build staging.
6. **OAuth:** register the v2preview domain's Google redirect URI.
7. **Verify flipped posture:** run the persona/coverage + FR-00215 tests as `web_app_user`
   against v2preview — they must pass (proves the prod security posture). Confirm the marketplace
   (supplier_directory) + the GUC/sentinel traps behave under the flipped role.
8. **QC:** Liam QCs the rebuild on v2preview.

Prod (`v2prod`) is the **same recipe later** (post DB-review/wipe) — the v2preview stand-up IS
the rehearsal. Script steps 1-7 so prod is a repeat.

---

## Known constraints / don't-trip
- Forward-only, immutable migrations (never edit a run file).
- Don't bundle the tracker into `0001..NN`; don't use `seed-preview.js` for the separate-DB preview.
- Codelists are per-env (built + groomed, "system lists sync / ballpark lists per-env"), NOT shared.
- Per-env secrets + OAuth redirect URIs (no cross-env JWT validity).
