# pV2-AUDIT-03 — API audit checklist + Helmet + JSON Schema validation

## Read first

1. `WORKING_STANDARDS.md` (with Engineering hygiene from AUDIT-01)
2. `prompts/cc-onboarding.md`
3. This prompt

## Why this prompt exists

The chat + angular-developer audits cover client TypeScript thoroughly and
catch security primitives on the server (transactions, JWT lifetime, rate
limiting). What's NOT systematically covered: the API surface itself —
input validation per field, status code correctness, response shape
consistency, security headers, error message disclosure, observability.

A web survey of API audit guidance (OWASP, MS Learn, Postman, Wiz,
AccuKnox) converges on a tight set of items every endpoint should pass.
This prompt codifies them as a per-endpoint checklist CC walks during ship,
plus three concrete additions to the codebase:

1. Install Helmet (security headers)
2. Add structured input validation (Zod — already in `node_modules`)
3. Add the API audit checklist to WORKING_STANDARDS

## What changes

### 1. Add "API audit checklist" to `WORKING_STANDARDS.md`

New section under "Engineering hygiene — non-negotiable":

```markdown
### API audit checklist — per-endpoint walk

When you write or modify any `server/src/routes/*.js` endpoint, walk this
checklist BEFORE the ship report's "Concerns not in spec" section. Items
that don't apply, mark N/A with a brief reason.

**Endpoint shape**
- [ ] HTTP method matches semantics: GET (idempotent read), POST (create / non-idempotent), PATCH (partial update), PUT (full replace), DELETE
- [ ] URL path uses nouns + ids, no verbs (e.g. `/api/team/:userId/status`, not `/api/suspendUser`)
- [ ] Routes follow the existing v2 mount convention (under the v2 router that applies `requireActiveMembership`)

**Input validation — every field, every source**
- [ ] Every body field validated for type, length, allowed values (use Zod schema, no ad-hoc `if (!body.x) ...`)
- [ ] Every URL slot (`:userId`) validated as UUID / expected shape
- [ ] Every query param validated
- [ ] Validation failure returns **400** with `{ error: "...", details: { fieldName: "what's wrong" } }`
- [ ] No SQL injection surface — every query parameterised (`$1, $2 ...`); zero string interpolation
- [ ] `req.body` size limits set at app level (Express default 100kb is fine for our shapes; flag if a route needs larger)

**Authorization — who can hit this**
- [ ] `authenticate` middleware applied (or explicit decision to allow anonymous)
- [ ] `requireActiveMembership(perm?)` applied (post-AUDIT-02 Fix 1)
- [ ] Permission name matches what `can()` defines — no typos, no missing entries in MATRIX
- [ ] `org_id` ALWAYS sourced from `req.user.org_id`, NEVER from request body / query / URL
- [ ] Cross-org reads: rows scoped to `req.user.org_id` in the WHERE clause — verified by trying to fetch another org's resource by id and getting 404 (not 403 — see "Information disclosure" below)
- [ ] Cross-org writes: same rule, write target's `org_id` matches `req.user.org_id`

**Status codes — correct, consistent**
- [ ] 200 OK — read or update succeeded
- [ ] 201 Created — POST that created a resource, response includes `Location` header with new URI
- [ ] 204 No Content — successful action with no body to return (logout, delete)
- [ ] 400 Bad Request — input failed validation
- [ ] 401 Unauthorized — no/invalid session
- [ ] 403 Forbidden — authenticated but no permission
- [ ] 404 Not Found — resource doesn't exist OR caller doesn't have permission to know it exists (cross-org case)
- [ ] 409 Conflict — duplicate / constraint violation (e.g. invite for email that's already a member)
- [ ] 422 Unprocessable Entity — input syntactically valid but semantically wrong (rare, but if used, be deliberate)
- [ ] 429 Too Many Requests — rate limit exceeded
- [ ] 500 Internal Server Error — unexpected; logs the error, returns generic message

**Response shape — consistent**
- [ ] Success responses follow the established shape (`SessionUser`, `TeamMember`, etc.)
- [ ] Error responses follow ONE shape: `{ error: "...", details?: { ... } }`
- [ ] No PII / secrets in response (never echo back the JWT, never include passwords, never include other users' email in collection responses unless required)
- [ ] No leaked schema details ("user_orgs row not found" → "Member not found")
- [ ] Timestamps are ISO-8601 strings; UUIDs are strings; booleans are booleans

**Information disclosure — what attackers learn**
- [ ] 404 used for "exists but you can't access" (don't leak that the resource exists)
- [ ] Error messages don't mention SQL, table names, column names
- [ ] No stack traces in responses (Express default behaviour in prod is fine; verify NODE_ENV=production hides them)
- [ ] Headers don't reveal versions (`X-Powered-By` removed by Helmet)

**Observability — debugging future-you**
- [ ] Unexpected errors (5xx path) log enough context to debug: route, params (no secrets), error message + stack
- [ ] Security-relevant events log: failed auth attempts, permission denials, suspended-member access attempts
- [ ] Logs are structured (JSON) where the platform supports it (Railway parses JSON logs)

**Idempotency — safe to retry**
- [ ] GET: always safe (no side effects)
- [ ] PUT / PATCH: same body sent twice produces same end state
- [ ] DELETE: sending DELETE twice returns 204 both times (or 404 the second — pick one and document)
- [ ] POST: explicitly non-idempotent; if the client retries, duplicate creation is acceptable OR an idempotency key is supported

**Performance — pre-emptive checks**
- [ ] No N+1 query loops (any `for` over rows + per-row query → flag)
- [ ] Indexes exist for WHERE columns on tables >10k rows expected
- [ ] LIMIT applied to collection responses (paginate or cap at e.g. 100)
- [ ] No SELECT * — explicit column list (lets indexes do covering scans)

**Past violations to recognize**
- pV2-02's `/auth/logout` didn't mirror `clearCookie` options to `set` options (status code was right; the bug was elsewhere — checklist item: "session-clearing endpoints mirror set options")
- pV2-02's team endpoints inlined the membership re-read instead of using shared middleware (Violation F — covered by AUDIT-02 Fix 1, but still on this checklist to catch future cases)
- pV2-03's invite endpoint had no length bound on `displayName` / `jobTitle` (caught in CC's AUDIT-01 retroactive concerns finding #4)
```

### 2. Install Helmet

`server/`:

```bash
npm install helmet
```

In `server/src/index.js`, mount Helmet near the top of the middleware chain:

```javascript
const helmet = require('helmet');

const app = express();
app.set('trust proxy', 1);   // from AUDIT-02 Fix 4

// Security headers. Defaults are sensible for an API; the SPA's HTML is
// served from Vercel and gets its own CSP there.
app.use(helmet({
  contentSecurityPolicy: false,   // we don't serve HTML; SPA host owns CSP
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },   // SPA on different origin
}));
```

This adds: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`,
removes `X-Powered-By: Express`, and a handful of other defaults.

### 3. Install + use Zod for input validation

`zod` is already in `node_modules` (transitive from elsewhere). Add it as a
direct dependency:

```bash
cd server
npm install zod
```

Refactor `server/src/routes/onboarding.js`'s create-org endpoint (from
pV2-02b, if shipped by then; otherwise refactor `routes/team.js`'s invite
endpoint as the example) to use Zod:

```javascript
const { z } = require('zod');

const CreateOrgSchema = z.object({
  orgType: z.enum(['agency', 'supplier']),
  orgName: z.string().trim().min(2).max(100),
});

router.post('/create-org', authenticate, async (req, res, next) => {
  const parsed = CreateOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid input',
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const { orgType, orgName } = parsed.data;
  // ... rest of handler
});
```

The Zod schema is the canonical source of truth for what the endpoint accepts.
Replaces ad-hoc `if (!body.x || typeof body.x !== 'string') ...` chains.

Define schemas in `server/src/schemas/` so they can be unit-tested independently
and shared across routes if needed.

### 4. Add the audit checklist to `cc-onboarding.md`

Find the "Concerns not in spec" section (added in AUDIT-01). Add a new
subsection:

```markdown
### API audit checklist — required for every server route touched

When a prompt touches any `server/src/routes/*.js` file, your ship report
MUST include the API audit checklist from WORKING_STANDARDS §"API audit
checklist — per-endpoint walk" filled in per endpoint.

Format:

#### `POST /api/onboarding/create-org`
- ✓ HTTP method semantics: POST creates a resource
- ✓ Input validation: Zod schema CreateOrgSchema covers orgType, orgName
- ✓ Authorization: authenticate (orgless user can hit this)
- ✓ Status codes: 200 success, 400 invalid input, 401 no session, 409 existing membership
- ✓ Response shape: returns SessionUser; error shape { error, details }
- ✓ Information disclosure: error messages generic
- ✓ Observability: 5xx path logs route + error
- N/A Idempotency: POST is non-idempotent by design
- ✓ Performance: single transaction, no loops

For routes you didn't touch, you don't need to walk the checklist — only the
ones you wrote or modified.

This is process, not bureaucracy. Five minutes per endpoint catches issues
that take hours to debug post-deploy.
```

## Acceptance

1. `WORKING_STANDARDS.md` has the "API audit checklist — per-endpoint walk" section under Engineering hygiene with all 8 sub-areas and the "Past violations" footer
2. `cc-onboarding.md` has the "API audit checklist — required for every server route touched" instruction with the example format
3. `helmet` installed and mounted in `index.js` with the documented config
4. `zod` installed as a direct dependency; at least ONE endpoint refactored to use a Zod schema (the example) — others migrate during their next touch, NOT all-at-once
5. `npm audit` baseline captured in the ship report (snapshot count of critical/high CVEs at time of shipping; future PRs reference this)
6. Single docs + small code commit; version chip `[Dev v2] v2.08a`
7. Ship report includes "Concerns not in spec" + the API checklist walk for the one endpoint touched

## Out of scope

- Refactoring ALL existing endpoints to use Zod — that happens during normal feature work as each endpoint is touched
- Migration of ALL ad-hoc validation — same; opportunistic
- API documentation generation (OpenAPI/Swagger) — separate prompt later
- Full OWASP API Top 10 audit pass — checklist covers the common items; full pen-test is a future activity

## Bump + ship

1. Version chip `[Dev v2] v2.08a`
2. Commit messages:
   - `chore: install helmet + zod for API hardening`
   - `docs: API audit checklist (per-endpoint walk) in WORKING_STANDARDS + cc-onboarding`
   - `refactor: onboarding/create-org uses Zod schema (example for new pattern)`
3. Ship report `prompts/pV2-AUDIT-03-api-audit-checklist-shipped.md`
4. Flip backlog row to `Shipped`; await audit-before-shipped pass

## References

OWASP API Security cheatsheets + REST cheatsheets + Helmet docs +
Zod docs underpinned the choices here. See the chat that drafted this prompt
for the original web search outputs.
