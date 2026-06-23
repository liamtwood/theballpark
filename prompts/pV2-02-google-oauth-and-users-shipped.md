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

---

## Concerns not in spec (added retroactively on 2026-06-11)

This section was added during pV2-AUDIT-01's retroactive concerns pass. The
original report was silent on these.

### Multi-statement signup write is not transactional (Violation A)
**Where:** `server/src/services/auth.service.js`, brand-new-signup branch of `upsertUserFromGoogle` (~lines 62-79)
**What:** three sequential INSERTs (orgs → users → user_orgs) with no transaction. A failure after the first leaks an orphan `orgs` row (and after the second, an org+user with no membership). I matched the spec's pseudocode shape literally instead of applying the all-or-nothing standard.
**Suggested fix:** wrap via the shared `withTransaction(fn)` helper (pV2-AUDIT-02 Fix 0+2) — NOT hand-rolled BEGIN/COMMIT, because `pool.js`'s per-statement wrapper owns the `app.current_user_id` audit GUC and a naive dedicated-client transaction silently loses attribution.
**Severity:** HIGH

### No rate limiting on any auth-touching endpoint (Violation C)
**Where:** `server/src/routes/auth.js` (all five endpoints), `server/src/routes/dev.js`
**What:** `/auth/google`, `/auth/google/callback`, `/auth/logout`, `/auth/me`, `/auth/dev/login`, `/api/dev/users` shipped with no rate limiting. NODE_ENV gating is not backoff.
**Suggested fix:** `express-rate-limit` per the new WORKING_STANDARDS budgets, plus `app.set('trust proxy', 1)` so per-IP buckets work behind Railway (pV2-AUDIT-02 Fix 4).
**Severity:** MEDIUM

### JWT carries authority claims for 7 days (Violation D — structural, not live)
**Where:** `server/src/routes/auth.js` `signSessionCookie` (~lines 38-49)
**What:** the cookie embeds `role` + `is_admin` with 7-day expiry. Precise current state: **no existing endpoint authorises off the stale claims** — team routes re-read live membership, `/auth/me` re-derives via `buildSession`, dev gates are NODE_ENV-based — so today's blast radius is zero endpoints. The risk is structural: the next endpoint that trusts `req.user.is_admin` makes the staleness window real.
**Suggested fix:** identity-only claims per the new rule; mark existing authority claims `// DEPRECATED` this pass, let `requireActiveMembership` overwrite with live truth (pV2-AUDIT-02 Fixes 1+3).
**Severity:** MEDIUM (structural)

### loadSession() collapses "signed out" and "server down" (Violation E)
**Where:** `client-v2/src/app/core/auth/auth.service.ts`, `loadSession` catch
**What:** all errors → `user = null`. Correct for 401; masks 5xx/network failure as "you're signed out". The spec's "never throws" collapsed two cases; my catch comment couldn't have been written truthfully for the 5xx case.
**Suggested fix:** silent on 401, `console.error` (or future telemetry) on anything else (pV2-AUDIT-02 Fix 7).
**Severity:** LOW

### Permissions MATRIX duplicated with comment-only sync (Violation G)
**Where:** `client-v2/src/app/core/auth/permissions.ts` + `server/src/services/permissions.service.js`
**What:** the five-role × ten-permission map exists on both sides of the wire with a "keep the two in sync" comment and no enforcement. First uncoordinated edit drifts silently.
**Suggested fix:** matrix-parity Vitest spec importing both sides (pV2-AUDIT-02 Fix 6); long-term, serve from the API like brand config.
**Severity:** MEDIUM

### Security-path pure functions shipped untested (Violation H)
**Where:** `permissions.ts` / `permissions.service.js` (`can`, `effectiveRole`, `normalizeOrgType`), `user-avatar` (`deriveInitials`), `auth.guard.ts`
**What:** all pure, all in the security boundary, zero specs despite Vitest being wired.
**Suggested fix:** first spec batch incl. the parity test (pV2-AUDIT-02 Fix 6).
**Severity:** MEDIUM

### Hello page is the last imperative fetch (finding J)
**Where:** `client-v2/src/app/pages/hello/hello.component.ts`
**What:** `ngOnInit` + `subscribe` + manual status signal — the app's only raw `.subscribe`; everything else standardised on `resource()`.
**Suggested fix:** `httpResource` conversion (~10 lines, pV2-AUDIT-02 Fix 8).
**Severity:** LOW

### Additional (spotted during this retroactive pass, beyond the audit list)

### clearCookie options don't mirror the set options
**Where:** `server/src/routes/auth.js`, `POST /auth/logout`
**What:** the cookie is SET with `domain: process.env.JWT_COOKIE_DOMAIN || undefined` but CLEARED without the `domain` option. On localhost this is harmless; in any deployment that sets `JWT_COOKIE_DOMAIN`, logout would fail to clear the cookie (browsers match clear against name+domain+path).
**Suggested fix:** pass the same `domain` (and `secure`) options to `clearCookie` — one line; fold into pV2-AUDIT-02.
**Severity:** MEDIUM (latent — only bites when JWT_COOKIE_DOMAIN is configured)

### Auto-created org names can collide
**Where:** `upsertUserFromGoogle` branch 3
**What:** `"{displayName}'s Workspace"` is not unique — two signups named "Sam Jones" produce two identically-named orgs (`orgs.name` has no unique constraint). Harmless today, confusing in admin views.
**Suggested fix:** none needed now — the onboarding prompt (pV2-02b territory) removes auto-creation entirely; noting so the successor design accounts for name collisions.
**Severity:** LOW (moot pending onboarding)

### No session rotation/refresh
**Where:** `signSessionCookie`
**What:** fixed 7-day JWT, no sliding renewal and no revocation list — logout clears the cookie but the token itself stays valid if exfiltrated until expiry.
**Suggested fix:** acceptable for v1 (httpOnly + Lax mitigates); revisit with a session table or shorter expiry + refresh when auth hardens.
**Severity:** LOW
