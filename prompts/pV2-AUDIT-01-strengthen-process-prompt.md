# pV2-AUDIT-01 — Strengthen WORKING_STANDARDS + ship-report process + retroactive concerns pass

## Read first

1. `WORKING_STANDARDS.md`
2. `prompts/cc-onboarding.md`
3. `prompts/pV2-02-google-oauth-and-users-shipped.md`
4. `prompts/pV2-03-team-management-shipped.md`
5. This prompt

## Why this prompt exists

A code audit pass after pV2-03 ship found violations of WORKING_STANDARDS and
production-readiness concerns that **were not surfaced in your ship reports**.
The ship reports were rigorous about flagging spec drift and design choices —
genuinely good discipline — but silent about issues the spec didn't explicitly
ask about.

This is a real gap in our process. We need to fix the rules, fix the process,
and educate against the specific violations so they don't recur.

This prompt does three things in one commit pass:

1. Strengthens `WORKING_STANDARDS.md` with explicit rules covering each kind of
   violation found
2. Strengthens `cc-onboarding.md` with a mandatory "Concerns not in spec"
   ship-report section + a chat-side audit pass before backlog row flips to Done
3. Retroactive concerns pass on pV2-02 and pV2-03 — read your own shipped code
   and write the "Concerns not in spec" addenda the original reports lacked

## The original audit report (read first)

This is the chat-side audit Liam asked for after pV2-03 shipped. It's the basis
for the rules and addenda below. Read it before doing anything else.

---

### Audit findings — by severity

**🔴 MUST FIX (security / correctness)**

1. **Step 3 of `upsertUserFromGoogle` is not transactional**
   File: `server/src/services/auth.service.js`, lines 62-79.
   Three separate INSERTs — `orgs` then `users` then `user_orgs`. If any fails
   after the first, orphan rows leak. Should wrap in `BEGIN`/`COMMIT` with a
   `client.connect()` from the pool.

2. **Auto-org-create is the auto-magic Liam didn't sign off on**
   Same lines. Behavior was buried in the spec as a "v1 simplifying
   assumption" — the prompt's drafting miss, not yours. Fix is in a separate
   prompt (pV2-02b) that replaces step 3 with a redirect to `/onboarding`.

3. **JWT carries `role` + `is_admin` for 7 days**
   `server/src/routes/auth.js` lines 38-49 (`signSessionCookie`). If an admin
   demotes someone, their cookie still says admin until expiry. Sensitive ops
   should re-check live membership against DB; `permissions.service.js`
   currently trusts the JWT.

**🟠 SHOULD FIX (v2 standards compliance)**

4. **Raw color values in Tailwind utility classes**
   File: `client-v2/src/app/pages/settings/team/team.component.ts`.
   - `border-black/10` — lines 40, 61, 65, 69
   - `text-slate-500` — lines 38, 50
   - `bg-white` — line 40
   - `border-black/20` — line 72
   Violates the "tokens only, no raw values" rule.

5. **Dual source of truth on `users` table**
   Schema kept v1 columns (`name`, `org_id`, `role`) AND added v2 columns
   (`display_name`, `default_org_id`). Upsert writes BOTH. The additive ALTER
   was intentional to keep v1 working — pragmatic but creates schema debt.

6. **No rate limiting on `/auth/*` or `/api/dev/users`**
   Brute force risk, especially on `/auth/dev/login` even though it's
   `NODE_ENV`-gated.

**🟡 NOTED (tactical calls that were defensible)**

7. **`google_sub` NULLABLE despite spec saying NOT NULL**
   Your call (correct): dev-seed users have no `google_sub` and the spec
   contradicted itself. Unique index uses `WHERE google_sub IS NOT NULL`.
   Honest flag, correct decision.

8. **v1 `admin` org_type → v2 `ballpark`**
   You kept v1 data untouched; `permissions.service.normalizeOrgType` aliases
   on the way out. Defensible — v1 must keep working.

9. **Auth code style is otherwise clean**
   Standalone, OnPush, signal-based. `inject()`. Control flow blocks. `host:`
   bindings. Strict types, zero `any`. Modern `resource()` for HTTP state.
   Inline comments document non-obvious decisions.

### Angular-skill audit findings (independent second pass)

After the chat audit above, the `angular-developer` skill ran an independent
review of the `client-v2/` code. It confirmed the codebase is in genuinely
good shape (no `*ngIf`/`*ngFor`/`any`/`NgModules`, no constructor injection,
no `EventEmitter`, no `@Input`/`@Output`, signal-based throughout, guards
match canonical functional-guard shape, AuthService is textbook
private-writable → `asReadonly()` → computeds, zoneless-safe initializer
chain) but flagged six structural items the chat audit missed:

**🔴 ADDITIONAL HIGH (structural)**

**F. Live-membership gate is opt-in per router, not shared middleware**

Only `/api/team` re-reads `user_orgs` per request to honour a suspension.
`/auth/me` re-derives via `buildSession`. Every NEW v2 endpoint must
remember to copy that pattern or a suspended user's 7-day JWT keeps working
there. This is the allow-list-where-default-on-is-correct anti-pattern
forming server-side.

The fix: extract a `requireActiveMembership(perm?)` middleware, applied at
the v2 router level once. Every future v2 endpoint inherits it by being
mounted in the v2 router; no per-endpoint opt-in. This needs to happen
**before pV2-04 builds more endpoints** — otherwise a second consumer
hand-rolls it and the pattern fragments.

**🟠 ADDITIONAL MEDIUM**

**G. Permissions MATRIX duplicated client + server with no parity enforcement**

`client-v2/src/app/core/auth/permissions.ts` and
`server/src/services/permissions.service.js` both hold the MATRIX, mirrored
by hand and documented. That's two sources of truth that will drift
silently on the first uncoordinated edit.

The fix (cheap, immediate): when tests land (finding H), one test imports
both files and asserts deep-equality. The fix (long-term, defer): serve the
matrix from the API like brand config; client fetches at boot.

**H. Zero tests, but real logic worth testing**

`can()`, `effectiveRole`, `normalizeOrgType` (server), `deriveInitials`,
`errorDetail`, both guards — all pure functions, all in security-relevant
paths. Vitest is wired in `client-v2`; the cost is minimal.

The matrix-parity test from finding G belongs in the same first batch.

**🟡 ADDITIONAL LOW (cleanups + a11y note)**

**I. Twin `resource()` declarations**

`resource({ loader: listDevUsers().catch(()=>[]) })` is declared identically
in the login page and user-menu. Fine at two call sites — third consumer
means extracting (`devUsers` resource exposed by `AuthService`).

**J. Hello page is the last imperative fetch**

`ngOnInit` + `subscribe` + manual status signal for the API health check.
The rest of the app standardised on `resource()` / `httpResource()`.
~10 lines to convert; eliminates the app's only raw `.subscribe` and
makes the codebase 100% declarative-fetch.

**K. User-menu popover is keyboard-incomplete (a11y)**

Generic `<p-popover>`, not a keyboard menu — no arrow-key navigation, no
`role=menu`. PrimeNG provides the focus trap; full menu semantics would
come from Angular Aria's Menu pattern. Tab-navigation works today; defer
unless a11y becomes a blocker.

### What the chat audit caught that the skill audit missed

For completeness — the audits complement, not overlap:

| Chat audit finding | Why skill didn't catch it |
|---|---|
| Step 3 upsert not transactional | Server-side, not Angular concern |
| No rate limiting on auth endpoints | Server-side, not Angular concern |
| Raw Tailwind color values | Styling + standards intersection, less prominent for Angular skill |
| Auto-org-create UX | Spec-design issue, not code issue |
| Dual columns on `users` table | Schema concern, not Angular concern |

### What you DID flag (good discipline)

| Report | What you surfaced |
|---|---|
| pV2-01 | 6 setup deviations: Angular 21 (vs 22), `@primeuix/themes` (vs deprecated), `lucide-angular` (kept old API), `definePreset` (vs CSS overrides), `runtime-config.json` in `public/`, `provideAppInitializer` (vs race-prone bootstrap-then-load), `ALLOWED_ORIGINS` env addition |
| pV2-02 | `google_sub` NULLABLE (spec contradiction), `normalizeOrgType('admin' → 'ballpark')` for v1 compat, additive users reshape (dual columns), middleware NOT applied globally (criterion 12 conflict), bootstrap path B (no seed script), `@types/*` skipped (server is JS) |
| pV2-03 | Live membership re-read per request, self/cross-org/last-admin guards (including "structural invariant" note), pV2-02 upsert needed extending, `p-dialog` over `p-confirmdialog`, reload-from-server-on-error over optimistic rollback, undo toast skipped |

You are **strong** at flagging spec drift, spec contradictions, and visible
design choices. That's worth keeping.

### What you did NOT flag (silent in ship reports)

| Concern | Should have flagged? | Why you didn't |
|---|---|---|
| Step 3 upsert is not transactional | **Yes** — security/correctness | Spec didn't ask for transactions; you matched the spec's pseudocode shape literally |
| Raw Tailwind color values | **Yes** — violates WORKING_STANDARDS intent | Spec said "use Aura preset + token bridge" but didn't ban raw Tailwind colors explicitly |
| No rate limiting on auth endpoints | **Should at least mention** — production concern | Spec didn't require it |
| JWT carries permission state for 7 days | **Yes** — staleness window | You implemented per spec; the staleness implication wasn't called out |
| `loadSession()` silently swallows 5xx errors | **Yes** — masks server outages as "signed out" | Spec said "Never throws — no/expired cookie just means signed out"; collapsed two cases |

### The pattern

Your current behavior is:
- Flag everything the spec asked about ✓
- Flag spec contradictions or impossibilities ✓
- Flag deviations from the spec ✓
- Don't proactively flag code quality concerns not in the spec ❌
- Don't proactively flag security concerns not in the spec ❌

When the spec is loose or wrong, you execute it faithfully. You trust the
spec.

That trust is good — it's why you ship fast and produce code that matches
intent. But it has a cost: when the spec is silent on a hygiene rule or a
production-readiness concern, those concerns ship silently too.

The fix is not to distrust the spec. The fix is to ALSO surface things the
spec was silent on. Both at once.

---

## End of audit — rules and process changes below address it

## The specific violations found in pV2-02 and pV2-03

These are the things the audit caught. Read each carefully — the goal is not
shame but pattern recognition so they don't recur.

### Violation A — Multi-statement DB write without transaction (HIGH)

**File:** `server/src/services/auth.service.js`, lines 62-79 (the brand-new
signup branch of `upsertUserFromGoogle`).

**What happened:** three separate INSERTs run in sequence:
```js
INSERT INTO orgs ...        // statement 1
INSERT INTO users ...       // statement 2
INSERT INTO user_orgs ...   // statement 3
```

If statement 2 or 3 fails (constraint violation, network blip, anything), the
DB is left with an orphan `orgs` row owned by no one. Over time this leaks
test data into the live schema.

**The standard you should have applied:** any sequence of DB writes that must
all-succeed-or-all-fail goes inside `BEGIN` / `COMMIT` / `ROLLBACK`. You used
the pattern correctly elsewhere (audit columns work). The signup branch
specifically skipped it.

**Why you missed it:** the spec gave you the three INSERTs in pseudocode
without showing the transaction wrapping. You matched the spec's code shape
literally.

**Rule to add (and follow):** any service function that performs >1 INSERT or
UPDATE must wrap them in a single transaction, OR explicitly document in a
code comment why a transaction is unnecessary (the writes are independent).

### Violation B — Raw color values in component CSS (MEDIUM)

**File:** `client-v2/src/app/pages/settings/team/team.component.ts`, lines 38,
40, 50, 61, 65, 69, 72.

**What happened:** Tailwind utility classes with raw color values:
- `border-black/10` (3 places)
- `border-black/20` (1 place)
- `text-slate-500` (2 places)
- `bg-white` (1 place)

These bake `rgba(0,0,0,0.1)` / `rgba(0,0,0,0.2)` / `#64748b` / `#fff` into the
DOM. None of them are tokens. If you change `--theme-accent`, those values
don't move.

**The standard you should have applied:** `WORKING_STANDARDS.md` says "Never
hardcode hex colours in component files." The intent extends to Tailwind
utility classes that resolve to raw color values. Tokens only.

**Why you missed it:** WORKING_STANDARDS named hex codes and CSS custom
properties explicitly; it didn't explicitly name Tailwind utility classes
with embedded color tokens. The rule needs widening. ALSO important: the
pV2-01b/01c prompt templates themselves contained `text-slate-500`,
`bg-white/80`, `border-black/5`. CC extended an established (spec-embedded)
pattern. Under the existing cc-onboarding rule "visual decisions are
settled in the prompt; don't relitigate," unilaterally rewriting
spec-provided markup would itself have been a liberty. This is the
precedence gap — see the "Hygiene rules outrank spec-embedded code" rule
in the WORKING_STANDARDS additions below. With that rule in place, CC's
deviation from spec on hygiene grounds becomes mandatory rather than
forbidden.

**Rule to add:** Tailwind utility classes that resolve to raw color values
(`text-slate-*`, `bg-white`, `border-black/N`, `text-black/N`, etc.) are
forbidden in component templates and styles. Use bp/theme tokens via custom
Tailwind config (`text-secondary`, `border-hairline`, `bg-surface`, etc.) OR
direct CSS variables (`color: var(--color-text-secondary)`).

### Violation C — No rate limiting on auth endpoints (MEDIUM)

**Files:** `server/src/routes/auth.js`, `server/src/routes/dev.js`.

**What happened:** `/auth/google`, `/auth/logout`, `/auth/me`,
`/auth/dev/login`, `/api/dev/users` — none have rate limiting middleware.
A brute force attacker can hammer `/auth/dev/login` (in dev) or
`/auth/google/callback` (with crafted state params) without backoff.

**The standard you should have applied:** even with `NODE_ENV` gating, public
endpoints that touch auth/session need rate limiting. The cost is one
middleware install + 5 lines of config.

**Why you missed it:** spec didn't mention it. You implemented the auth
surface as specified and didn't add safeguards beyond.

**Rule to add:** every server endpoint that creates, validates, or destroys an
authentication artifact (cookie, token, session) MUST have rate limiting via
`express-rate-limit` or equivalent. Default: 10 req/min per IP for write
endpoints, 30 req/min per IP for read endpoints.

### Violation D — Permission state embedded in JWT with 7-day lifetime (MEDIUM)

**File:** `server/src/routes/auth.js`, line 38-49 (`signSessionCookie`).

**What happened:** the JWT payload carries `is_admin` and `role` claims with a
7-day expiry.

**Precise current state (not a live vuln, but a STRUCTURAL risk):** no
existing endpoint today authorises off the stale claims. `permissions.service`
is a pure function with no JWT involvement; `team.js` re-reads live
`user_orgs` per request; `/auth/me` re-derives via `buildSession`; the
dev gates are NODE_ENV-based. So "demoted admin keeps admin for 7 days"
overstates today's risk — the blast radius is currently zero endpoints.

**Why the rule still matters:** the risk is structural — the NEXT endpoint
that trusts `req.user.is_admin` without going through `requireActiveMembership`
(Violation F's middleware) makes the staleness window real. The fix is to
overwrite the stale claims with live truth per request (the middleware
does this) AND to mark the JWT authority claims DEPRECATED to discourage
the next consumer from reaching for them.

**The standard you should have applied:** JWTs should carry identity (who is
this), not authority (what can they do). Authority is fast-changing and
should be re-derived from the DB on each authorisation check.

**Why you missed it:** spec explicitly told you to put role + is_admin in the
JWT. The spec was wrong on this point.

**Rule to add:** JWTs MUST carry identity claims only (`sub` / `email` / and
`org_id` if the user can't switch orgs without re-auth). Authority claims
(`role`, `is_admin`, `permissions`) MUST be re-derived from the database on
each protected request, NOT trusted from the JWT.

Where the JWT has them today: keep for backwards-compat in this pass, but mark
with a code comment `// DEPRECATED: re-derive from DB per request, see WORKING_STANDARDS §JWT claims`.

### Violation F — Shared standard applied hand-rolled per consumer (HIGH)

**Where:** the live-membership re-read lives in `server/src/routes/team.js`
only. `server/src/routes/auth.js` `/auth/me` re-derives via `buildSession`.
Every other `/api/*` route in the v2 namespace would need to remember to
copy this pattern by hand.

**What happened:** `team.js` correctly re-reads `user_orgs` per request so
suspending a member takes effect on their next call. But this isn't
enforced at the router level — it's a per-route convention. The next v2
endpoint (pV2-04's home / dashboard / API surface) will either copy the
pattern or forget it; if it forgets, a suspended user keeps working there
for up to 7 days (the JWT lifetime) because their cookie still says
`is_admin: true`.

This is the **allow-list-where-default-on-is-correct** anti-pattern. The
safe default for "check live membership before honouring a permission"
should be ON, not OFF.

**The standard you should have applied:** any security-relevant check
(authentication, authorization, audit attribution) that applies to more
than one route MUST live as middleware applied at the router or app level,
not copied into each route handler.

**Why you missed it:** this is structural. The first consumer (team
endpoints) works correctly in isolation. The problem only appears when a
second consumer arrives and the pattern doesn't propagate.

**Rule to add:** when a security-relevant check is needed on more than one
route, it MUST live as middleware applied at the router or app level. The
allow-list pattern (opt-in per route) is forbidden for security checks
where the safe default is on.

**Concrete fix:** extract `requireActiveMembership(perm?)` middleware in
`server/src/middleware/`. Mount once on the v2 router. Every new v2
endpoint inherits it; team.js's inline check becomes redundant and gets
deleted. This needs to land **before pV2-04 builds more endpoints**.

### Violation G — Duplicate source of truth without enforcement (MEDIUM)

**Where:** `client-v2/src/app/core/auth/permissions.ts` (MATRIX constant)
and `server/src/services/permissions.service.js` (MATRIX constant). Both
hold the same five-role × ten-permission map. Mirrored by hand.

**What happened:** the duplication is intentional and documented — both
sides need the matrix for `can()` checks, and the network round-trip cost
of fetching it from the server on every check is too high. Comment in
`permissions.ts` reads "MIRRORED in `server/src/services/permissions.service.js`
— keep the two in sync." That's a hope, not a guarantee.

The first time someone edits one side without the other (probably to add a
new permission for a new feature), they drift. Silently. Tests don't
catch it. CI doesn't catch it. The first symptom is a user being able to
do something on the client UI that the server then rejects, or vice
versa — and the debugging starts hours later.

**The standard you should have applied:** when data must be duplicated
across boundaries (client/server, code/DB seed, two services, two
schemas), the duplication MUST have an automated enforcement mechanism.
Acceptable mechanisms:
- A test that imports both sides and asserts deep equality
- A codegen step that produces one side from the other at build time
- Serving the data from a single authoritative endpoint at runtime

A comment that says "keep in sync" is NOT an enforcement mechanism.

**Why you missed it:** the spec told you to mirror the matrix on both
sides. You implemented the mirror. The drift risk is downstream of the
spec.

**Rule to add:** when data must be duplicated across boundaries, the
duplication MUST have an automated enforcement mechanism (test, codegen,
or runtime fetch). Comment-only "keep in sync" is forbidden.

**Concrete fix:** in pV2-AUDIT-02 (the code fix prompt), add a Vitest spec
at `client-v2/src/app/core/auth/permissions.spec.ts` that imports both
matrices (one via Node `require()` on the JS file, one via TS import) and
asserts deep equality. Five lines.

### Violation H — Pure functions in security paths without tests (MEDIUM)

**Where:** Vitest is wired in `client-v2`, but there are zero specs in
`client-v2/src/app/core/auth/`, `server/src/services/permissions.service.js`,
`client-v2/src/app/shared/user-avatar/` (`deriveInitials`), and both
guards (`auth.guard.ts`, `admin.guard.ts`).

**What happened:** the auth + permissions layer is the security boundary
for the entire app. Every action with security implications eventually
calls `can()`, which calls `effectiveRole()`, which depends on
`normalizeOrgType()`. All three are pure functions. They have edge cases
(unknown org type throws; legacy 'admin' aliases to 'ballpark'; permissions
arrays must contain only known strings). None are tested.

`deriveInitials` is less critical but ships UI; it has edge cases too
(empty name, single word, multi-word, no name fallback to email, no email
fallback to '?').

The guards return UrlTrees in canonical functional-guard shape; they're
worth a spec each because future refactors will be tempted to add
short-circuits.

**The standard you should have applied:** pure functions in
security-relevant paths get tests before the next prompt builds on them.
The cost is minimal (Vitest is wired, no setup needed) and the regression
catch is real.

**Why you missed it:** the spec didn't ask for tests, and the spec
shipping cadence has been "no tests, ship features, add tests when stable".
That's a fair posture for UI experiments but not for security primitives.

**Rule to add:** pure functions in `core/auth/`, `services/permissions*`,
`shared/*-avatar/` (initials derivation), and any security-relevant
utility module MUST have unit tests before the next prompt builds on them.
Tests are not optional in these paths.

**Concrete fix:** in pV2-AUDIT-02, add the first Vitest spec batch covering
`can`, `effectiveRole`, `normalizeOrgType`, `deriveInitials`, both guards.
Include the matrix-parity test (Violation G) in the same commit.

### Violation E — Silent error swallowing without justification (LOW)

**File:** `client-v2/src/app/core/auth/auth.service.ts`, lines 50-57
(`loadSession`).

**What happened:** the catch block silently swallows ALL errors and sets the
user to null. This is correct for "no session" (401) but masks server errors
(500, 503) that would otherwise tell us "the auth API is broken right now"
vs "you're signed out".

**The standard you should have applied:** distinguish "expected absence of
session" from "unexpected server failure". Log the latter; treat the former
as silent.

**Why you missed it:** spec said "Never throws — no/expired cookie just means
signed out." The spec collapsed two cases into one.

**Rule to add:** any catch block that swallows errors silently MUST have an
inline code comment explaining WHY the error is safely ignorable. If the
comment can't be written truthfully, the catch block needs to log or
rethrow.

## What to update

### 1. `WORKING_STANDARDS.md`

Add a new section titled **"Engineering hygiene — non-negotiable"**. Place it
alongside the existing "Critical rules — non-negotiable" section. Contents:

```markdown
### Engineering hygiene — non-negotiable

#### Multi-statement DB writes are transactional — via the shared helper

Any service function that performs more than one INSERT, UPDATE, or DELETE
that must all-succeed-or-all-fail MUST wrap them in a single transaction
using the shared `withTransaction(fn)` helper in `server/src/db/`. Hand-rolled
`BEGIN`/`COMMIT`/`ROLLBACK` is FORBIDDEN — `pool.js`'s per-statement write
wrapper sets `app.current_user_id` (the audit attribution GUC) on each
statement individually, and a hand-rolled transaction with a dedicated client
silently loses that attribution unless it re-establishes the GUC itself. The
helper owns that interplay in one place (One Definition).

If a function intentionally does NOT wrap writes in a transaction (because
they're independent), the code MUST contain a comment explaining why.

Past violation: pV2-02's `upsertUserFromGoogle` step 3 ran three INSERTs
without a transaction, leaking orphan `orgs` rows on partial failure. The
fix (pV2-AUDIT-02) builds the `withTransaction(fn)` helper FIRST so the
violation fix doesn't itself recreate audit-attribution drift.

#### Tokens only — enforced at compile time, with a complete semantic set

No hex codes, `rgb()`, `rgba()`, `hsl()`, OR Tailwind utility classes that
resolve to raw color values in component templates or styles.

This rule is enforced **at compile time**, not by grep policing: the
`tailwind.config.js` `theme.colors` block REPLACES Tailwind's default
palette (does not extend it) with the token-only set, so `text-slate-500`
literally does not compile. Default-on, not allow-list — the same principle
this section's "Shared security standards" rule applies, mapped to styling.

Use either:
- CSS custom properties: `color: var(--color-text-secondary)`
- Custom Tailwind config tokens: `text-secondary`, `border-hairline`,
  `bg-surface`, `text-success`, etc. — defined in `tailwind.config.js`
  against the `--*` tokens

**The token set MUST be complete enough that every visible UI state has a
compliant choice.** A rule that's unsatisfiable is a rule that gets broken.
Define the semantic state tokens (`--color-success`, `--color-warn`,
`--color-danger`, `--color-info`) in the same pass as the rule — status
dots, "pending invite" badges, "suspended" badges, danger trash hovers all
need semantic-state colors, and a rule with no compliant alternative is
worse than no rule.

v1 already drew the right distinction (theme colors recolour with the
admin preset; semantic colors don't). v2's token set carries it forward
without invention.

Past violation: pV2-03's team page used `border-black/10`, `text-slate-500`,
`bg-white` in 7 places. The spec itself (pV2-01b/01c templates) contained
similar raw colors — see the "precedence" rule below, which makes
spec-embedded violations CC's mandatory delta, not a liberty.

#### Auth surfaces require rate limiting

Every server endpoint that creates, validates, or destroys an
authentication artifact (cookie, token, session) MUST have rate limiting
middleware via `express-rate-limit` or equivalent. Default budgets:
- Write endpoints (`POST /auth/*`, `POST /auth/dev/login`): 10 req/min per IP
- Read endpoints (`GET /auth/me`, `GET /api/dev/users`): 30 req/min per IP
- OAuth callbacks: 30 req/min per IP

This applies in development too — dev environments get attacked.

**Deploy precondition:** when the server runs behind a proxy (Railway,
load balancer, CDN), `app.set('trust proxy', ...)` MUST be configured
correctly. Otherwise `express-rate-limit` sees only the proxy's IP and
every user shares one bucket — a self-DoS waiting to happen. Set this
once in `index.js`, not per-route.

Past violation: pV2-02 shipped 5 auth-touching endpoints with no rate limiting.

#### JWTs carry identity, not authority

JWTs MUST contain identity claims only:
- `sub` (user id)
- `email`
- `org_id` (ONLY if the user cannot switch orgs without re-authenticating —
  fine today since v1 has no org switcher; moves out of the JWT or forces
  re-auth when the multi-org switcher lands)

JWTs MUST NOT contain authority claims that can change without the user
re-authenticating:
- `role`
- `is_admin`
- `permissions`

Authority MUST be re-derived from the database on each protected request via
a live read of `user_orgs` and `orgs`. The performance cost (one indexed
query) is negligible compared to the cost of stale permissions surviving for
the JWT lifetime.

Past violation: pV2-02 put `role` and `is_admin` in the JWT with a 7-day
lifetime; demoting an admin doesn't take effect until they re-sign-in.

#### Catch blocks justify themselves

Any `catch { }` block that does not log, rethrow, or notify the user MUST
have an inline comment explaining why the error is safely ignorable. If the
comment cannot be written truthfully, the catch must log or rethrow.

Distinguish "expected absence" (e.g., 404 / 401 on optional resource) from
"unexpected server failure" (5xx, network error). Silent on the former,
loud on the latter.

Past violation: pV2-02's `AuthService.loadSession()` silently swallowed all
errors including 5xx — masking server outages as "signed out".

#### Shared security standards live as middleware, not per-route conventions

When a security-relevant check (authentication, authorization, audit
attribution, live-membership validation) is needed on more than one route,
it MUST live as middleware applied at the router or app level — NOT copied
into each route handler.

The allow-list pattern (opt-in per route) is forbidden for security checks
where the safe default is on. The default for "verify the requester is
still an active member with this permission" is ON, not OFF.

Past violation: pV2-03's `team.js` re-reads live `user_orgs` per request
to honour suspensions. `auth.js` re-derives via `buildSession`. No other
v2 endpoint inherits the check — every new endpoint must remember to copy
the pattern. Fix: extract `requireActiveMembership(perm?)` middleware,
mount at v2 router level, delete inline copies.

#### Duplicate data across boundaries needs automated enforcement

When data must be duplicated across boundaries (client/server, code/DB
seed, two services, two schemas), the duplication MUST have an automated
enforcement mechanism:

- A test that imports both sides and asserts equivalence, OR
- A codegen step that produces one side from the other at build time, OR
- Serving the data from a single authoritative endpoint at runtime

A comment that says "keep in sync" is NOT an enforcement mechanism. Drift
is silent until production breaks.

Past violation: pV2-02 mirrored the permissions MATRIX in
`client-v2/src/app/core/auth/permissions.ts` and
`server/src/services/permissions.service.js` with a comment "keep in sync"
and no test. First uncoordinated edit silently desyncs them.

#### Pure functions in security paths are tested

Pure functions in `core/auth/`, `services/permissions*`, security-relevant
utilities, and route guards MUST have unit tests before the next prompt
builds on them. Vitest is wired in `client-v2`; Node test runner or Jest is
adequate on the server. The cost is minimal; the regression catch is real.

Tests are not optional in these paths. They are not deferred to "when
things stabilise." Security primitives stabilise BY having tests.

Past violation: pV2-02 + pV2-03 shipped `can()`, `effectiveRole()`,
`normalizeOrgType()`, `deriveInitials()`, `auth.guard`, `admin.guard` with
zero specs. All pure. All in security paths.

#### Hygiene rules outrank spec-embedded code

When a prompt's spec contains code, markup, or pseudocode that violates any
rule in this §"Engineering hygiene" section, CC MUST implement the
compliant version — NOT the literal spec — and MUST flag the deviation
explicitly in the ship report's "Concerns not in spec" section under the
heading "Spec-hygiene precedence deviations."

This rule REVERSES `cc-onboarding.md`'s general "visual decisions are
settled in the prompt; don't relitigate" guidance for the specific case of
hygiene violations. The general rule still holds for design choices
(colors, layouts, copy, component shapes). Hygiene rules are different:
they encode invariants that the spec author must also obey, and the spec
author benefits from CC's enforcement when they slip.

This rule also binds the spec author (chat / Liam / anyone drafting a
prompt). Prompts that contain `text-slate-500`, `border-black/10`, raw hex
codes, `EventEmitter`, `*ngIf`, `BEGIN`/`COMMIT` hand-rolled, or any other
hygiene violation are themselves non-compliant and CC's deviation in the
ship report is the correction trail. Spec drift in the OTHER direction
(spec demands a violation; CC implements the violation) is a compounded
failure, not a follow-through.

Past violation: pV2-01b and pV2-01c templates contained `text-slate-500`,
`bg-white/80`, `border-black/5`. CC extended the pattern into pV2-03's
team page because the existing cc-onboarding rule said "don't relitigate
visual decisions." She wasn't taking liberty — she was following the rule
that conflicted. This new rule resolves the conflict in favour of hygiene.
```

### 2. `cc-onboarding.md`

Find the existing "Ship report — write one for every prompt you complete"
section. Add a new subsection at the end of that section:

```markdown
### "Concerns not in spec" — mandatory ship-report section

Every ship report MUST end with a section titled **"Concerns not in spec"**.
List anything you noticed during implementation that:

- The spec didn't ask about
- A careful reviewer would want to know
- Falls into one of these categories:
  - Engineering hygiene rules from WORKING_STANDARDS §"Engineering hygiene"
    that the spec didn't explicitly call out
  - Production-readiness concerns (rate limiting, error logging, metrics,
    health checks, retries, timeouts)
  - Schema decisions that produce dual sources of truth or coupling
  - Performance pitfalls (N+1 queries, unbatched HTTP, unbounded result sets)
  - Security smells (missing input validation, log injection, secret in
    response body)
  - Code patterns that work but feel wrong

Write the section even when empty:

```
## Concerns not in spec
None.
```

When non-empty, format each concern as:

```
### <Short name>
**Where:** file path + line range  
**What:** one-paragraph description  
**Suggested fix:** what you'd do (or note "deferred — needs design decision")  
**Severity:** HIGH / MEDIUM / LOW
```

The PR/spec author then decides: fix now, fix in a follow-up prompt, or
formally defer. The choice is theirs; the SURFACING is yours.
```

### 2b. `prompts/backlog.md` — add `Shipped` status between Ready and Done

Find the "Statuses:" line at the bottom of the backlog and add `Shipped`
between Ready and Done:

```markdown
Statuses: **Draft** (still being written) · **Ready** (ready to implement)
· **Shipped** (CC has committed + written the ship report; awaiting
chat-side audit pass) · **Done** (implemented + audited) · **Mostly Done**
(shipped with some sections deferred) · **Superseded** (don't implement).
```

The `Shipped` status makes the audit-gate state visible in the table.
Currently rows sit at Ready-but-actually-done while the audit pass runs;
that confuses anyone reading the backlog mid-flight. CC flips to `Shipped`
when she posts the ship report. Chat (or Liam) flips to `Done` after the
audit pass clears it.

### 3. `cc-onboarding.md` — also add the audit-before-shipped rule

Find the existing "When you finish a prompt" guidance. Add this at the start
of that subsection:

```markdown
### The shipped status requires a code audit pass

After you write the ship report, **flip the backlog row to `Shipped` and
post the ship report to Liam (or the calling agent) for review.**
**DO NOT flip to `Done` immediately.** Wait for explicit confirmation that
the chat-side audit pass found no blockers, at which point chat/Liam flips
the row to `Done`.

The audit pass:
1. Chat reads the actual code you wrote (not just the ship report)
2. Chat checks for WORKING_STANDARDS violations (especially §"Engineering
   hygiene")
3. Chat compares the "Concerns not in spec" section against what the code
   actually contains — flags any missed concerns
4. Chat either: clears for `Done`, requests a fix commit, or asks for more
   detail in the ship report

This is process, not bureaucracy. The audit catches what the ship report
misses; the ship report catches what the audit misses. Both layers.
```

### 4. Retroactive concerns pass — append addenda to existing reports

For each of `pV2-02-google-oauth-and-users-shipped.md` and
`pV2-03-team-management-shipped.md`, append a new section at the very end:

```
---

## Concerns not in spec (added retroactively on YYYY-MM-DD)

This section was added during pV2-AUDIT-01's retroactive concerns pass. The
original report was silent on these.

### <one block per concern>
```

For pV2-02, include AT MINIMUM violations A, C, D, E, G, H above with the
format specified.

For pV2-03, include AT MINIMUM violations B, F above with the format
specified. (Violation F's structural risk is properly attributed to pV2-03
since that's where the live-membership pattern shipped without being
extracted to shared middleware.)

Light findings I (twin resources), J (hello imperative subscribe), K
(popover keyboard a11y) should be noted in the appropriate report's
addenda too — they're code-quality observations, not WORKING_STANDARDS
violations, so they're flagged-not-blocked.

You may add others you spot now during re-reading. Don't sandbag — surface
everything you'd want a reviewer to know.

## Acceptance

1. `WORKING_STANDARDS.md` has the new "Engineering hygiene — non-negotiable"
   section with all **nine** sub-rules above, each citing the past violation:
   - Multi-statement DB writes are transactional — via the shared `withTransaction(fn)` helper
   - Tokens only — enforced at compile time, with a complete semantic set
   - Auth surfaces require rate limiting
   - JWTs carry identity, not authority
   - Catch blocks justify themselves
   - Shared security standards live as middleware
   - Duplicate data across boundaries needs automated enforcement
   - Pure functions in security paths are tested
   - **Hygiene rules outrank spec-embedded code** (the precedence meta-rule)
2. `prompts/backlog.md` Statuses line includes `Shipped` between Ready and Done.
3. `cc-onboarding.md` has the mandatory "Concerns not in spec" ship-report
   section AND the "audit before shipped" process amendment (with `Shipped`
   as the intermediate state).
3. `pV2-02-google-oauth-and-users-shipped.md` has a "Concerns not in spec"
   addendum covering violations A, C, D, E, G, H plus light findings I + J.
4. `pV2-03-team-management-shipped.md` has a "Concerns not in spec" addendum
   covering violations B, F plus light findings I + K.
5. Single docs-only commit, no code touched in this prompt.
6. Reply with: commit SHA, confirmation each acceptance item is in place, and
   any concerns YOU noticed while re-reading the code that aren't in my list
   above.

## Out of scope

- Fixing the actual code (transactions, rate limiting, Tailwind colors, etc.)
  — separate prompts to follow
- Touching the prompt files themselves (only WORKING_STANDARDS,
  cc-onboarding, and the two ship reports)
- Bumping version chip (docs only)
- Touching v1 (`client-angular/`)

## Bump + ship

1. No version chip bump (docs only)
2. Commit message: `docs: strengthen engineering hygiene rules + ship-report concerns section (pV2-AUDIT-01)`
3. After commit: post to Liam for the audit-before-shipped pass (this prompt
   eats its own dogfood)
4. Flip backlog row only after Liam confirms

## Reply with

- Commit SHA
- Confirmation each of the 6 acceptance items is in place
- Any additional concerns you noticed while re-reading the code (you're
  encouraged to add to the retroactive addenda beyond my list)
