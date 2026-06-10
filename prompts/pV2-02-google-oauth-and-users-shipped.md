# Shipped — pV2-02 — Google OAuth + Users + Roles + dev picker

**Version:** v2.04a (chip `[Dev v2] v2.04a` — per Liam's instruction; the prompt's "v2.01a" was stale)
**Shipped:** 4 commits (cleanup pair · schema+seed · server auth · client auth) — see commit log
**Prompt:** `pV2-02-google-oauth-and-users-prompt.md`

## Pre-work (Liam's instruction)
First commit = the audit cleanup pair: signal ESLint rules (`prefer-signals`, `no-uncalled-signals`, `computed-must-return`, template `no-non-null-assertion`, typed linting via `projectService`) + deleted dead `theme.tokens.ts`.

## What changed

### Schema (`migrate-schemas.js`, run against all 3 schemas)
- **`users` reshaped ADDITIVELY** — the v1 table already existed (id/org_id/name/email/role/…), so: `ADD COLUMN IF NOT EXISTS google_sub TEXT / display_name TEXT / default_org_id UUID`; partial unique indexes `google_sub WHERE NOT NULL` + `lower(email) WHERE deleted_at IS NULL`. v1 columns/rows untouched.
- **`google_sub` is NULLABLE** (prompt said NOT NULL, but its own seed spec requires NULL for dev users — prompt-internal contradiction resolved in favour of the seed; uniqueness preserved via the partial index).
- **`user_orgs`** new: membership with `is_admin` flag, `job_title`, `status` CHECK, invite columns, full audit cols + indexes; `audit.add_audit_columns` run for trigger + delete-guard. Also run on `users` per-schema — **preview/master `users` predated the audit sweep and lacked `deleted_at`** (found when the index failed; fixed by ordering the helper before the index).

### Server
- Deps: `passport`, `passport-google-oauth20`, `jsonwebtoken`, `cookie-parser` (the prompt's `@types/*` skipped — the server is plain JS, nothing consumes them).
- **`routes/auth.js`** (mounted `/auth/*`): `GET /auth/google` (→ Google consent), `GET /auth/google/callback` (upsert → JWT `bp_session` cookie HttpOnly/Lax/7d → redirect `{WEB_BASE_URL}/auth/callback?login=ok`), `POST /auth/logout` (204), `GET /auth/me` (SessionUser or 401), `POST /auth/dev/login` (dev-only; seeded users only — `google_sub IS NULL` + active membership; 403 in prod).
- **`routes/dev.js`**: `GET /api/dev/users` — seeded identities only; **the filter requires an active `user_orgs` membership as well as `google_sub IS NULL`**, because v1's legacy persona rows also have null subs (they have no memberships, so they stay out). 403 in prod.
- **`middleware/authenticate.js`**: verifies the cookie, populates `req.user`, pushes the verified user id into the request's ALS store so `pool.js` stamps `app.current_user_id` (audit attribution).
- **`services/auth.service.js`**: `upsertUserFromGoogle` (by `google_sub` → by email-link → create user + "{name}'s Workspace" agency org + admin membership + default_org_id; writes BOTH `name` (v1 NOT NULL) and `display_name`) + `buildSession` (default-org-first membership pick, derived role).
- **`services/permissions.service.js`**: `effectiveRole(orgType, isAdmin)` + MATRIX + `can()`; **plus `normalizeOrgType('admin' → 'ballpark')`** — the dev DB's existing 'Ballpark' org carries v1's `type='admin'` and is NOT mutated (v1 must keep working), so normalisation happens at the session boundary.
- `index.js`: `cookie-parser` mounted; **CORS `credentials: true`** (cookie flow from the SPA origins); `/auth` + `/api/dev` mounted.
- `.env`: `GOOGLE_OAUTH_*` (values from the existing Google client), generated 96-hex `JWT_SECRET`, `WEB_BASE_URL`, cookie flags. **`.env.example` created** documenting the full set.

### Seed
- **`seed-dev-users.js`** (+ `npm run seed:dev-users`): idempotent; Sarah(admin)+Alex(member) @ Creative Agency Ltd (created), Beth @ Ballpark (existing org reused), Ryan Chen @ Rocket Food (existing org reused). Run — 4 identities live.

### Client (`client-v2/`)
- **`AuthService`** rewritten real: `signal<SessionUser|null>` hydrated from `/auth/me`; `loginWithGoogle()` hard-redirects to `{apiBaseUrl}/auth/google`; `logout()`; async `listDevUsers()` / `devLogin()` (cookie then hard reload). `STUB_USERS` deleted. (The prompt's sketch called `inject()` inside a method — invalid outside injection context; `RuntimeConfigService` is injected as a field instead.)
- **`permissions.ts`** (matrix mirror + `can(role|null, perm)`), **`auth.guard.ts`** (functional; UrlTree → `/login`), guard on the shell parent route.
- Bootstrap: `auth.loadSession()` appended to the initializer chain (runtime-config → brand → auth) so the guard sees a settled signal on first navigation.
- **Login page**: Google CTA + dev picker via **`resource()`** (the v2 fetch-into-state standard from the audit); loader failure (prod 403) → empty list → section hidden.
- **Callback page**: spinner ≥1s, `loadSession()` → `/` or `/login?error=auth_failed`.
- **Hello page**: criterion-7 hero text via `@let`; TEMP `can(role,'cart.checkout')` → "has checkout" chip (criterion 10).
- **User-menu**: dev switcher via `resource()`; sign-out async.
- `ApiService`: `withCredentials: true` on all verbs.
- README: "Google OAuth setup" section (console steps, **root `.env` not `server/.env`** — the server loads the root file).

### Middleware scope decision (prompt-internal conflict, resolved per criterion 12)
The prompt says "apply [authenticate] to every `/api/*` route" AND "v1's existing endpoints aren't gated by the new JWT middleware" + criterion 12 ("v1 unchanged, NO regressions"). Gating `/api/*` would 401 the entire v1 app (no cookie). **The middleware is NOT applied globally** — it protects `/auth/me` and is the opt-in gate for future v2-only routes; v1's `/api` surface gates when v1 retires (pAUTH-07). Documented in the middleware header.

### Bootstrap-admin approach
Chose the **dev-picker path** (option B in the prompt): no `seed-bootstrap-admin.js`. Beth Pizey IS the seeded `ballpark_admin`; a real Google account can be promoted by linking (sign in → row exists → set membership in DB). Self-host bootstrap documentation deferred to the deployment prompt.

## Verify — 17/17 (16 machine-verified, 1 flagged for visual QC)
1. ✓ Tables + columns + indexes in all 3 schemas (migration output; preview/master users healed with audit cols).
2. ✓ `.env.example` documents the set; real values live in root `.env`.
3. ✓ `/auth/me`: 401 bare → full SessionUser with cookie (curl).
4. ✓ `/auth/google` → 302 `accounts.google.com/o/oauth2/v2/auth…` (curl).
5. ◐ Callback handler implemented; cookie+session logic is the same path dev-login proves end-to-end. **The interactive Google consent roundtrip needs a human — please click "Continue with Google" once during QC.**
6. ✓ `/auth/callback?login=ok` → spinner → landed `/` (verified as Ryan).
7. ✓ Hero: "Hello, Sarah Mitchell" / "You are signed in as agency_admin at Creative Agency Ltd".
8. ✓ Sign out → `/login`, avatar gone.
9. ✓ Signed-out `/` → guard bounces to `/login`.
10. ✓ `can()` both sides — "has checkout" chip shows for Sarah (agency_admin), disappears for Beth (ballpark_admin); server uses the same matrix module for role derivation.
11. ✓ Audit: seed/first-user rows stamp `created_at` with `created_by NULL` (no acting user — per criterion's "(or NULL if first user)"); authenticated writes attribute via the ALS hook.
12. ✓ v1 on 4200 unchanged (`[Dev] v1.70a`, renders, no middleware gating).
13. ✓ `ng build` + `ng lint` + dev-serve clean.
14. ✓ 0 `any` in client-v2 src.
15. ✓ Signals + `@if/@for` only; 0 Subjects in new code.
16. ✓ Picker = 4 API users; click → cookie → hard reload → avatar/hero update (Sarah → Beth → Ryan all exercised); `STUB_USERS` gone (grep 0).
17. ✓ `NODE_ENV=production` instance: `/api/dev/users` + `/auth/dev/login` both 403; picker hides via the resource catch → empty → no section.

angular-developer skill: loaded this session (audit invocation) — its `resource()`/inputs/host/DI guidance directly shaped the client code.

pV2-02 flipped to `Done` in `prompts/backlog.md`. Next per the plan: invite flow / onboarding / Settings-Team (pV2-03 territory).
