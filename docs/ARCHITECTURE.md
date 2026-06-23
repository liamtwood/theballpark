# Ballpark — Architecture

Technical wiring. Tech stack, processes, auth, services, database, env vars,
file layout, deployment.

For workflow + ship-report process, see `CLAUDE.md`. For engineering rules
(transactions, JWT discipline, hygiene), see `ENGINEERING.md`. For visual
design (tokens, components, layout), see `DESIGN.md`.

---

## 1. Tech stack

| Layer | v1 (`client-angular/`) | v2 (`client-v2/`) |
|---|---|---|
| **Frontend** | Angular 18 + PrimeNG 17 + Tailwind | Angular 21 + PrimeNG 21 (Aura) + Tailwind |
| **Icons** | Lucide via `LucideAngularModule.pick({})` | Same |
| **Backend** | Node.js + Express (shared with v2) | Same (shared) |
| **Database** | Supabase PostgreSQL 17.6 | Same |
| **Auth** | Google OAuth 2.0 → JWT (httpOnly cookie) | Same — `passport-google-oauth20` + identity-only JWT (7d) per AUDIT-01 |
| **Storage** | Supabase Storage (6 buckets, 3 environments) | Same |
| **Email** | Resend | Same (transactional) |
| **AI** | Anthropic SDK (Claude) | Same |
| **Hosting** | Vercel (frontend) + Railway (backend) | Same |
| **Domain** | theballpark.ai | Same |
| **Port (local)** | 4200 (web) + 3001 (api) | 4201 (web) + 3001 (api shared) |

Repo: `github.com/liamtwood/theballpark`
Branches: `dev` → `preview` → `master`

---

## 2. Three processes, one repo

```
┌────────────────────────┐        ┌────────────────────────┐
│ client-angular (v1)    │        │ client-v2              │
│ Vercel static / :4200  │        │ Vercel static / :4201  │
└──────────┬─────────────┘        └──────────┬─────────────┘
           │  HTTPS  /api/*                  │  HTTPS  /auth/*, /api/*
           └────────────┬────────────────────┘
                        ▼
           ┌──────────────────────────────┐
           │  server/                     │
           │  Node + Express              │
           │  Railway / :3001 (dev)       │
           └──────────────┬───────────────┘
                          │  SQL (pooler)
                          ▼
           ┌──────────────────────────────┐
           │  Supabase Postgres 17.6      │
           │  4 schemas (public/preview/  │
           │  master/shared)              │
           └──────────────────────────────┘
```

Single Node server backs both frontends. v1 and v2 share the API for the
overlap of their lifetimes; v2 routes that don't exist in v1 (`/auth/*`,
`/api/onboarding/*`, `/api/team/*`, `/api/brand`, `/api/dev/*`) are gated
by the v2 router (`authenticate` → `requireActiveMembership`).

---

## 3. Three deployment targets

| Target | Branch | Frontend (Vercel) | Backend (Railway) | DB schema |
|---|---|---|---|---|
| **Dev** (local) | local | `localhost:4200` / `4201` | `localhost:3001` | `public` |
| **Preview** | `dev` | `preview.theballpark.ai` (or `.vercel.app`) | preview Railway URL | `preview` |
| **Production** | `master` | `theballpark.ai` | prod Railway URL | `master` |

`APP_SCHEMA` env var on the server picks which DB schema is active. `pool.js`
sets `search_path` per connection. Same code, different data.

---

## 4. Version-label bumping — CRITICAL

The version label at the bottom-right of the app (e.g. `[Dev v2] v2.07a`)
comes from a **different env file per build target**. Bumping only
`environment.ts` is a silent failure — preview / master keep reporting the
OLD version even though new code shipped.

| Build target | Env file | angular.json config |
|---|---|---|
| Dev (local) | `environment.ts` | `development` |
| Preview | `environment.staging.ts` | `preview` |
| Master (prod) | `environment.prod.ts` | `production` |

**Rules:**

- Every code commit on `dev` bumps `environment.ts` (`[Dev] vX.Y` or `[Dev v2] vX.YYa`)
- The commit that **merges dev → preview** must also bump `environment.staging.ts`
- The commit that **merges preview → master** must also bump `environment.prod.ts`
- Never bump `environment.prod.ts` outside a master release
- Never bump `environment.staging.ts` outside a preview promotion

Quick sanity check after deploy: open the deployed URL, look at the chip,
confirm it matches what was just promoted. If it still shows the old number,
the env file for that target wasn't bumped.

---

## 5. Authentication & authorisation — v2 (current)

### Overview

```
Provider:    Google OAuth 2.0 (SSO only — no username/password in v2)
Library:     passport-google-oauth20
Token:       Stateless JWT, 7-day expiry, identity-only claims (per AUDIT-01)
Cookie:      bp_session, httpOnly, sameSite=lax, secure in prod
Middleware:  authenticate (verifies JWT) → req.user
             requireActiveMembership(perm?) — applied at v2 router level,
             re-reads live user_orgs per request (suspension bites
             immediately, not 7 days later)
```

### JWT payload (v2 — identity-only)

```json
{
  "sub":     "user-uuid",
  "email":   "user@example.com",
  "org_id":  "org-uuid",
  "org_type":"agency | supplier | ballpark",
  "is_admin": true,
  "role":    "agency_admin",
  "iat":     1234567890,
  "exp":     1235172690
}
```

`is_admin` and `role` are kept for backward-compat but marked DEPRECATED —
`requireActiveMembership` overwrites them with live DB truth on every
protected request (per WORKING_STANDARDS §"JWTs carry identity, not authority").
Dropped from newly-signed JWTs in pV2-02b.

### Auth flow

```
1. User clicks "Continue with Google" on /login or /
2. GET /auth/google           → passport redirects to Google consent
3. GET /auth/google/callback  → upsertUserFromGoogle:
                                   - lookup by google_sub
                                   - else lookup by email (linking)
                                   - else create users row (orgless)
                                buildSession(userId)
                                signSessionCookie
                                redirect to {WEB_BASE_URL}/auth/callback?login=ok
4. SPA's /auth/callback page  → calls AuthService.loadSession()
                                navigates to /home (has org) OR /onboarding (orgless)
5. AuthService.user signal    → populated; rest of app reads from it
```

### Effective role model

Derived at session time from `(orgs.type, user_orgs.is_admin)` — no role enum stored:

| `orgs.type` | `is_admin` | Effective role |
|---|---|---|
| agency | true | `agency_admin` |
| agency | false | `agency_member` |
| supplier | true | `supplier_admin` |
| supplier | false | `supplier_member` |
| ballpark | (any) | `ballpark_admin` |

### Permissions matrix

Mirrored in `client-v2/src/app/core/auth/permissions.ts` AND
`server/src/services/permissions.service.js`. Drift caught by Vitest parity test.

```
                       agency_admin  agency_member  supplier_admin  supplier_member  ballpark_admin
org.invite_member          ✓             —              ✓                —                —
org.manage_billing         ✓             —              ✓                —                ✓
project.create             ✓             ✓              —                —                —
project.delete             ✓             —              —                —                —
item.create                ✓             ✓              ✓                ✓                —
item.delete                ✓             —              ✓                —                —
inbox.reply                ✓             ✓              ✓                ✓                —
inbox.adjust_cost          ✓             ✓              ✓                ✓                —
cart.checkout              ✓             ✓              —                —                —
admin.cross_org_view       —             —              —                —                ✓
```

### Platform admin vs org admin — two different "admins"

`ballpark_admin` is the PLATFORM administrator (cross-org), NOT a super-org-
admin. The matrix is deliberate:

- **Org admins** (`agency_admin` / `supplier_admin`) hold org-scoped powers —
  invite members, manage billing — for THEIR org only. They do NOT hold
  `admin.cross_org_view` and cannot edit anything type-wide.
- **`ballpark_admin`** holds `admin.cross_org_view` ONLY. It does NOT hold
  `org.invite_member` etc. — a platform admin is not an admin *of* customer
  orgs, and Settings → Team bounces them (cross-org admin ≠ org admin).
- **Page settings** (`/settings/pages`, `PUT /api/config/:orgType` on the v2
  path) are gated on `admin.cross_org_view` because the config is
  org_type-WIDE — an agency admin editing it would change every agency.
  NOTE: this overloads `admin.cross_org_view` ("can see across orgs") with
  "can edit type-wide config"; acceptable while both are platform-admin-
  scoped, split into a `page_config.edit` permission if a second
  platform-admin capability emerges (deferred — Liam, 2026-06-11).

A user can hold BOTH hats via two `user_orgs` rows (e.g. Liam: Ballpark
admin + agency admin); `users.default_org_id` picks the active one at
session time — switching requires changing the default until the org
switcher lands.

### `org_id` source of truth — never compromise

```
Backend:  req.user.org_id from JWT middleware ONLY
          Never trust org_id from request body or query params
          Middleware sets it, service uses it

Client:   AuthService.user().activeOrgId
          Never hardcode org_id
          Never invent a "getCurrentAgency()" pattern (removed in v1.65)
```

### Dev login — v2-only convenience

`POST /auth/dev/login` impersonates a SEEDED user (where `google_sub IS NULL`)
in dev mode. Returns 403 in prod. Used by the `/login` page's dev picker.
Seeded users come from `server/src/db/seed-dev-users.js`.

---

## 6. Service architecture

### The rule

```
Org service    → org_id is a required input parameter
                 Always scoped to one org
                 Multi-tenant by definition

Shared service → no org_id needed
                 Platform-wide data
                 Same data for all orgs
```

### Backend services

#### Org-scoped (always require org_id)

```
server/src/services/
  org.service.js          → org identity + config only
  user.service.js         → team management (v1)
  subscription.service.js → plan + billing + Ball balance
  project.service.js      → projects (any org type)
  catalogue.service.js    → items + leads (any org type)
  client.service.js       → clients
  favourite.service.js    → saved items/suppliers
  message.service.js      → comms threads
  message-item.service.js → message items + decisions
  balls.service.js        → Ball transactions + balance
```

#### Shared (no org_id required)

```
server/src/services/
  auth.service.js         → upsertUserFromGoogle, buildSession
  permissions.service.js  → effectiveRole, MATRIX, can()
  category.service.js     → platform taxonomy
  item.service.js         → marketplace browse (all orgs)
  status.service.js       → status definitions
  ai.service.js           → Anthropic SDK calls
  feedback.service.js     → bugs, features, meeting notes
  storage.service.js      → file upload handling
  config.service.js       → org-type config (v1 page settings)
```

### v2 db helpers (new in pV2-AUDIT-02)

```
server/src/db/
  pool.js              → PostgreSQL connection (env-driven schema)
  with-transaction.js  → owns BEGIN/COMMIT/ROLLBACK + GUC interplay
                          (sets app.current_user_id from ALS so the audit
                          trigger stamps created_by/updated_by inside the txn)
  request-context.js   → AsyncLocalStorage for per-request user id
  migrate-schemas.js   → idempotent schema setup for all 3 env schemas
```

### Route URL conventions

```
v1 org-scoped routes:
  GET    /api/orgs/:id/users
  POST   /api/orgs/:id/projects
  GET    /api/orgs/:id/catalogue
  (etc.)

v1 shared routes:
  GET    /api/categories
  GET    /api/items
  GET    /api/feedback

v2 routes (gated by requireActiveMembership at router level):
  GET    /api/team
  POST   /api/team/invite
  PATCH  /api/team/:userId
  PATCH  /api/team/:userId/status
  DELETE /api/team/:userId

v2 unauthenticated:
  GET    /auth/google
  GET    /auth/google/callback
  POST   /auth/logout
  GET    /auth/me            (authenticate only — works for orgless)
  POST   /auth/dev/login     (NODE_ENV=development only; 403 in prod)
  GET    /api/dev/users      (NODE_ENV=development only)
  GET    /api/brand          (public — brand config for first paint)

v2 orgless (authenticated but no membership yet):
  POST   /api/onboarding/create-org
```

### Angular services (v1)

```
client-angular/src/app/core/services/

Org-scoped:
  org.service.ts          → org identity only
  user.service.ts         → team management
  subscription.service.ts → plan + billing
  project.service.ts      → projects
  catalogue.service.ts    → org catalogue items
  client.service.ts       → clients
  favourite.service.ts    → favourites
  message.service.ts      → messages
  balls.service.ts        → Ball transactions

Shared:
  auth.service.ts         → login, logout, currentUser$
  category.service.ts     → platform categories
  marketplace.service.ts  → item browse
  feedback.service.ts     → bugs, features, meeting notes
  config.service.ts       → theme, platform settings
  ai.service.ts           → brief parsing
  api.service.ts          → base HTTP wrapper (credentials: 'include')
```

### Angular services (v2)

```
client-v2/src/app/core/
  api.service.ts             → HttpClient wrapper using RuntimeConfigService.apiBaseUrl
  runtime-config.service.ts  → loads /runtime-config.json at bootstrap
  brand-config.service.ts    → loads /api/brand at bootstrap; applies --bp-* tokens
  auth/
    auth.service.ts          → signal-based SessionUser; loadSession/loginWithGoogle/devLogin/logout
    auth.guard.ts            → DEPRECATED — superseded by requires-org.guard in pV2-02b
    requires-org.guard.ts    → redirects orgless users to /onboarding (default-on)
    needs-onboarding.guard.ts→ redirects users WITH orgs away from /onboarding
    admin.guard.ts           → redirects non-admins to /
    permissions.ts           → can(role, perm) mirror of server matrix
  team/
    team.service.ts          → /api/team CRUD
  onboarding/
    onboarding.service.ts    → POST /api/onboarding/create-org
```

---

## 7. Database schema architecture

One Supabase PostgreSQL 17.6 instance, four schemas:

```
public   → dev        Local development. Default schema.
preview  → preview    QA and stakeholder demos.
master   → production Production.
shared   → all envs   Cross-environment tables:
                        shared.feedback             (bugs, features, meeting notes)
                        shared.feedback_categories  (folder/issue/area types)
                        shared.feedback_links       (sprint/release/area references)
                        shared.feature_flags        (per-env feature toggles)
                        shared.auth_sessions        (refresh tokens — legacy v1)
```

### Schema switching

```
APP_SCHEMA env var controls which schema the server uses.
pool.js sets search_path on every connection automatically.
No table prefixes needed in service files.

Local .env:         APP_SCHEMA=public
Railway preview:    APP_SCHEMA=preview
Railway production: APP_SCHEMA=master
```

### Auth tables (v2 — in each env schema)

```
users
  id, email (unique partial idx WHERE deleted_at IS NULL),
  google_sub (unique partial idx WHERE NOT NULL),
  display_name, avatar_url, default_org_id,
  + legacy v1 cols: name (NOT NULL), org_id, role (DEFAULT 'member' — passed NULL explicitly in v2)
  + audit cols

user_orgs   (membership — replaces v1's role-per-user model)
  user_id, org_id            ← PRIMARY KEY (user_id, org_id)
  is_admin (boolean),
  job_title (text),
  status ('active' / 'invited' / 'suspended'),
  invited_by_user_id, invited_at, joined_at,
  + audit cols

bp_brand_config             (system-wide brand tokens loaded at bootstrap)
  key (PK), value, audit cols
```

### Other v1-canonical tables (used by both apps for now)

```
orgs                  → agency, supplier, admin (legacy 'admin' → 'ballpark' via normalizeOrgType)
clients               → agency's customers
projects              → events
categories            → marketplace taxonomy
items                 → supplier catalogue entries
project_items         → the cart (project ↔ item junction)
messages              → conversation thread per (project, supplier)
message_items         → items discussed in a message
message_item_decisions→ append-only audit per item (accept / decline / price change)
balls_transactions    → credit ledger (append-only)
estimates             → cost roll-ups per project
estimate_items        → items on an estimate
favourites            → user ↔ item wishlist
org_type_config       → per-org-type page-settings (v1 page-settings drawer storage)
```

### Reference codelists (RC/RCV — pV2-CODELISTS-01, v2.18a)

Reference data lives in TWO shared-schema tables (full spec:
`docs/CODELISTS.md` — the `reference_` prefix is deliberate, Oracle
RC/RCV lineage):

```
shared.reference_codelists        (RC — one row per LIST)
  list_name PK, description, is_active, default_code,
  type ('system' read-only | 'ballpark' admin-curatable — CHECK),
  application (groups the admin UI), consumer_table/consumer_column
  (nullable pointers powering the deactivation in-use count),
  created_at / updated_at / updated_by

shared.reference_codelist_values  (RCV — renamed from shared.codelists)
  id, list_name, code, label, symbol, description, sort_order,
  is_active, is_system, is_default (one per list — partial unique idx),
  meta JSONB (rich status meta: color/color_soft tokens, icon,
  is_terminal, allowed_next_codes — data only, nothing enforces
  transitions yet), created_at, updated_at
```

Server: `services/codelist.service.js` (v1 reads + v2 RC-aware fns);
`services/codelist.consumers.js` (PURE whitelist gating consumer-pointer
identifiers — Rule 8, pool-free specs); routes: v1 `/api/codelists`
read-only (write verbs retired v2.18a — RP-03 class), v2 gated router
`/api/codelists` on the v2 chain (parents+counts / `:list/values`
consumer read / `:list/all` / usage / POST / PATCH; DELETE → 405 always).
NOTE: the single-segment `GET /api/codelists/:list` belongs to the v1
router (mounted first) until v1 retires — the v2 consumer read is
`/:list/values`.

No-DELETE is three-layer: API 405 + forbid-hard-delete trigger (where
the audit helper is installed) + seed-time default-invariant assertion
in `db/codelists-seed.js` (called from migrate-schemas.js §4f).

Client: `core/codelists/` (types + metaColor, session-cached
CodelistService with invalidate-on-write), `shared/status-pill/`
(meta-driven pill), `/settings/codelists` admin UI (ballparkAdminGuard).

### Universal audit columns + soft delete

Every business table has 6 audit columns (`created_at` / `created_by` /
`updated_at` / `updated_by` / `deleted_at` / `deleted_by`), enforced by a
helper function `audit.add_audit_columns(schema, table)`. Soft-delete via
`deleted_at IS NULL` filter on every read. Hard-delete forbidden on entity
tables by `trg_forbid_hard_delete`. Junction tables exempt.

See `ENGINEERING.md` §"Data audit" for the full rules.

### Migration discipline

`server/src/db/migrate-schemas.js` is the **only** sanctioned way to bring
a schema into the current shape. Idempotent (every statement `IF NOT
EXISTS` / `ON CONFLICT DO NOTHING`). Targets `public.`, `preview.`,
`master.` explicitly per statement.

`migrate.js` is **deprecated** (public-only); don't add new ALTERs there.

Rules:
- Every commit that adds / alters a column, table, index, or seed MUST
  update `migrate-schemas.js` in the same commit
- All three schemas mirrored explicitly (no `ALTER TABLE items` — write
  three statements)
- Prefer `gen_random_uuid()` over `uuid_generate_v4()` (PG13+ built-in,
  schema-portable)
- Standalone `migrate-vX.Y.js` files are fine as history but NOT canonical
- Before merging `dev → preview` (or `preview → master`): run the script

---

## 8. Backend laws

```
Routes     → Thin controllers only
             Validate input (Zod schemas — see ENGINEERING.md API audit checklist)
             Call service → return response
             Never write SQL in a route handler
             All protected routes use authenticate middleware
             v2 routes inherit requireActiveMembership at router level

Services   → All business logic and SQL
             One file per domain: server/src/services/
             Org services always accept org_id as parameter
             Never use getCurrentAgency() — use req.user.org_id

Auth       → authenticate() on all protected routes
             req.user set by middleware — never trust body/params for org_id

Errors     → Always use next(err)
             Never res.status(500).json() in routes
             Centralised handler in index.js (no stack traces in prod responses)

Config     → dotenv called ONCE in index.js
             All env vars via process.env
             Never hardcode URLs, credentials, or org IDs

CORS       → Driven by ALLOWED_ORIGINS env var
             credentials: true required for httpOnly cookie auth

SSL        → Conditional on NODE_ENV

Security   → Helmet (security headers — coming in pV2-AUDIT-03)
             Rate limiting via express-rate-limit on all /auth/* and /api/dev/*
             app.set('trust proxy', 1) — required for accurate per-IP limits
             behind Railway's edge
```

---

## 9. Environment variables

### Local `.env`

```
APP_SCHEMA=public
DATABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
STORAGE_BUCKET_PROJECTS=dev-project-assets
STORAGE_BUCKET_SUPPLIERS=dev-supplier-assets

# v2 auth (new in pV2-02)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3001/auth/google/callback
JWT_SECRET=...                 # openssl rand -hex 64
JWT_COOKIE_DOMAIN=             # empty for localhost
JWT_COOKIE_SECURE=false        # true in prod
WEB_BASE_URL=http://localhost:4201

# v1 auth (legacy)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
COOKIE_SECRET=...
JWT_EXPIRY=1h

# CORS
ALLOWED_ORIGINS=http://localhost:4200,http://localhost:4201

# Mode + integrations
NODE_ENV=development
ANTHROPIC_API_KEY=...
UNSPLASH_ACCESS_KEY=...
RESEND_API_KEY=...
EMAIL_FROM=noreply@theballpark.ai
```

### Railway preview

Same as local plus:

```
APP_SCHEMA=preview
GOOGLE_OAUTH_REDIRECT_URL=https://[preview-api]/auth/google/callback
JWT_COOKIE_DOMAIN=.theballpark.ai
JWT_COOKIE_SECURE=true
WEB_BASE_URL=https://[preview-web]
ALLOWED_ORIGINS=https://[preview-web]
STORAGE_BUCKET_PROJECTS=preview-project-assets
STORAGE_BUCKET_SUPPLIERS=preview-supplier-assets
NODE_ENV=development   # OR production to disable dev picker
```

### Railway production

```
APP_SCHEMA=master
GOOGLE_OAUTH_REDIRECT_URL=https://api.theballpark.ai/auth/google/callback
JWT_COOKIE_DOMAIN=.theballpark.ai
JWT_COOKIE_SECURE=true
WEB_BASE_URL=https://theballpark.ai
ALLOWED_ORIGINS=https://theballpark.ai
STORAGE_BUCKET_PROJECTS=project-assets
STORAGE_BUCKET_SUPPLIERS=supplier-assets
NODE_ENV=production
```

JWT secrets MUST be different per environment. If a dev secret leaks, prod
sessions stay unforgeable.

---

## 10. File locations

```
ballpark/
├── docs/                          ← this folder
│   ├── CLAUDE.md                  ← workflow + ship-report process (router)
│   ├── DESIGN.md                  ← visual reference (this doc's sibling)
│   ├── ARCHITECTURE.md            ← (this file)
│   ├── ENGINEERING.md             ← hygiene rules + anti-patterns + the test
│   └── PROGRESS.md                ← per-prompt chronological log
│
├── client-angular/                ← v1 app (Angular 18, port 4200)
│   └── src/
│       ├── app/
│       │   ├── core/
│       │   │   ├── services/      ← singleton services (one per domain)
│       │   │   ├── guards/        ← AuthGuard, RoleGuard
│       │   │   ├── interceptors/  ← auth.interceptor.ts
│       │   │   └── models/        ← TypeScript interfaces
│       │   ├── shared/components/ ← reusable presentational components
│       │   ├── layout/            ← top-nav etc.
│       │   └── features/          ← auth, dashboard, settings, projects, …
│       └── styles.css             ← SINGLE SOURCE OF TRUTH for v1 PrimeNG overrides
│
├── client-v2/                     ← v2 app (Angular 21, port 4201)
│   ├── public/runtime-config.json ← runtime API URL (no rebuild for self-host)
│   ├── tailwind.config.js         ← palette REPLACES Tailwind default (compile-time enforcement)
│   ├── client-v2.schematic.yaml   ← schematic of what's built (foldable)
│   └── src/
│       ├── styles.css             ← --bp-*, --theme-*, --color-* tokens
│       ├── main.ts                ← bootstrap: runtime-config → brand → session
│       └── app/
│           ├── app.config.ts      ← providePrimeNG + Aura preset + BallparkPreset
│           ├── app.routes.ts
│           ├── core/              ← singleton services (auth, api, brand-config, team, …)
│           ├── shell/             ← app-shell, page-hero, user-menu, version-chip
│           ├── shared/            ← user-avatar (atomic primitives)
│           └── pages/             ← landing, login, auth-callback, hello, onboarding, settings/team
│
├── server/                        ← Node + Express (shared by v1 + v2)
│   └── src/
│       ├── index.js               ← Express entry, route mounting, CORS, error handler
│       ├── middleware/
│       │   ├── authenticate.js    ← JWT verification, sets req.user (v2)
│       │   ├── authorise.js       ← legacy v1 role check
│       │   ├── require-active-membership.js  ← v2 live membership re-read
│       │   ├── rate-limits.js     ← express-rate-limit budgets
│       │   └── user-context.js    ← ALS request context
│       ├── routes/                ← thin controllers (one per domain)
│       │   ├── auth.js            ← v2 Google OAuth + dev login + logout + me
│       │   ├── dev.js             ← v2 dev picker
│       │   ├── brand.js           ← v2 public brand config
│       │   ├── team.js            ← v2 team management
│       │   ├── onboarding.js      ← v2 create-org
│       │   └── (v1 domain routes: orgs, projects, items, messages, …)
│       ├── services/              ← business logic + SQL (one per domain)
│       │   ├── auth.service.js    ← upsertUserFromGoogle, buildSession
│       │   ├── permissions.service.js
│       │   └── (v1 domain services)
│       └── db/
│           ├── pool.js            ← PG connection (env-driven schema + audit-attribution wrapper)
│           ├── request-context.js ← AsyncLocalStorage
│           ├── with-transaction.js← shared txn helper (v2)
│           ├── migrate-schemas.js ← canonical schema setup
│           └── migrate.js         ← DEPRECATED (public-only)
│
├── prompts/                       ← per-feature prompts + ship reports
│   ├── backlog.md                 ← prompt status table
│   ├── cc-onboarding.md           ← (migrates into docs/CLAUDE.md)
│   ├── pNNNN-*-prompt.md          ← spec per prompt
│   ├── pNNNN-*-mockup.html        ← optional visual reference
│   └── pNNNN-*-shipped.md         ← ship report per shipped prompt
│
└── WORKING_STANDARDS.md           ← v1 doc — migrating to docs/ folder
```

---

## 11. Runtime config (v2 self-host story)

The v2 client reads `apiBaseUrl` from `/runtime-config.json` at boot — NOT
from compile-time `environment.ts`. This means a customer can deploy the
same dist bundle to multiple environments by editing one JSON file.

```javascript
// main.ts
const ref = await bootstrapApplication(AppComponent, appConfig);
await ref.injector.get(RuntimeConfigService).load();   // /runtime-config.json
await ref.injector.get(BrandConfigService).load();     // /api/brand (overrides --bp-*)
await ref.injector.get(AuthService).loadSession();     // /auth/me (populates user signal)
```

If `/runtime-config.json` is missing, the app falls back to the env file's
baked URL. If `/api/brand` fails, the app falls back to `styles.css` defaults
(no FOUC).

---

## 12. Smoke-test routes

Run after every deploy to catch silent failures:

| v1 (port 4200) | v2 (port 4201) | Why |
|---|---|---|
| `/home` | `/home` (auth) | Dashboard + greeting renders |
| `/projects` | — | Project list |
| `/projects/:id` | — | Project detail |
| `/inbox` | — | v1 inbox |
| `/marketplace` | — | Catalogue grid (highest PrimeNG surface area) |
| `/settings` | `/settings/team` | Forms render, drawer works |
| — | `/` | Public landing page (unauthenticated) |
| — | `/login` | Google CTA + dev picker (if enabled) |
| — | `/onboarding` | Orgless authenticated user reaches this |
| — | `/api/brand` (curl) | Returns `{ font_pair, gradient, text_color }` |
| — | `/auth/me` (curl with cookie) | Returns SessionUser or 401 |

Console should be clean of errors. Footer chip should match the version
you intended to deploy.
