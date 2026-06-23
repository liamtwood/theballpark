# pV2-02 — Google OAuth + Users + Roles

## Read first

1. `WORKING_STANDARDS.md`
2. `prompts/cc-onboarding.md`
3. `prompts/auth-and-users-plan.md` (the auth plan — auth provider, role taxonomy, permissions, login UX, build order)
4. `prompts/auth-and-users-one-pager.html` (visual reference for stakeholder view)
5. `prompts/pV2-01-scaffold-client-v2-shipped.md` (confirm scaffold is in place)
6. This prompt

## Goal

Wire real Google OAuth login to `client-v2/`. Persist authenticated users in
Postgres with role-per-membership. Replace the placeholder login + auth-callback
pages with working flows. Server gets a `/auth/google/*` endpoint pair, a JWT
middleware, and the new `users` + `user_orgs` tables. Frontend gets a
`AuthService` signal that drives the whole app's session state.

After this lands a user can: open `/login` → click "Continue with Google" →
sign in → land at `/` with a logged-in session → see their name + org name in
the UI.

**v1 simplifying assumption** (from the auth plan): Google OAuth ONLY. No Magic
Link, no email/password, no MFA. Magic Link slots in later.

## Locked scope

- Auth provider: **direct Google OAuth via `passport-google-oauth20`** (no Supabase Auth, no Auth0, no Clerk)
- JWT in **HTTP-only cookie** (`SameSite=Lax`, `Secure` in prod)
- Schema: **new tables `users` + `user_orgs`** per the auth plan; mirror across all three schemas via `migrate-schemas.js`
- Role model: **`user_orgs.is_admin` boolean flag** combined with **`orgs.type`** (`agency` / `supplier` / `ballpark`). Effective role = `(orgType, isAdmin)` → one of `agency_admin` / `agency_member` / `supplier_admin` / `supplier_member` / `ballpark_admin`. No 5-enum column — derived in the permissions helper.
- Multi-org schema, single-org UX (no org switcher in nav this prompt)
- Onboarding: new self-signups become **agency_admin of a new org** by default. Joining existing orgs only happens via invite (deferred to a later prompt).
- Permissions matrix: codified in `client-v2/src/app/core/auth/permissions.ts` + mirrored in `server/src/services/permissions.service.js`. RBAC, `can(role, perm)` helper.

## Schema changes — write to `migrate-schemas.js`

```sql
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT UNIQUE NOT NULL,          -- Google's stable user identifier
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  default_org_id UUID,                       -- which org to land in on login
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  deleted_by UUID
);

CREATE TABLE IF NOT EXISTS public.user_orgs (
  user_id   UUID NOT NULL REFERENCES public.users(id),
  org_id    UUID NOT NULL REFERENCES public.orgs(id),
  is_admin  BOOLEAN NOT NULL DEFAULT false,    -- one flag per membership; combine with org.type for effective role
  job_title TEXT,                              -- e.g. "Account Manager" — display only
  status    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended')),
  invited_by_user_id UUID REFERENCES public.users(id),
  invited_at TIMESTAMPTZ,
  joined_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  deleted_by UUID,
  PRIMARY KEY (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS user_orgs_user_id_idx ON public.user_orgs (user_id);
CREATE INDEX IF NOT EXISTS user_orgs_org_id_idx  ON public.user_orgs (org_id);
```

Mirror identically to `preview.*` and `master.*` per the established pattern.
Junction = `user_orgs` (still gets soft-delete columns per WORKING_STANDARDS even
though it's a junction — `user_orgs` is a richer membership, not a pure FK
junction, so soft-delete semantics matter).

## Server-side

### 1. Dependencies

```bash
cd server
npm install passport passport-google-oauth20 jsonwebtoken cookie-parser
npm install --save-dev @types/passport @types/passport-google-oauth20 @types/jsonwebtoken
```

### 2. New env vars

Add to `.env.example`:
```bash
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3001/auth/google/callback
JWT_SECRET=                # long random string
JWT_COOKIE_DOMAIN=         # leave empty for localhost
JWT_COOKIE_SECURE=false    # true in prod
WEB_BASE_URL=http://localhost:4201   # for post-login redirect
```

### 3. Routes — `server/src/routes/auth.js` (new)

Endpoints:
- `GET /auth/google` — redirect to Google OAuth
- `GET /auth/google/callback` — handle Google's redirect; upsert user + membership; sign JWT cookie; redirect to `WEB_BASE_URL/?login=ok`
- `POST /auth/logout` — clear cookie, 204
- `GET /auth/me` — return current user + active org + role (reads JWT cookie)

Mount under `/auth/*` (NOT `/api/auth/*` — keeps auth surface distinct).

### 4. JWT middleware — `server/src/middleware/authenticate.js` (new)

- Reads `bp_session` cookie
- Verifies JWT signature with `JWT_SECRET`
- Populates `req.user = { id, email, org_id, role }`
- Calls `next()` if valid, returns 401 if not
- Sets `app.current_user_id` PG session var on the pool connection so the audit trigger works

Apply to every `/api/*` route. NOT to `/auth/*` routes.

### 5. Upsert logic — `server/src/services/auth.service.js` (new)

`upsertUserFromGoogle(profile)`:
1. Look up by `google_sub`. If found → update `display_name`, `avatar_url` from Google, set `updated_at`.
2. If not found → look up by `email`. If found → set `google_sub` (linking flow).
3. If still not found → create `users` row, create new `orgs` row (`name = profile email's domain or "{display_name}'s Workspace"`, `org_type = 'agency'`), create `user_orgs` row with `is_admin = true` (so first signup becomes the org admin), set `users.default_org_id` to the new org.
4. Return `{ user, activeOrgId, role }` for JWT signing.

### 6. Permissions helper — `server/src/services/permissions.service.js` (new)

Mirror of the client matrix. `can(orgType, isAdmin, perm)` helper. Used by route handlers when checking write-side authorization.

Effective role is derived from `(orgType, isAdmin)`:
```js
function effectiveRole(orgType, isAdmin) {
  if (orgType === 'ballpark') return 'ballpark_admin';   // ballpark org members are always admins
  if (orgType === 'agency')   return isAdmin ? 'agency_admin'   : 'agency_member';
  if (orgType === 'supplier') return isAdmin ? 'supplier_admin' : 'supplier_member';
  throw new Error(`Unknown org type: ${orgType}`);
}

const MATRIX = {
  ballpark_admin:  ['admin.cross_org_view'],
  agency_admin:    ['org.invite_member', 'org.manage_billing', 'project.create', 'project.delete', 'item.create', 'item.delete', 'inbox.reply', 'inbox.adjust_cost', 'cart.checkout'],
  agency_member:   ['project.create', 'item.create', 'inbox.reply', 'inbox.adjust_cost', 'cart.checkout'],
  supplier_admin:  ['org.invite_member', 'org.manage_billing', 'item.create', 'item.delete', 'inbox.reply', 'inbox.adjust_cost'],
  supplier_member: ['item.create', 'inbox.reply', 'inbox.adjust_cost'],
};

function can(orgType, isAdmin, perm) {
  return MATRIX[effectiveRole(orgType, isAdmin)].includes(perm);
}
```

### 7. Existing dev data

The existing `client-angular/` v1 app uses a dev-only persona switcher with hardcoded user UUIDs. **Don't touch it.** v1 continues to work via its own plumbing on port 4200. The new auth lives ENTIRELY in `client-v2/` + the new server endpoints; v1's existing endpoints aren't gated by the new JWT middleware.

This is reversible later — when v1 is retired, the persona switcher goes too.

## Frontend (`client-v2/`)

### 1. New: `AuthService` (signal-based)

`src/app/core/auth/auth.service.ts`:

```typescript
import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from '../api.service';
import { Router } from '@angular/router';

export type OrgType = 'agency' | 'supplier' | 'ballpark';
export type Role =
  | 'ballpark_admin' | 'agency_admin' | 'agency_member'
  | 'supplier_admin' | 'supplier_member';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  activeOrgId: string;
  activeOrgName: string;
  activeOrgType: OrgType;
  isAdmin: boolean;
  /** derived from (activeOrgType, isAdmin); kept on session for convenience */
  role: Role;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api    = inject(ApiService);
  private router = inject(Router);

  private _user = signal<SessionUser | null>(null);
  readonly user        = this._user.asReadonly();
  readonly isLoggedIn  = computed(() => this._user() !== null);
  readonly role        = computed(() => this._user()?.role ?? null);

  async loadSession(): Promise<void> {
    try {
      const u = await firstValueFrom(this.api.get<SessionUser>('/auth/me'));
      this._user.set(u);
    } catch {
      this._user.set(null);
    }
  }

  loginWithGoogle(): void {
    // Hard redirect to /auth/google on the API host
    const apiBase = inject(RuntimeConfigService).get().apiBaseUrl;
    window.location.href = `${apiBase}/auth/google`;
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.api.post('/auth/logout', {}));
    this._user.set(null);
    this.router.navigate(['/login']);
  }
}
```

### 2. Permissions helper — `src/app/core/auth/permissions.ts`

Mirror of the server matrix + `can(role, perm)` helper:

```typescript
import { Role } from './auth.service';

export type Permission =
  | 'org.invite_member' | 'org.manage_billing'
  | 'project.create' | 'project.delete'
  | 'item.create'    | 'item.delete'
  | 'inbox.reply'    | 'inbox.adjust_cost'
  | 'cart.checkout'
  | 'admin.cross_org_view';

const MATRIX: Record<Role, Permission[]> = { /* same as server */ };
export function can(role: Role | null, perm: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].includes(perm);
}
```

Used in templates: `@if (can(authService.role(), 'cart.checkout')) { <button>Checkout</button> }`

### 3. Bootstrap order

In `main.ts`, load runtime config FIRST (existing from pV2-01), then attempt
`authService.loadSession()` so the app boots with the session populated if the
user has a valid cookie. If no session → routes that require auth redirect to
`/login`.

### 4. Login page

`src/app/pages/login/login.component.ts` — REPLACE the pV2-01 placeholder.

UX:
- Centred card
- Title "Sign in to Ballpark"
- Subtitle "Continue with Google to access your account"
- Single button: `[ Continue with Google ]` (PrimeNG `<p-button>`, branded with the `--theme-accent`)
- On click → `authService.loginWithGoogle()`

OnPush, signals, `@if` for any conditional rendering.

### 5. Auth callback page

`src/app/pages/auth-callback/auth-callback.component.ts` — REPLACE the pV2-01 placeholder.

UX:
- Show "Signing you in…" spinner for ~1s
- Behind the scenes: `authService.loadSession()`
- On success → router.navigate(['/'])
- On failure → router.navigate(['/login'], { queryParams: { error: 'auth_failed' } })

Reached when Google redirects to the API's callback URL, which after upsert
redirects to `WEB_BASE_URL/auth/callback?login=ok` so the SPA can pick up the
session.

### 6. Hello page update

The pV2-01 hello page should now:
- Read `authService.user()` signal
- If logged in: show "Hello {displayName} — you're signed in as {role} at {activeOrgName}"
- If not: show "Welcome — [Sign in]" with the sign-in link

This proves the session signal works end-to-end.

### 7. Route guards (lightweight)

`src/app/core/auth/auth.guard.ts`:
- Functional guard
- Reads `authService.isLoggedIn()`
- If logged in → allow
- If not → return UrlTree to `/login`

Apply to ALL routes except `/login` and `/auth/callback`.

## Bootstrap config — seed admin

For initial setup (no users yet), CC adds a one-time script:

`server/src/db/seed-bootstrap-admin.js` — reads `BOOTSTRAP_ADMIN_EMAIL` env var,
creates a Ballpark-admin user + Ballpark org + membership. Run once during
local setup, also documents how a customer self-host would bootstrap.

Not required to ship in this prompt if dev workflow is "sign in with your own
Google account and we promote you in DB manually". CC's call — document
whichever path she picks.

## Acceptance criteria

1. **Schema**: new tables exist in all three schemas. `\d public.users` and `\d public.user_orgs` show all columns + indexes.
2. **Google OAuth env vars** are documented in `.env.example`. Real values in `.env` (you'll need to set up a Google OAuth client in console.cloud.google.com — see "Setup notes" below).
3. **`/auth/me`** returns 401 when no cookie, returns `SessionUser` JSON when valid cookie.
4. **`/auth/google`** redirects to Google OAuth consent screen.
5. **`/auth/google/callback`** receives Google's callback, upserts user + org + membership, sets `bp_session` cookie, redirects to `http://localhost:4201/auth/callback?login=ok`.
6. **`/auth/callback`** on the SPA spins for ~1s, then lands at `/`.
7. **Hello page** (when logged in) shows "Hello {your-google-name} — you're signed in as agency_admin at {default org name}".
8. **Sign out** clears the cookie + redirects to `/login`.
9. **Route guards** redirect unauthenticated users away from `/` to `/login`.
10. **`can()` helpers** work both client and server side — verifiable by adding a temporary `@if (can(role, 'cart.checkout')) { <span>has checkout</span> }` on the hello page.
11. **Audit trigger**: any insert in the new user upsert flow correctly stamps `created_by` with the upserter's id (or NULL if first user).
12. **Old `client-angular/`** on port 4200 still works unchanged. Its persona switcher still functions. NO regressions.
13. **`ng build`** in `client-v2/` clean. **`npm start`** clean. No TS errors, no lint errors.
14. **No `any` types** in new auth code anywhere.
15. **All new code uses signals + @if/@for**, not RxJS Subjects + `*ngIf`.
16. **Dev picker swap**: `/api/dev/users` returns the 4 seeded users; clicking one in the `/login` picker calls `/auth/dev/login`, sets the cookie, hard-reloads to `/`, and the avatar/hero update to show the picked user. The pV2-01b stub `STUB_USERS` constant is gone.
17. **Prod safety**: starting the server with `NODE_ENV=production` makes `/api/dev/users` and `/auth/dev/login` return 403; the login page renders Google-only with no dev picker section visible.

## Setup notes (CC writes these to README)

In a new section "Google OAuth setup" of `client-v2/README.md`:

1. Go to https://console.cloud.google.com → create project (or use existing)
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Type: Web application
4. Authorised JS origins: `http://localhost:4201` (dev), production URL later
5. Authorised redirect URIs: `http://localhost:3001/auth/google/callback`
6. Copy Client ID + Secret into `server/.env`

## Dev user picker — replace pV2-01b's stub

pV2-01b shipped `AuthService` with a hardcoded array of 4 stub users (Sarah,
Beth, Ryan, Alex). This prompt replaces that with real DB + endpoints.

### Seed script — `server/src/db/seed-dev-users.js`

Idempotent. Creates four users + their orgs + memberships matching what
pV2-01b stubbed. Safe to re-run. Pseudocode:

```javascript
const DEV_USERS = [
  { email: 'sarah@creative-agency.example',  displayName: 'Sarah Mitchell',
    orgName: 'Creative Agency Ltd', orgType: 'agency',   isAdmin: true },
  { email: 'alex@creative-agency.example',   displayName: 'Alex Martin',
    orgName: 'Creative Agency Ltd', orgType: 'agency',   isAdmin: false },
  { email: 'beth@ballpark.example',          displayName: 'Beth Pizey',
    orgName: 'Ballpark',            orgType: 'ballpark', isAdmin: true },
  { email: 'ryan@rocketfood.example',        displayName: 'Ryan Chen',
    orgName: 'Rocket Food',         orgType: 'supplier', isAdmin: true },
];

// For each: upsert orgs (by name), upsert users (by email), upsert user_orgs.
// Sarah + Alex share Creative Agency Ltd org. Others get their own.
// google_sub stays NULL — these users haven't signed in via Google.
// status = 'active'. is_admin from spec.
```

Run via `npm run seed:dev-users` after migrations. Only intended for dev DBs.

### New endpoints

**`GET /api/dev/users`** — dev-only.
- Returns the list of users where `google_sub IS NULL` (i.e., seed users) so
  prod accounts never leak through this endpoint even if it's exposed
- Returns 403 in prod (gate by `NODE_ENV !== 'development'`)
- Response: `Array<{ id, email, displayName, activeOrgName, activeOrgType, isAdmin, role }>`

**`POST /auth/dev/login`** — dev-only.
- Body: `{ userId: string }`
- Validates user is in the dev-seed pool (`google_sub IS NULL`) — prevents
  impersonating real Google-authed accounts even in dev
- Signs JWT cookie identical in shape to the Google callback's cookie
- Returns 204 (client does its own hard reload)
- Returns 403 in prod

### Client — `AuthService` updates

In pV2-01b, `AuthService` had:
```typescript
private _user = signal<SessionUser | null>(STUB_USERS[0]);
listDevUsers(): SessionUser[] { return STUB_USERS; }
devLogin(userId: string): void { /* in-memory */ }
```

Replace with real HTTP-backed versions:
```typescript
private _user = signal<SessionUser | null>(null);    // null until loadSession()

async listDevUsers(): Promise<SessionUser[]> {
  return firstValueFrom(this.api.get<SessionUser[]>('/api/dev/users'));
}

async devLogin(userId: string): Promise<void> {
  await firstValueFrom(this.api.post('/auth/dev/login', { userId }));
  window.location.href = '/';   // hard reload — fresh session, no leaked state
}
```

The `STUB_USERS` constant gets deleted entirely. The login page already calls
`auth.listDevUsers()` per pV2-01b — that call now hits the API. If the
endpoint returns 403 (prod), the picker section auto-hides.

### Login page treatment in prod

When `/api/dev/users` returns 403:
- Picker section doesn't render (already the pV2-01b behaviour — empty list = no section)
- Only "Continue with Google" button visible
- No code branch needed; the existing render logic handles it

## Out of scope

- Magic Link / email / passwords (deferred per auth plan)
- Invite flow (separate prompt — pV2-03 will cover)
- Onboarding flow (`/onboarding` page with role + company name) — separate prompt
- Org switcher UI (multi-org schema supports it, UX deferred)
- MFA, SCIM, SAML
- Admin UI for managing users / roles (Settings → Team — separate prompt)
- Migration of v1 dev users (no — we agreed to reset when auth lands)
- Touching `client-angular/`
- Touching v1's existing `req.user.org_id` pattern (separate ecosystem; ignore)

## Bump + ship

1. Bump `client-v2/src/environments/environment.ts` chip to `[Dev v2] v2.01a`
2. Bump `server/.env` version note if you maintain one there
3. Commit messages should follow the pattern in cc-onboarding
4. Push to dev
5. Write `prompts/pV2-02-google-oauth-and-users-shipped.md` ship report
6. Flip pV2-02 in `prompts/backlog.md` to Done

## Reply with

- Commit SHAs (likely several — schema migration, server auth routes, client auth service, login page, etc.)
- 15/15 acceptance criteria ticked or noted
- Confirmation old app on 4200 still works
- Brief note on bootstrap admin approach you chose
- Anything non-trivial decided in implementation
