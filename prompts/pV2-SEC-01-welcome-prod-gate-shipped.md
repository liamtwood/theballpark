# pV2-SEC-01 — Welcome prod-gate: interim admin-secret gate + 2 latent ride-alongs

**Shipped:** 2026-06-18, chip `[Dev v2] v2.31i`
**Commits:** `<pending>` (interim admin-secret gate on /api/admin/* + param LIMIT/OFFSET + marketing REVOKE + TECH-DEBT-01)

Pre-prod security review of the welcome surface (scope (a): welcome only)
found one exploitable issue + two latent items. This ship closes the
exploit and folds in both latents.

## The finding (HIGH — closed here)
`/api/admin/*` was gated only by `requireAdmin`, which trusted the
client-supplied `x-bp-user-id` header (no session/secret). `GET /api/org/users`
is unauthenticated and returns every user's `id` + `role`. Chain: anon hits
`/api/org/users` → grabs an admin UUID → sends it as `x-bp-user-id` →
`GET /api/admin/signups` dumps every guestlist signup's **name + email**, and
can PATCH live welcome content/settings, DELETE signups, and trigger Resend
test-sends. Verified against the code before fixing.

## What landed
- **Admin secret gate** (`admin.js`): when `ADMIN_API_SECRET` is set
  (preview/prod), `/api/admin/*` requires a matching `x-bp-admin-secret` header
  (constant-time compare). Knowing an admin UUID no longer grants anything —
  the forgery path is closed. When the env is unset (local dev), it falls back
  to the legacy `x-bp-user-id` role lookup as an explicit dev-only bypass.
  `x-bp-user-id` (uuid-shaped) is still captured as `req.adminUserId` for audit
  attribution on writes, on either path.
- **LIMIT/OFFSET parameterized** (`marketing.service.js` `listSignups`): the one
  concatenated-SQL spot now binds `$n` params. Was `Number()`-coerced (not
  injectable) — defence-in-depth.
- **`marketing` added to the REVOKE/RLS hardening loop** (`migrate-schemas.js`):
  the schema was omitted from the anon/authenticated grant-revoke that
  public/preview/master get, so the guestlist PII would be anon-reachable if
  PostgREST/anon access were ever enabled. Now revoked. Public welcome page
  unaffected (Express owner connection, not anon).
- **TECH-DEBT-01 logged** in `docs/AUDIT_LEDGER.md` with hard sunset condition.

## Deliberate deviation from the requested scope
The original plan said "drop `id`/`role` from the unauthenticated
`/api/org/users`." Not done — and here's why: the v1 client
(`client-angular`) reads `users[0].id` from that endpoint to self-identify and
set `x-bp-user-id`, and `user-context.js` audit attribution reads the same
header. Dropping `id` breaks v1's identity bootstrap and audit attribution for
**no exploit-closing benefit the secret gate doesn't already provide**. The
residual — `/api/org/users` returning `SELECT *` (incl. name/email) to
anonymous callers — is a v1-era dev-shim, not part of the v2/welcome surface,
and retires at pV2-AUTH-01 (recorded in TECH-DEBT-01). Flagged for Liam's call.

## Files touched
| File | Notes |
|---|---|
| `server/src/middleware/admin.js` | Rewritten: two-tier gate (secret primary, x-bp-user-id dev bypass), constant-time compare, audit-attribution capture |
| `server/src/services/marketing.service.js` | `listSignups` LIMIT/OFFSET bound as `$n` |
| `server/src/db/migrate-schemas.js` | `marketing` added to REVOKE/RLS hardening loop + comment |
| `docs/AUDIT_LEDGER.md` | New "Sunset-tracked tech debt" section + TECH-DEBT-01 row |
| `client-v2/src/environments/environment.ts` | chip → v2.31i |

## Verification
- All three server files `node --check` clean.
- Gate behavioral test (6/6 PASS), incl. the critical **"secret set + forged
  user-id only → 403"** (exploit closed) and audit-attribution still captured.
- `marketing` REVOKE: all 8 statements executed against local DB without error
  (run in a transaction + rolled back).

## API audit checklist — `/api/admin/*` (gate changed; routes unchanged)
- ✓ **Authorization** — now a server-held secret (`ADMIN_API_SECRET`) over a
  constant-time compare; prior forgeable-header escalation closed. Dev bypass
  only when the secret is unset.
- ✓ **Information disclosure** — gate failures return a generic
  `403 Admin access required`; no secret echoed.
- ✓ **Observability** — acting user captured as `req.adminUserId` for the audit
  stamp on content/settings writes.
- N/A method semantics / input validation / response shape — routes themselves
  unchanged.

## Deploy prerequisites for preview QC (need Liam — env + manual migration)
1. Set `ADMIN_API_SECRET` on the **preview** Railway backend (and later prod).
   Without it, the dev-bypass path stays active and the gate is NOT enforced.
2. Run the marketing REVOKE migration against the **preview** DB (migrations are
   manual): `DATABASE_URL=<preview> npm run db:migrate:schemas`.

## Concerns not in spec
### `/api/org/users` PII exposure (residual)
**Where:** `server/src/index.js` (`GET /api/org/users`) + `server/src/services/user.service.js` (`getByOrg` = `SELECT *`)
**What:** Returns all active users' name/email/role to anonymous callers. Not closed here (v1 self-identifies from it; can't harden without breaking v1 bootstrap). The secret gate removes its value as an escalation vector; the PII exposure remains until v1 retirement / AUTH-01.
**Suggested fix:** gate/scope at pV2-AUTH-01 (tracked in TECH-DEBT-01).
**Severity:** MEDIUM (PII to anon; not an escalation vector post-fix)

### v1 admin marketing dashboard in prod
**Where:** `client-angular` marketing admin → `/api/admin/*`
**What:** A browser SPA can't hold `ADMIN_API_SECRET`, so once the secret is set on the prod backend the v1 admin signups dashboard can't authenticate. Signups still record + email; browsing them in the v1 UI goes dark until the v2 admin UI lands at AUTH-01. Operators can use the secret via curl/tooling in the interim.
**Suggested fix:** accept for the interim, or stand up a minimal authed v2 admin view at AUTH-01.
**Severity:** LOW (operational, not security)

## Preview QC — v2.31i (2026-06-18)
**Promoted:** `preview` ← `dev` (`cf7776ba → d8f9f8a7`); staging chip `[Staging v2] v2.31i`.
**Preview migration:** `migrate-schemas` run against preview DB (host
`aws-1-us-east-1.pooler.supabase.com`, db `postgres`) — exit 0, hardening line
read `public/preview/master/marketing`, no errors. Post-check: marketing schema
ended with **0** anon/authenticated USAGE grants, **0** table grants, RLS `true`
on `guestlist_signup` / `welcome_content` / `welcome_settings`.

Gate behaviour against the live preview backend
(`https://theballpark-preview-preview.up.railway.app`):
- `GET /api/admin/signups` no headers → **403** (proves new code live **and**
  `ADMIN_API_SECRET` set — old/dev-bypass path returns 401).
- Forged `x-bp-user-id` only → **403** (exploit closed).
- `GET /api/welcome/content` (public) → **200** (REVOKE didn't break public path).
- Local dev-bypass (no secret) + real admin id → `next()` (permissive path intact).

**Not verified here (need the secret / browser):** `curl` *with* the correct
`x-bp-admin-secret` → 200 (Liam has the secret); full in-browser signup +
notification email (Turnstile-gated; fix doesn't touch the signup path).

## Iteration — v2.31j (2026-06-18): graceful-degrade unauth routing
**Triggered by:** pre-`master`-push verification — for the prod-promote window
(no real auth yet, pV2-AUTH-01 pending) unauth/unknown URLs must land on the
public `/welcome`, not `/login` or a broken state.
**Scope guard:** NOT auth implementation (that's pV2-AUTH-01) — just the redirect
targets for the cutover window.
**Files:** `client-v2/src/app/app.routes.ts` (`**` catch-all `'' → 'welcome'`);
`client-v2/src/app/core/auth/requires-org.guard.ts` (signed-out
`/login → /welcome`).
**Verified (local prod-equivalent client build, routing is client-side):**
- logged-out `/projects` → `/welcome` (requiresOrgGuard).
- unknown route (`**`) → `/welcome`, welcome page rendered, no error overlay.
- clean `ng` build (5.4s, no errors).
Signed-in-orgless → `/onboarding` unchanged; admin/ballpark guards (authed users)
unchanged.

## Prod assessment & disposition (2026-06-18)
Probed prod before any `master` push:
- `theballpark.ai` serves a **stale/incomplete v2 build** (old bundle
  `main-LDLHEDCZ.js`; `/runtime-config.json` returns index.html via the SPA
  rewrite → no real API config wired) — not a functioning prod. Matches Liam:
  "v1 was never deployed."
- Prod backend `theballpark-production.up.railway.app` returns **404** for
  `/api/admin/signups` + `/api/welcome/content` — it doesn't serve the v2
  marketing/admin routes. **No live prod exploit.**
- `master` is **1482 commits / 647 files** behind `dev` → `dev→master` is the
  full v1→v2 production launch, not a patch.
- `.env.preview` and `.env.master` are the **same Supabase DB** (project
  `ixdcmicxlszcbrxvvzjz`; preview via pooler `:6543`, master via direct `:5432`)
  → the `marketing` REVOKE applied via the preview run already covers prod data.

**Disposition:** security objective **MET** — the vulnerable code only ran on
preview (now fixed + `ADMIN_API_SECRET`) and local (dev-bypass); nothing is
exposed on prod. The prod cutover is deferred to its own deliberate milestone;
the secret gate + graceful-degrade routing already live in the code and ship
with it. **Hard prerequisite for the cutover:** set `ADMIN_API_SECRET` on the
prod Railway backend BEFORE the v2 server code goes live, or the launch itself
opens the gate.

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in)
