# pV2-AUDIT-02 — Code fixes for the violations called out in pV2-AUDIT-01

## Read first

1. `WORKING_STANDARDS.md` (with pV2-AUDIT-01's "Engineering hygiene" section now landed)
2. `prompts/cc-onboarding.md` (with the "Concerns not in spec" + "audit before shipped" amendments)
3. `prompts/pV2-AUDIT-01-strengthen-process-prompt.md` — full audit context
4. `prompts/pV2-02-google-oauth-and-users-shipped.md` (with the retroactive addendum)
5. `prompts/pV2-03-team-management-shipped.md` (with the retroactive addendum)
6. This prompt

## Why this prompt exists

pV2-AUDIT-01 wrote the rules and the retroactive addenda but did NOT fix the
code. This prompt fixes the code, in priority order, against the new
WORKING_STANDARDS rules.

Before pV2-04 can build new feature endpoints, the structural fix (Violation F —
shared membership middleware) MUST land. Otherwise pV2-04 either copies the
inline pattern (hardening the anti-pattern) or forgets it (regression risk).

This prompt does NOT touch the auto-org-create behavior (Violation 2 in the
audit) — that's pV2-02b's job, scoped to the UX/onboarding redesign separately.

## Scope — nine fixes in priority order

| # | Violation | Severity | Estimate | Why this order |
|---|---|---|---|---|
| 0 | Infra — `withTransaction(fn)` helper in `db/` | HIGH | ~20 min | Precondition for Fix 2; encodes the GUC-preserving transaction pattern in one place |
| 1 | F — shared `requireActiveMembership` middleware | HIGH | ~30 min | Blocks pV2-04 from building more endpoints |
| 2 | A — upsert step 3 transaction (USES Fix 0) | HIGH | ~10 min | Data integrity; orphan risk grows over time |
| 3 | D — JWT authority claims marked deprecated + comment | MEDIUM | ~15 min | Closes the staleness window; pairs with F |
| 4 | C — rate limiting + `trust proxy` config | MEDIUM | ~25 min | Production-readiness; install + config + proxy hop |
| 4b | clearCookie mirror set options (CC's AUDIT-01 finding) | MEDIUM | ~10 min | Latent bug: logout silently fails when JWT_COOKIE_DOMAIN configured |
| 5 | B — Tailwind palette REPLACEMENT + semantic tokens defined | MEDIUM | ~40 min | Compiler-level enforcement; complete semantic set |
| 6 | H + G — first test batch including matrix parity | MEDIUM | ~45 min | Locks in correctness; smallest feasible spec set |
| 7 | E — error swallow + comments | LOW | ~10 min | Cleanup; comments + 5xx logging |
| 8 | J + I — hello → httpResource + (if 3rd consumer) twin resource extraction | LOW | ~15 min | Last imperative subscribe; consistency |

Ship in commits matching this order. Each commit standalone. Acceptance lists
per-fix verification.

---

## Fix 0 — Build `withTransaction(fn)` helper FIRST (precondition for Fix 2)

### Why this fix exists

CC's audit response flagged: `pool.js`'s write-wrapper opens a transaction
per statement (BEGIN → `SET LOCAL app.current_user_id` → stmt → COMMIT) to
attribute audit columns. If a service hand-rolls a multi-statement
transaction with a dedicated client, the GUC isn't set on those statements
and audit attribution silently breaks. The fix encodes the
GUC-preserving pattern in one place so individual services never see it.

### What to build

`server/src/db/with-transaction.js`:

```javascript
const pool = require('./pool');
const { als } = require('./request-context');

/**
 * Run `fn(client)` inside a single transaction with audit attribution.
 *
 * Owns the GUC interplay that `pool.js`'s per-statement wrapper handles
 * for non-transactional writes: opens the txn, sets
 * `app.current_user_id` from ALS so the audit trigger stamps each row's
 * `created_by` / `updated_by`, runs the callback, commits, releases.
 *
 * On any throw: rolls back, releases, rethrows the original error.
 *
 * Use this for any service operation that performs >1 write that must
 * all-succeed-or-all-fail. Hand-rolled BEGIN/COMMIT in services is
 * FORBIDDEN per WORKING_STANDARDS §"Multi-statement DB writes are
 * transactional — via the shared helper".
 *
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const store = als.getStore();
    const userId = store && store.userId;
    if (userId) {
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback failure */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
```

### Acceptance

- `server/src/db/with-transaction.js` exists with the signature above
- Confirms `app.current_user_id` is set inside the transaction when ALS
  has a userId (verified by adding a temporary INSERT in a test, checking
  `created_by` is populated)
- ROLLBACK runs on any throw inside the callback
- Comment cites WORKING_STANDARDS §"Multi-statement DB writes are
  transactional — via the shared helper"

---

## Fix 1 — Extract `requireActiveMembership(perm?)` middleware (Violation F)

### What to build

`server/src/middleware/require-active-membership.js`:

```javascript
const pool = require('../db/pool');
const { effectiveRole, normalizeOrgType, can } = require('../services/permissions.service');

/**
 * Middleware: re-reads live `user_orgs` per request and gates by an optional
 * permission. The safe default is on — every v2 endpoint inherits it.
 *
 * Usage:
 *   router.use(requireActiveMembership());                     // any active member
 *   router.use(requireActiveMembership('org.invite_member'));  // and admin perm
 *
 * Reads `req.user` (populated by `authenticate` middleware from JWT).
 * Reaches into DB to verify the membership is STILL `status='active'` and
 * computes the CURRENT `is_admin` flag — so suspending or demoting takes
 * effect on the very next request, not when the JWT expires.
 *
 * On success: writes the fresh truth back to `req.user` (is_admin, role) so
 * downstream handlers don't read stale JWT claims.
 *
 * On failure: 401 if no membership, 403 if not active, 403 if perm denied.
 */
function requireActiveMembership(perm) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id || !req.user.org_id) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const r = await pool.query(
        `SELECT uo.is_admin, uo.status, o.type AS org_type
           FROM user_orgs uo
           JOIN orgs o ON o.id = uo.org_id
          WHERE uo.user_id = $1 AND uo.org_id = $2 AND uo.deleted_at IS NULL`,
        [req.user.id, req.user.org_id]
      );
      if (!r.rows.length) {
        return res.status(403).json({ error: 'Membership suspended or revoked' });
      }
      const row = r.rows[0];
      if (row.status !== 'active') {
        return res.status(403).json({ error: 'Membership suspended or revoked' });
      }
      // Overwrite stale JWT claims with live truth.
      const orgType = normalizeOrgType(row.org_type);
      req.user.is_admin = row.is_admin;
      req.user.org_type = orgType;
      req.user.role = effectiveRole(orgType, row.is_admin);
      if (perm && !can(orgType, row.is_admin, perm)) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      return next();
    } catch (err) { return next(err); }
  };
}

module.exports = { requireActiveMembership };
```

### Where to apply

1. Mount it on the v2 router stack. If there's no v2-only router yet, create
   one in `server/src/index.js`:
   ```javascript
   const v2 = require('express').Router();
   v2.use(authenticate);
   v2.use(requireActiveMembership());     // every v2 endpoint inherits the check
   v2.use('/team', teamRoutes);
   v2.use('/dev', devRoutes);             // dev endpoints already 403 in prod; harmless
   app.use('/api', v2);
   ```
2. In `routes/team.js`, the existing inline `user_orgs` live-read becomes
   redundant — delete it. Replace per-route `can()` checks with
   `requireActiveMembership('org.invite_member')` at the router level OR per
   handler where the permission differs.
3. The shared middleware does NOT apply to `/auth/*` — those endpoints are
   the entry point (no membership yet) or the session probe (`/auth/me`
   intentionally re-derives via `buildSession`). Confirm `/auth/*` mount
   stays outside the v2 router.
4. v1 `/api/*` routes (used by `client-angular/` on port 4200) MUST keep
   working unchanged. The v2 router is OPT-IN by mount path — confirm v1
   routes are NOT mounted via the new v2 router.

### Acceptance

- New `require-active-membership.js` middleware exists with the contract above
- `team.js` inline live-read deleted; same behaviour preserved (verify by:
  suspend Alex via Sarah's team page → Alex's next API call returns 403)
- v1 on port 4200 still works (no regression)
- Comment in `index.js` documents that the v2 router applies
  `requireActiveMembership` by default

---

## Fix 2 — Wrap `upsertUserFromGoogle` step 3 via `withTransaction` (Violation A)

### What to change

`server/src/services/auth.service.js`, the brand-new signup branch (step 3,
lines 62-79). Use the `withTransaction(fn)` helper from Fix 0. Hand-rolled
`BEGIN`/`COMMIT` is FORBIDDEN per the updated WORKING_STANDARDS rule.

```javascript
const { withTransaction } = require('../db/with-transaction');

// Step 3: brand-new signup → user + new agency org + admin membership.
// All-or-nothing via the shared helper per WORKING_STANDARDS
// §"Multi-statement DB writes are transactional — via the shared helper".
return withTransaction(async (client) => {
  const orgName = `${displayName}'s Workspace`;
  const org = await client.query(
    `INSERT INTO orgs (name, type) VALUES ($1, 'agency') RETURNING id`,
    [orgName]
  );
  const orgId = org.rows[0].id;
  const user = await client.query(
    `INSERT INTO users (name, display_name, email, google_sub, avatar_url, default_org_id, role)
     VALUES ($1, $2, $3, $4, $5, $6, 'admin') RETURNING id`,
    [displayName, displayName, email, sub, avatarUrl, orgId]
  );
  const userId = user.rows[0].id;
  await client.query(
    `INSERT INTO user_orgs (user_id, org_id, is_admin, status, joined_at)
     VALUES ($1, $2, true, 'active', NOW())`,
    [userId, orgId]
  );
  return { userId };
});
```

### Acceptance

- Step 3 uses `withTransaction(fn)`; no hand-rolled `BEGIN`/`COMMIT`
- Test: force the user INSERT to fail (e.g., temporarily violate the unique
  email constraint by inserting a colliding email row, then trigger Google
  signup) — verify orgs table has no orphan row after the rollback
- Audit attribution preserved: a write inside the transaction populates
  `created_by` correctly when `app.current_user_id` is set in ALS
- Comment cites WORKING_STANDARDS §"Multi-statement DB writes are
  transactional — via the shared helper"

---

## Fix 3 — Mark JWT authority claims as DEPRECATED + add DB re-check (Violation D)

### What to change

`server/src/routes/auth.js` `signSessionCookie()` — keep `role` and
`is_admin` in the JWT payload (for backward compat across an in-flight
deployment cycle) but comment them as deprecated. Authority now comes from
`requireActiveMembership` (Fix 1), which overwrites the values per request.

Add the comment:

```javascript
function signSessionCookie(res, session) {
  const token = jwt.sign(
    {
      sub: session.id,
      email: session.email,
      org_id: session.activeOrgId,
      org_type: session.activeOrgType,
      // DEPRECATED — authority claims kept for backward-compat only.
      // See WORKING_STANDARDS §"JWTs carry identity, not authority".
      // The requireActiveMembership middleware overwrites these on every
      // protected request with fresh truth from the DB.
      is_admin: session.isAdmin,
      role: session.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  // ... cookie set unchanged
}
```

### Acceptance

- Comment added at the `is_admin`/`role` lines citing WORKING_STANDARDS
- `requireActiveMembership` (Fix 1) overwrites these claims per request
  (verified by integration test: suspend Alex → his next call returns 403
  even though his cookie still says `is_admin: true`)
- No other code paths trust `req.user.is_admin` / `req.user.role` from the
  JWT directly outside of routes protected by `requireActiveMembership`
  (grep `req.user.is_admin` across `server/src/` — anything in a route NOT
  behind the middleware is a bug)

---

## Fix 4 — Rate limiting on auth surfaces + `trust proxy` (Violation C)

### Deploy precondition: trust proxy

Before any rate-limit middleware will work correctly behind Railway / a
load balancer, `app.set('trust proxy', ...)` MUST be configured in
`server/src/index.js`. Without this, `express-rate-limit` sees only the
proxy's IP and EVERY user shares one bucket — self-DoS.

In `index.js`, near the top of the Express app setup:

```javascript
const app = express();

// Trust the first proxy hop (Railway's edge). If you ever sit behind
// multiple proxies, set this to the exact number of hops.
// Required by express-rate-limit per WORKING_STANDARDS §"Auth surfaces
// require rate limiting".
app.set('trust proxy', 1);
```

`trust proxy` is a single setting at app level; do not set it per-route.

### What to install

```bash
cd server
npm install express-rate-limit
```

### What to add

`server/src/middleware/rate-limits.js`:

```javascript
const rateLimit = require('express-rate-limit');

/** Tighter limit for write endpoints that change session state. */
const authWriteLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests; try again in a minute.' },
});

/** Looser limit for read endpoints that touch session. */
const authReadLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests; try again in a minute.' },
});

/** OAuth callback gets the read budget — it's not a write per se. */
const oauthLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OAuth attempts; try again in a minute.' },
});

module.exports = { authWriteLimit, authReadLimit, oauthLimit };
```

### Where to apply

In `routes/auth.js`:

```javascript
const { authWriteLimit, authReadLimit, oauthLimit } = require('../middleware/rate-limits');

router.get('/google',          oauthLimit,      /* ... */);
router.get('/google/callback', oauthLimit,      /* ... */);
router.post('/logout',         authWriteLimit,  /* ... */);
router.get('/me',              authReadLimit,   authenticate, /* ... */);
router.post('/dev/login',      authWriteLimit,  /* ... */);
```

In `routes/dev.js`:

```javascript
router.get('/users', authReadLimit, /* ... */);
```

### Acceptance

- `express-rate-limit` installed
- `app.set('trust proxy', 1)` configured in `index.js`
- Middleware applied to all five `/auth/*` endpoints + `/api/dev/users`
- Verify in dev: hit `/auth/dev/login` 11 times in a minute → 11th gets 429
- Verify `req.ip` resolves to your machine's IP, NOT Railway's edge (curl
  with `--header "X-Forwarded-For: 1.2.3.4"` — `req.ip` should be `1.2.3.4`
  when trust proxy is on)
- v1 `/api/*` rate limits NOT affected (v1 routes don't import or use these
  middlewares)

---

## Fix 4b — `clearCookie` must mirror set options (CC's AUDIT-01 finding #1)

### Why this fix exists

CC's retroactive concerns pass on AUDIT-01 surfaced a latent bug:
`auth.js` sets the session cookie with `domain: JWT_COOKIE_DOMAIN` but
clears it without the domain. On localhost (`JWT_COOKIE_DOMAIN` empty)
this is harmless. The moment `JWT_COOKIE_DOMAIN` is configured for
preview/production, **logout silently fails to clear the session** because
the browser scopes the cookie to the domain and the clear targets the
default origin.

This is small but real — exactly the kind of thing the "Concerns not in
spec" section is meant to catch.

### What to change

`server/src/routes/auth.js`, the `/logout` handler. Mirror EVERY option
that was set on the cookie when clearing:

```javascript
router.post('/logout', authWriteLimit, (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.JWT_COOKIE_SECURE === 'true',
    domain: process.env.JWT_COOKIE_DOMAIN || undefined,
    path: '/',
  });
  res.status(204).end();
});
```

Extract the cookie options to a shared constant if they're now duplicated
between `signSessionCookie` and `clearCookie` — One Definition.

### Acceptance

- `/logout` clears the cookie with the same `domain`, `path`, `secure`,
  `sameSite`, `httpOnly` as it was set with
- Cookie options live in one constant (or one factory function) referenced
  by both set and clear paths
- Verify on localhost: sign in → log out → DevTools cookies → `bp_session`
  gone
- Production verify (when deployed): set `JWT_COOKIE_DOMAIN` in env →
  sign in → log out → `bp_session` cookie cleared from the domain

---

## Fix 5 — REPLACE Tailwind palette + define semantic token set (Violation B)

### Step 5a: Define the v2 semantic token set in `styles.css`

The rule mandates that every visible UI state has a compliant token. Today's
codebase has `--theme-*` (themable brand) and `--bp-*` (Ballpark fixed
brand) but no semantic-state tokens. Define them in `client-v2/src/styles.css`:

```css
:root {
  /* Existing tokens stay as-is (--theme-*, --bp-*, --color-surface, etc.) */

  /* Semantic state tokens — DO NOT recolour with theme presets.
     v2 picks these up from the v1 vocabulary in styles.css for parity. */
  --color-success:        #047857;   /* green — Live / Signed / Accepted */
  --color-success-soft:   #d1fae5;
  --color-warn:           #b45309;   /* amber — Negotiating / Pending invite */
  --color-warn-soft:      #fef3c7;
  --color-danger:         #b91c1c;   /* red — Suspended / Declined / Destructive */
  --color-danger-soft:    #fee2e2;
  --color-info:           #1e40af;   /* blue — Signing SOW / In progress */
  --color-info-soft:      #dbeafe;
  --color-action:         #6d28d9;   /* purple — Payment Processing / Quoted */
  --color-action-soft:    #ede9fe;

  /* Surface / structure tokens */
  --color-border-hairline:   rgba(15, 23, 42, 0.10);
  --color-border-medium:     rgba(15, 23, 42, 0.18);
  --color-text-muted:        #6b7280;
  --color-fill:              #f8fafc;
}
```

Match v1's value choices exactly where they overlap (so v2 components dropped
into v1 surfaces, or vice versa, render consistently). Add to the brand
config DB table from pV2-01e if any of these should be runtime-configurable
later — none need to be for v2 today.

### Step 5b: REPLACE Tailwind's default palette (not extend)

`client-v2/tailwind.config.js`:

```javascript
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    // REPLACE, not extend. Tailwind's default palette is gone.
    // Per WORKING_STANDARDS §"Tokens only — enforced at compile time":
    // text-slate-500 / bg-white / border-black/N must NOT compile.
    colors: {
      // Brand
      accent:     'var(--theme-accent)',
      bp:         'var(--bp-text-color)',

      // Surfaces
      surface:    'var(--color-surface)',
      fill:       'var(--color-fill)',
      bg:         'var(--theme-bg)',
      transparent: 'transparent',
      current:    'currentColor',

      // Text
      text:       'var(--color-text)',
      secondary:  'var(--color-text-secondary)',
      muted:      'var(--color-text-muted)',
      inverse:    'var(--bp-text-on-gradient)',

      // Semantic states (defined in styles.css)
      success:      'var(--color-success)',
      'success-soft': 'var(--color-success-soft)',
      warn:         'var(--color-warn)',
      'warn-soft':  'var(--color-warn-soft)',
      danger:       'var(--color-danger)',
      'danger-soft': 'var(--color-danger-soft)',
      info:         'var(--color-info)',
      'info-soft':  'var(--color-info-soft)',
      action:       'var(--color-action)',
      'action-soft': 'var(--color-action-soft)',
    },
    borderColor: ({ theme }) => ({
      ...theme('colors'),
      DEFAULT: 'var(--color-border-hairline)',
      hairline: 'var(--color-border-hairline)',
      medium:   'var(--color-border-medium)',
    }),
    extend: {
      // Spacing, radius, shadow extensions can use `extend` — those are
      // additive. Only `colors` is REPLACED.
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
```

After this change, `text-slate-500`, `bg-white`, `border-black/10`, etc. all
fail at build time with `Could not resolve color`. That's the enforcement.

### Step 5c: Migrate `team.component.ts` (and anywhere else)

Find every raw-color Tailwind class in `client-v2/src/` and replace per:

| Old | New |
|---|---|
| `border-black/10` | `border-hairline` |
| `border-black/20` | `border-medium` |
| `text-slate-500` | `text-secondary` (or `text-muted` for less-prominent) |
| `bg-white` | `bg-surface` |
| `bg-white/80` | use a semi-transparent surface utility OR add `--color-surface-alt` token |
| `bg-gray-*` | `bg-fill` or `bg-surface` |
| Any direct hex / rgba | `var(--token-name)` in inline style or a new utility |

Also: the build will tell you about every offending usage. Run `ng build`
and fix what fails.

### Step 5d: Status badges & state UI

Anywhere a pill / badge / dot is rendering a state (pending invite,
suspended, live, etc.), use the semantic-soft / semantic pair:

```html
<!-- Pending invite -->
<span class="bg-warn-soft text-warn px-2 py-0.5 rounded-full text-xs">pending invite</span>

<!-- Suspended -->
<span class="bg-danger-soft text-danger px-2 py-0.5 rounded-full text-xs">suspended</span>

<!-- API connected dot -->
<span class="w-2 h-2 rounded-full bg-success"></span>
```

### Acceptance

- `styles.css` has the 5 semantic-state tokens + soft variants + 4
  structure tokens defined
- `tailwind.config.js` REPLACES `theme.colors` (not extend); confirm via
  `grep -c "colors:" tailwind.config.js` → 1
- `team.component.ts` has zero raw-color Tailwind utility classes
- `ng build` fails if any file uses `text-slate-*`, `bg-white`,
  `border-black/N`, etc. (verify by introducing one in a test file, run
  build, expect failure, revert)
- Grep across `client-v2/src/` for `border-black|text-slate|bg-white|bg-gray|border-gray|text-black` returns zero hits in component files (excluding the config file)
- Visual: team page + login + hello renders identically (no color drift)
- Status badges use semantic tokens (pending invite = warn, suspended = danger)

---

## Fix 6 — First test batch + matrix parity (Violations H + G)

### What to add

Vitest is already wired in `client-v2`. Add `npm test` on the server side if
it doesn't exist — Node's built-in test runner is fine, or install Vitest
for the server too.

**Client tests** (`client-v2/src/app/core/auth/`):

- `permissions.spec.ts` — covers `can()` for all 5 roles × 10 permissions
  (positive and negative cases)
- `permissions.parity.spec.ts` — the matrix-parity check. **NOTE: the
  server's `permissions.service.js` lives outside `client-v2/src/` —
  Vitest's default `include` won't reach it.** Solutions, in order of
  preference:
  - **Preferred:** put the parity spec at `client-v2/test/permissions.parity.spec.ts`
    (outside `src/`), and configure Vitest's `include` to pick up `test/`
    in `client-v2/vitest.config.ts`. The relative require path is then
    `../../server/src/services/permissions.service`.
  - **Alternative:** symlink the server matrix into `client-v2/src/` as a
    read-only file checked in to git, with a comment "Copy from server —
    parity spec asserts identity. Do not edit directly."
  - **Forbidden:** simplifying the test to import only one side. The whole
    point of this spec is catching drift; testing one side defeats it.

  ```typescript
  // client-v2/test/permissions.parity.spec.ts
  import { MATRIX as CLIENT_MATRIX } from '../src/app/core/auth/permissions';
  // Server uses CommonJS — Vitest can require() with proper Node resolution.
  // See vitest.config.ts: deps.interopDefault and include for path setup.
  const { MATRIX: SERVER_MATRIX } = require('../../server/src/services/permissions.service');

  it('client and server permissions matrices are byte-identical', () => {
    expect(CLIENT_MATRIX).toEqual(SERVER_MATRIX);
  });
  ```
- `auth.guard.spec.ts` — covers signed-in passes through, signed-out
  returns UrlTree to `/login`
- `admin.guard.spec.ts` — covers admin passes through, non-admin returns
  UrlTree to `/`

**Client tests** (`client-v2/src/app/shared/user-avatar/`):

- `initials.spec.ts` — covers `deriveInitials`: full name, single word, no
  name+email, no name+no email, edge cases (empty, whitespace)

**Server tests** (`server/src/services/`):

- `permissions.service.spec.js` — covers `effectiveRole()` for all 5
  combinations, `normalizeOrgType()` for the 'admin'→'ballpark' alias, `can()`
  positive and negative cases

### Acceptance

- All test files exist and `npm test` passes from both `client-v2/` and
  `server/`
- Test count: at least 25 specs total across the listed files
- The matrix-parity test passes; if `MATRIX` is touched in either file,
  the test fails until both are updated together
- Add `test` to CI if a workflow file exists (find via `.github/workflows/*.yml`)

---

## Fix 7 — Catch block comments + 5xx logging (Violation E)

### What to change

`client-v2/src/app/core/auth/auth.service.ts` `loadSession()`:

```typescript
async loadSession(): Promise<void> {
  try {
    const u = await firstValueFrom(this.api.get<SessionUser>('/auth/me'));
    this._user.set(u);
  } catch (err) {
    // Expected: 401 means no/expired cookie → signed out (silent).
    // Unexpected: 5xx / network → log it; still treat as signed out for the UI.
    // See WORKING_STANDARDS §"Catch blocks justify themselves".
    if (this.isUnexpectedSessionError(err)) {
      console.warn('[Auth] Failed to load session (server may be down):', err);
    }
    this._user.set(null);
  }
}

private isUnexpectedSessionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return true;
  const status = (err as { status?: number }).status;
  return status === undefined || status >= 500;
}
```

Same treatment in `login.component.ts` and `user-menu.component.ts` for the
dev-picker `resource()` loader — silent only when the failure looks like a
prod-403 (or 401); log on anything else.

### Acceptance

- All catch blocks in v2 that swallow errors have a comment citing
  WORKING_STANDARDS §"Catch blocks justify themselves" OR log unexpected
  failures
- Dev: stop the server, refresh the app → console warns "Failed to load
  session" with the error detail (not silent)

---

## Fix 8 — Hello page → `httpResource` (Finding J) + twin resource extraction (Finding I)

### What to change

`client-v2/src/app/pages/hello/hello.component.ts` — convert the imperative
`ngOnInit` + `subscribe` health check to declarative `httpResource()`.
~10 lines.

For Finding I (twin `listDevUsers()` resources): if Fix 7 doesn't already
extract them as a side effect, leave for later. The rule of thumb is third
consumer triggers extraction; we have two. Mark with a `// TODO(third-use):`
comment so the next consumer triggers the move.

### Acceptance

- `client-v2/src/app/pages/hello/hello.component.ts` has zero
  `.subscribe()` calls
- Grep `client-v2/src/` for raw `.subscribe` returns zero hits in
  components / pages (services that bridge HttpClient → Observables are OK)
- App still renders the API connection indicator correctly

---

## Bump + ship

1. **One PR-style branch**, **ten commits** (one per fix, including Fix 0
   `withTransaction` helper and Fix 4b clearCookie mirror), pushed to dev
2. **Version chip** → `[Dev v2] v2.06a` (the next minor after pV2-03's v2.05a)
3. **Ship report** at `prompts/pV2-AUDIT-02-code-fixes-shipped.md` with the
   mandatory "Concerns not in spec" section
4. **Flip backlog row to `Shipped`** (the new intermediate status from AUDIT-01)
   when ship report is posted. **DO NOT** flip to `Done` — wait for Liam's
   audit-before-shipped pass.

## Concerns not in spec — examples for this report

Because this prompt fixes hygiene issues, the "Concerns not in spec" section
in your ship report should be richer than usual. Examples of what to surface:

- Anything you noticed while doing Fix 1 (membership middleware) that suggests
  the JWT shape should change in pV2-02b or later — e.g., dropping `is_admin`
  / `role` entirely from the cookie payload once the middleware is the only
  authority source
- Any test coverage gaps you can't justify covering in this commit but think
  should be tracked
- Any performance trade-offs the middleware introduces (one extra DB query
  per protected request — usually fine but worth measuring)
- Any v1 routes that LOOK like they need the membership check but were skipped
  per spec (v1 keeps working unchanged)

## Reply with

- Commit SHAs (one per fix; **10 total** including Fix 0 + Fix 4b)
- 10/10 fixes verified per the acceptance criteria
- "Concerns not in spec" section in your ship report
- Wait for Liam's audit-before-shipped pass before flipping the backlog row
  to Done (you flip to `Shipped` yourself when posting the report)
