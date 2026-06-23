# pV2-02b — Public landing page + onboarding flow

## Read first

1. `WORKING_STANDARDS.md` (with the Engineering hygiene section landed via AUDIT-01)
2. `prompts/cc-onboarding.md`
3. `prompts/pV2-02-google-oauth-and-users-shipped.md` (Google upsert step 3 — what this replaces)
4. `prompts/pV2-AUDIT-02-code-fixes-shipped.md` (uses `withTransaction` and `requireActiveMembership` from here)
5. `prompts/auth-and-users-plan.md` (the model and language)
6. This prompt

## Why this prompt exists

Two related entry-flow problems shipped in pV2-02:

1. **No public landing page** — `/` was the hello/dashboard surface; anonymous
   visitors land at `/login` (a form, not a front door).
2. **Auto-create-an-org magic** — pV2-02 auto-created `{displayName}'s Workspace`
   for every brand-new Google signup with no pending invite, behind the user's
   back. AUDIT-01 documented this as the audit's #2 "MUST FIX" finding
   (behavioral).

This prompt fixes both as one coherent user story:

```
PUBLIC                          AUTHENTICATED
─────────────────────           ──────────────────────
/  (Ballpark home, NEW)         /home   (was '/')
  Header: [Ballpark]              Header: [Ballpark]  [avatar]
           [Sign In →]            Body: hero + content
  Body:    [Sign Up →]
                                /onboarding  (orgless only)
                                  One screen: type + org name
                                  → /home
```

After this ships:
- Anonymous user lands at `/` → sees Ballpark branding + Sign In (header) and Sign Up (body) CTAs
- Both CTAs go to the same `/auth/google` endpoint — the framing differs, the flow doesn't
- Server upsert handles new vs existing
- Has-org users land at `/home`; orgless users land at `/onboarding`
- Onboarding is one screen: pick type, name org, submit
- The `/login` URL keeps working (mainly for dev-picker access via the dev list);
  if hit from a marketing link it redirects to `/`

Anything beyond this — marketing copy on the landing page, plan picker, "join
existing org" wizard — is a future prompt.

## Spec-hygiene precedence note (per AUDIT-01 Rule 9)

If anything in this prompt's pseudocode or markup violates §"Engineering
hygiene" (transactions / tokens / catch-block justification / etc.), CC
implements the compliant version and flags the deviation in the ship report
under "Spec-hygiene precedence deviations." This is mandatory, not a liberty.

## What changes

### Section A — Public landing page (the front door)

#### A1. Route restructure

Today: `/` → hello/dashboard; `/login` → Google + dev picker. After this prompt:

| Route | Purpose | Auth required? |
|---|---|---|
| `/` | Public landing page (Ballpark home) | No |
| `/login` | Dev picker access — redirects to `/` for non-dev requests OR renders the dev picker in dev mode | No |
| `/home` | Existing shell content (the current hello surface, eventual dashboard) | Yes + has-org |
| `/onboarding` | New onboarding form | Yes + orgless |
| Any other shell child (e.g. `/settings/team`) | Existing pages | Yes + has-org |

`app.routes.ts`:

```typescript
import { Routes } from '@angular/router';
import { needsOnboardingGuard } from './core/auth/needs-onboarding.guard';
import { requiresOrgGuard } from './core/auth/requires-org.guard';

export const routes: Routes = [
  // PUBLIC
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'login',
    // Dev picker route. In prod the picker section auto-hides via the resource catch;
    // see also LoginComponent's existing redirect to '/' when listDevUsers() returns 403.
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./pages/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent),
  },
  // ORGLESS (signed in, no membership yet)
  {
    path: 'onboarding',
    canActivate: [needsOnboardingGuard],
    loadComponent: () => import('./pages/onboarding/onboarding.component').then(m => m.OnboardingComponent),
  },
  // AUTHENTICATED SHELL (signed in + has-org)
  {
    path: '',
    canActivate: [requiresOrgGuard],
    component: AppShellComponent,
    children: [
      { path: 'home', loadComponent: () => import('./pages/hello/hello.component').then(m => m.HelloComponent) },
      // existing children: settings/team, etc.
    ],
  },
  { path: '**', redirectTo: '' },
];
```

Note `/home` is now where the hello page lives — was `/`. Update any internal
links (`AuthService.devLogin`'s hard-reload, the `app-shell` navigate-on-logo,
`/auth/callback` post-success target) to navigate to `/home`, not `/`.

#### A2. `LandingComponent` (`pages/landing/landing.component.ts`)

Minimal, brand-forward. NO marketing copy beyond a tagline. Standalone, OnPush,
`host:` binding per v2 standard, token-only colors per the AUDIT-02 palette.

Structure:

```html
<header class="landing-header">
  <a routerLink="/" class="wordmark">Ballpark</a>
  <a class="signin-link" (click)="loginWithGoogle()" role="button" tabindex="0">
    Sign In
  </a>
</header>

<main class="landing-hero">
  <h1>Plan events with the right suppliers.</h1>
  <p class="text-secondary">
    Ballpark connects agencies and suppliers — build estimates, send briefs,
    close deals. Free to start.
  </p>
  <p-button label="Sign Up — it's free" size="large" (onClick)="loginWithGoogle()" />
</main>
```

The tagline and lede are placeholders Liam can refine; CC ships them as written
above and Liam edits in a copy-tweak prompt later if he wants different words.

Both `Sign In` and `Sign Up` call `AuthService.loginWithGoogle()` — the
same endpoint. The framing is UI-only.

Use only token-backed classes (`text-secondary`, etc.) — no raw colors. CSS
host binding on the component sets a full-viewport background using the
brand gradient or theme tokens.

#### A3. Update `LoginComponent`

Currently `/login` is the primary entry. Keep the component (dev picker still
needs a home) but:
- If `listDevUsers()` resource returns empty (prod) → redirect to `/`
- Layout matches the LandingComponent's chrome (header with Ballpark wordmark
  + Sign In link), so visiting `/login` directly in prod doesn't feel like a
  broken page during the transition

#### A4. Update `AppShellComponent`

The Ballpark wordmark in the shell header today routes to `/`. Update to
route to `/home` so authenticated users go to the right place when they click
the logo (anonymous users on `/home` don't exist — `requiresOrgGuard` bounces
them).

### Section B — Server

#### 1. Modify `upsertUserFromGoogle` step 3

Current step 3 (lines 62-79 of `auth.service.js`) creates orgs + users +
user_orgs and returns the new userId. After this prompt, step 3 creates the
users row ONLY (no org, no membership) — uses a transaction via
`withTransaction(fn)` even though it's a single insert today, so future
additions don't reintroduce hand-rolled writes.

```javascript
// Step 3: brand-new signup → user row ONLY. Org + membership are created
// via /api/onboarding/create-org after the user picks Agency or Supplier.
return withTransaction(async (client) => {
  const r = await client.query(
    `INSERT INTO users (name, display_name, email, google_sub, avatar_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [displayName, displayName, email, sub, avatarUrl]
  );
  return { userId: r.rows[0].id };
});
```

Note the absence of `role` and `default_org_id` — both stay NULL until the
user completes onboarding. The v1 `role` column on `users` is legacy; v2 reads
authority from `user_orgs.is_admin` exclusively (per AUDIT-01's "JWT carries
identity, not authority" rule + Fix 1's middleware), so leaving `users.role`
NULL on v2-created users is correct.

#### 2. Modify `buildSession` to allow orgless users

Today `buildSession` returns `null` when a user has no active membership,
which `/auth/me` translates to 401 "No active membership" — the SPA reads that
as "signed out." But an orgless user IS signed in; they just need onboarding.

Update `buildSession` so it returns the user shape with `activeOrgId`,
`activeOrgName`, `activeOrgType`, `isAdmin`, `role` all set to `null` when
there's no active membership. `/auth/me` returns the full payload either way.

```javascript
async function buildSession(userId) {
  const r = await pool.query(/* same query as before */);
  if (!r.rows.length) {
    // No active membership — orgless authenticated user (needs onboarding).
    const u = await pool.query(
      `SELECT id, email, COALESCE(display_name, name) AS display_name, avatar_url
         FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (!u.rows.length) return null; // truly unknown user
    const row = u.rows[0];
    return {
      id: row.id, email: row.email, displayName: row.display_name,
      avatarUrl: row.avatar_url,
      activeOrgId: null, activeOrgName: null, activeOrgType: null,
      isAdmin: false, role: null,
    };
  }
  // existing membership path unchanged
}
```

`/auth/me` keeps its 401 only for truly unknown users (`buildSession` returns
`null`). Orgless authenticated users get a 200 with the partial session.

#### 3. New endpoint: `POST /api/onboarding/create-org`

`server/src/routes/onboarding.js`:

```javascript
const router = require('express').Router();
const { authenticate } = require('../middleware/authenticate');
const { withTransaction } = require('../db/with-transaction');
const { buildSession } = require('../services/auth.service');
const { signSessionCookie } = require('../routes/auth-cookie'); // see "extract this" below

const ORG_TYPES = new Set(['agency', 'supplier']);
const NAME_MAX = 100;
const NAME_MIN = 2;

router.post('/create-org', authenticate, async (req, res, next) => {
  try {
    const { orgType, orgName } = req.body || {};
    if (!ORG_TYPES.has(orgType)) {
      return res.status(400).json({ error: 'orgType must be "agency" or "supplier"' });
    }
    const name = String(orgName || '').trim();
    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      return res.status(400).json({ error: `Org name must be ${NAME_MIN}-${NAME_MAX} chars` });
    }

    // Reject if the user already has an active membership.
    const existing = await pool.query(
      `SELECT 1 FROM user_orgs
        WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      [req.user.id]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'You already belong to an organisation' });
    }

    const { sessionUser } = await withTransaction(async (client) => {
      const org = await client.query(
        `INSERT INTO orgs (name, type) VALUES ($1, $2) RETURNING id`,
        [name, orgType]
      );
      const orgId = org.rows[0].id;
      await client.query(
        `INSERT INTO user_orgs (user_id, org_id, is_admin, status, joined_at)
         VALUES ($1, $2, true, 'active', NOW())`,
        [req.user.id, orgId]
      );
      await client.query(
        `UPDATE users SET default_org_id = $2 WHERE id = $1`,
        [req.user.id, orgId]
      );
      const sessionUser = await buildSession(req.user.id);
      return { sessionUser };
    });

    // Refresh the cookie so JWT identity claims carry the new org_id.
    signSessionCookie(res, sessionUser);
    res.json(sessionUser);
  } catch (err) { next(err); }
});

module.exports = router;
```

**Extract `signSessionCookie`** (currently in `routes/auth.js`) into
`routes/auth-cookie.js` (or `services/auth-cookie.service.js`) so onboarding
can refresh the cookie without circular imports. One Definition.

Mount the router at `/api/onboarding` in `index.js`. **NOT** under the v2
router that applies `requireActiveMembership` — orgless users hit this
endpoint by definition.

### Section C — Client (onboarding + types + guards)

#### 4. Update `SessionUser` type to allow orgless

`client-v2/src/app/core/auth/auth.service.ts`:

```typescript
export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  // Null until onboarding completes — orgless authenticated users see /onboarding.
  activeOrgId: string | null;
  activeOrgName: string | null;
  activeOrgType: OrgType | null;
  isAdmin: boolean;
  role: Role | null;
}
```

Add `hasActiveOrg` computed:

```typescript
readonly hasActiveOrg = computed(() => !!this._user()?.activeOrgId);
```

#### 5. Two route guards

`client-v2/src/app/core/auth/needs-onboarding.guard.ts` (apply to `/onboarding`):

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Bounces users who already HAVE an active org back to /home. */
export const needsOnboardingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn() && !auth.hasActiveOrg()) return true;
  return router.createUrlTree(['/home']);
};
```

`client-v2/src/app/core/auth/requires-org.guard.ts` (apply to every shell route):

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Bounces orgless authenticated users to /onboarding. */
export const requiresOrgGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  if (!auth.hasActiveOrg()) return router.createUrlTree(['/onboarding']);
  return true;
};
```

Apply `requiresOrgGuard` to the SHELL parent route (where `authGuard`
currently sits) — it supersedes `authGuard` because it covers both the
signed-out and orgless cases.

#### 6. `/onboarding` route

`client-v2/src/app/pages/onboarding/onboarding.component.ts`:

- Pure-bleed route (no shell, no hero) — full-screen centred card
- Standalone, OnPush, signals + `host:` binding per v2 standard
- Reactive form with typed `FormGroup`:
  ```typescript
  interface OnboardingForm {
    orgType: FormControl<'agency' | 'supplier'>;
    orgName: FormControl<string>;
  }
  ```
- Default `orgType = 'agency'`
- Default `orgName` computed from `auth.user()?.displayName`:
  - Has displayName with a space → take token before first space + suffix
    (e.g., "Liam Wood" → "Liam's Agency")
  - displayName with no space → use whole displayName
  - No displayName → use email local-part (e.g., `liam.wood` → "liam.wood's Agency")
  - Empty signal → empty field, user fills in
- `(change)` on the radio swaps the suffix in the pre-filled name (only if the
  user hasn't touched the field — preserve their edits)
- Submit button disabled when:
  - `orgName.length < 2` OR `orgName.length > 100`
  - `inviteInFlight()` (loading state)
- Submit calls `OnboardingService.createOrg({ orgType, orgName })`:
  - On success: hard-reload `/` (same pattern as `devLogin` and Google login —
    fresh app, fresh signals, fresh session)
  - On 4xx error: toast the server message
  - On 5xx error: toast "Something went wrong. Please try again." + console-warn the error

`OnboardingService`:

```typescript
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private api = inject(ApiService);
  createOrg(payload: { orgType: 'agency' | 'supplier'; orgName: string }) {
    return this.api.post<SessionUser>('/api/onboarding/create-org', payload);
  }
}
```

#### 7. Layout sketch (compliant with the token set)

```html
<div class="onboarding-page">
  <article class="onboarding-card">
    <h1>Set up your organisation</h1>
    <p class="text-secondary">Pick the type that fits, name it, and you're in.
    You can rename later in Settings.</p>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <fieldset class="type-tiles">
        <label class="type-tile" [class.type-tile--selected]="form.controls.orgType.value === 'agency'">
          <input type="radio" formControlName="orgType" value="agency" hidden>
          <strong>Event Agency</strong>
          <span class="text-secondary text-sm">
            Produce events. Build estimates, browse suppliers, send leads.
          </span>
        </label>
        <label class="type-tile" [class.type-tile--selected]="form.controls.orgType.value === 'supplier'">
          <input type="radio" formControlName="orgType" value="supplier" hidden>
          <strong>Supplier</strong>
          <span class="text-secondary text-sm">
            Supply products or services. Upload your catalogue, receive leads.
          </span>
        </label>
      </fieldset>

      <label class="field">
        <span class="field-label">Organisation name</span>
        <input type="text" formControlName="orgName" maxlength="100" />
        <span class="field-hint text-secondary text-xs">
          e.g. Anchor Events, Studio Volta, Webb &amp; Co.
        </span>
      </label>

      <p-button label="Create Organisation →" type="submit"
                [disabled]="form.invalid || inviteInFlight()" />
    </form>
  </article>
</div>
```

CSS uses only token-backed classes (`text-secondary`, semantic tokens for
selected state). Type tile selected state uses `--theme-soft` background +
`--theme-accent` border. No raw colors.

#### 8. Routes update

Already covered in Section A1 above — the full route table includes the
public landing, /home (auth shell), /onboarding (orgless), and the existing
/auth/callback + /login routes.

## Edge cases handled

| Scenario | Behaviour |
|---|---|
| Anonymous visitor types `/` | Sees the public landing page |
| Anonymous visitor types `/home` | `requiresOrgGuard` sees `!isLoggedIn` → redirects to `/login` |
| Authenticated has-org user types `/` | Sees the public landing page (intentional — no auto-redirect for now; the header's Sign In button takes them through OAuth which round-trips back to `/home`). Acceptable for v1; we can add an auto-redirect later if it bothers people. |
| Authenticated orgless user types `/` | Sees the public landing page (same) |
| New Google signup, no invite | OAuth → `/auth/callback?login=ok` → `loadSession()` sees `activeOrgId: null` → SPA navigates to `/onboarding`. Picks type + name. Lands at `/home`. |
| New Google signup, pending invite for the email | pV2-02's email-link flow activates the invite BEFORE `buildSession` runs. User has `activeOrgId`. `requiresOrgGuard` lets them through to `/home`. Never sees onboarding. |
| User on `/onboarding` refreshes after submitting | `needsOnboardingGuard` bounces to `/home`. |
| Orgless user typing `/team` in the URL bar | `requiresOrgGuard` bounces to `/onboarding`. |
| Orgless user with no cookie typing `/onboarding` | `needsOnboardingGuard` sees `!isLoggedIn` → also bounces (to `/home` per the guard's return); the shell route's chain then bounces to `/login`. Two hops but correct. |
| Server restart mid-form | Submit gets a 401 (cookie expired) → catch surfaces "Please sign in again" + redirect to `/login`. |
| Duplicate org names | Allowed — `orgs.name` has no unique constraint and won't until pV2-XX. Liam's call. |
| Empty / whitespace org name | Server 400 + client validation. Min 2 / max 100. |

## Out of scope

- "Join an existing organisation" path (invite UX from screen 1 of the prototype) — pV2-02's email-link path covers actual invites; explicit "I have a code" UX deferred
- Plan picker (screen 3) — subscription flow lives in Settings → Subscription
- Org name uniqueness enforcement — separate prompt
- Org logo upload during onboarding — Settings → Organisation later
- Bulk-invite team members during onboarding — Settings → Team later
- Internationalisation of pre-filled name suffix — defer

## Acceptance

### Landing page
0a. Visit `http://localhost:4201/` while logged out → renders the public landing page (Ballpark wordmark + Sign In link in header, Sign Up CTA in body). NO avatar circle. NO shell hero. Page is public — no auth check, no redirect.
0b. Click "Sign In" in header → redirects to Google OAuth (same as `loginWithGoogle()`).
0c. Click "Sign Up — it's free" in body → redirects to Google OAuth (same endpoint).
0d. Visiting `/login` in dev → renders the existing dev picker page (dev list visible).
0e. Visiting `/login` in prod (when `listDevUsers()` returns 403/empty) → redirects to `/`.
0f. Shell's Ballpark wordmark routes to `/home`, not `/`.

### Onboarding
1. New Google account (no prior user row) signs in → lands at `/onboarding`, NOT `/home`.
2. Form pre-fills `orgName` with `{firstName}'s Agency` (or supplier-suffix when radio flipped).
3. Switching the type radio swaps the suffix IF the user hasn't manually edited the name field; once edited, the radio stops mutating it.
4. Server creates `orgs` row + `user_orgs` row atomically via `withTransaction` — verified by manually killing the connection mid-call (or forcing the INSERT to fail) and confirming no orphan `orgs` row.
5. Server sets `default_org_id` on the user in the same transaction.
6. New JWT cookie is issued with the fresh `org_id` claim — verify by hitting `/auth/me` after submit and seeing the org details populated.
7. After submit, the page hard-reloads to `/`; the shell renders with `Hello, {name}`-style hero per the configured persona.
8. Orgless user typing `/team` URL → bounces to `/onboarding` via `requiresOrgGuard`.
9. User who already has an org typing `/onboarding` → bounces to `/home` via `needsOnboardingGuard`.
10. pV2-03 invitee flow still works: invite `liam@nike.example` → sign in via Google with matching email → email-link flow activates the invite → user lands at `/home`, NOT `/onboarding`.
11. v1 on port 4200 unchanged (no JWT regression).
12. `ng build` + `ng lint` clean. 0 `any`. 0 `*ngIf`/`*ngFor`/NgModules. 0 raw-color Tailwind classes (the new component uses only token-backed utilities per AUDIT-02's palette replacement).
13. Tests added: at least `org-name-default.spec.ts` covering the firstName + email-fallback derivation; `needs-onboarding.guard.spec.ts` + `requires-org.guard.spec.ts` covering the four redirect paths.

## Concerns not in spec (template — fill in your ship report)

Items I'd particularly want to know if you spot them:

- Anywhere the `SessionUser.activeOrgId: null` change forces a non-null
  assertion somewhere it shouldn't (the type widens; usages must accept null)
- Whether the `signSessionCookie` extraction introduces a circular import risk
- Whether `withTransaction` covers the case where `req.user.id` differs from
  the just-created user (it shouldn't — but worth a sanity check that audit
  attribution is right)

## Bump + ship

1. Version chip `[Dev v2] v2.07a` (next after AUDIT-02's v2.06a)
2. **Two commits** in this branch:
   - Commit 1: `feat(v2.07a-pt1): public landing page + route restructure (/ public, /home auth shell)`
   - Commit 2: `feat(v2.07a): onboarding flow — orgless users pick type + org name (pV2-02b)`
3. Ship report `prompts/pV2-02b-onboarding-shipped.md` with mandatory
   "Concerns not in spec" section
4. Flip backlog row to `Shipped`; await audit-before-shipped pass to flip to Done

## Reply with

- Commit SHA
- 13/13 acceptance verified
- Concerns not in spec (anything you spotted while implementing)
- Confirmation v1 on 4200 unchanged
