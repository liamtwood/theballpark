# pV2-AUDIT-03 — API audit checklist + Helmet + Zod · SHIPPED

**Status:** Shipped (awaiting chat audit pass before Done)
**Version chip:** `[Dev v2] v2.08a`
**Branch:** dev — three commits as specified.

## Commits

| # | SHA | What |
|---|-----|------|
| 1 | `e24bcbf` | `helmet` + `zod` installed; Helmet mounted ahead of CORS with the API-shaped config (no CSP — we serve no HTML; CORP `cross-origin` for the SPA). Verified live: `X-Powered-By` gone; `X-Frame-Options: SAMEORIGIN`, `nosniff`, HSTS present. |
| 2 | `a6b388b` | "API audit checklist — per-endpoint walk" (8 sub-areas + past-violations footer) added under WORKING_STANDARDS §Engineering hygiene; cc-onboarding gains the ship-report obligation with the example format. |
| 3 | `e059d95` | `create-org` refactored to `CreateOrgSchema` (`server/src/schemas/onboarding.schema.js`) — the example for the pattern; 6 schema specs (server suite now 19); 400s return `{ error, details: fieldErrors }`. |

## Acceptance — 7/7

1. ✓ WORKING_STANDARDS has the checklist with all 8 sub-areas + past-violations footer.
2. ✓ cc-onboarding has the per-route ship-report instruction + example format.
3. ✓ Helmet installed + mounted with the documented config (live-verified headers).
4. ✓ Zod direct dependency; ONE endpoint refactored (create-org); others migrate as touched.
5. ✓ `npm audit` baseline (below).
6. ✓ Three commits, chip v2.08a.
7. ✓ This report includes "Concerns not in spec" + the checklist walk.

## npm audit baseline — 2026-06-11

- **server**: **10 vulnerabilities (8 moderate, 2 high, 0 critical)** — all transitive: `path-to-regexp` (via express, ReDoS), `qs` (DoS), `ws` (memory disclosure), `uuid`, `picomatch`, `brace-expansion`. Every one reports "fix available via `npm audit fix`" — left untouched this prompt (dep bumps deserve their own commit + regression pass).
- **client-v2**: **0 vulnerabilities**.

Future PRs reference this baseline; new criticals/highs above it are ship-blockers.

## API audit checklist walk — `POST /api/onboarding/create-org` (the endpoint touched)

**Endpoint shape**
- ✓ POST creates a resource (org + membership), non-idempotent
- ✓ Path is nouns (`/api/onboarding/create-org` — "create-org" is arguably a verb; kept for parity with the spec'd path, noted below)
- ✓ Mount convention: documented exception to the v2 gate (orgless users by definition; comment at the mount site)

**Input validation**
- ✓ Body via `CreateOrgSchema` (enum + trimmed 2–100 string); unit-tested
- N/A URL slots / query params — none
- ✓ 400 returns `{ error: 'Invalid input', details: { field: [...] } }` — live-verified
- ✓ All queries parameterised; zero interpolation
- ✓ Body well under Express's 100kb default

**Authorization**
- ✓ `authenticate` applied; `requireActiveMembership` deliberately NOT (orgless audience) — documented
- ✓ org_id not taken from request anywhere; the org is CREATED and the user becomes its admin
- N/A cross-org read/write — no foreign resource touched; the 409 pre-check is scoped to `req.user.id`

**Status codes**
- ✓ 200 with SessionUser on success (not 201 — see concern #3), 400 invalid input, 401 no/invalid session, 409 existing membership, 429 via authWriteLimit, 500 via centralised handler

**Response shape**
- ✓ Success returns the established `SessionUser` shape; errors `{ error, details? }`
- ✓ No PII beyond the caller's own session; no JWT echo (cookie only)
- ✓ No schema details in errors ("You already belong to an organisation")

**Information disclosure**
- ✓ Error messages generic; no SQL/table names
- ✓ No stack traces in responses; `X-Powered-By` now removed by Helmet (this prompt)

**Observability**
- ✓ 5xx path flows through the centralised error handler (logs error + 500 generic). Route-level context is thin — see concern #2

**Idempotency**
- N/A POST non-idempotent by design; double-submit guarded client-side (inFlight) and server-side (409 on the second pass once the first commits; the known benign race documented in code)

**Performance**
- ✓ Single transaction, no loops, no SELECT *, no collection responses

## Concerns not in spec

1. **Zod v4, not v3** — the prompt's "already in node_modules" assumption was outdated (fresh install resolved v4) and its sketch's `parsed.error.flatten()` is deprecated in v4; used `z.flattenError()`. Future Zod snippets in prompts should assume v4 API.
2. **Observability checklist item is aspirational for now** — the centralised handler logs errors but not structured-JSON route context, and security events (failed auth, permission denials) aren't systematically logged. The checklist documents the bar; actually meeting "structured logs + security-event logging" across the server is its own small prompt.
3. **create-org returns 200, not 201 + Location** — the checklist's own 201 rule says POSTs that create resources should 201 with a Location header. The endpoint pre-dates the checklist (pV2-02b) and returns the refreshed SessionUser rather than the org as a resource; there's no `GET /api/orgs/:id` to point a Location header at yet. Left as-is (changing the contract under the already-QC'd onboarding flow isn't worth it); flagged as the first known checklist deviation, to revisit when an org resource URL exists.
4. **`create-org` path is verb-ish** — the checklist prefers nouns (`POST /api/onboarding/org` would be cleaner). Kept the spec'd path: it shipped in pV2-02b, the client calls it, and renaming a one-week-old endpoint adds churn for purity. Future endpoints follow the noun rule.
5. **npm audit fix is one command away** — all 10 server findings are transitive with non-breaking fixes available. Worth a standalone `chore` commit with a quick smoke pass; didn't bundle it here (out of the prompt's scope and dep bumps shouldn't ride along).
6. **Post-commit log hook misfired again** (commit `e24bcbf`, second occurrence after AUDIT-02's fix-6 commit) — caught and manually logged. The hook's `2>/dev/null || true` keeps hiding the cause; the backlog item from the AUDIT-02 report is now twice-justified.
