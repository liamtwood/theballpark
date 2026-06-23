# pV2-02b — Public landing page + onboarding flow · SHIPPED

**Status:** Shipped (awaiting chat audit pass before Done)
**Version chip:** `[Dev v2] v2.07a`
**Branch:** dev — two commits as specified.

## Commits

| # | SHA | What |
|---|-----|------|
| 1 | `b418f28` | Public landing page + route restructure. `/` → new `LandingComponent` (brand hero, Sign In + "Sign Up — it's free", both → /auth/google); hello surface → `/home` under the shell; wordmark/devLogin/auth-callback retarget /home; `/login` demotes to the dev-picker surface (public chrome, redirects to `/` when the picker list is empty). Wordmark extracted to `<app-wordmark>` + `<app-public-header>` shared by landing/login — no duplicated chrome. |
| 2 | `eb7152a` | Onboarding flow. Server: user-row-only upsert step 3, partial (org-null) session for orgless users, `POST /api/onboarding/create-org` (validate → 409 if membered → org + admin membership + default_org_id in one `withTransaction` → re-signed cookie), `signSessionCookie` extracted to `auth-cookie.service.js` **with the deprecated JWT claims dropped** (approved scope addition — completes AUDIT-02 fix 3). Client: nullable `SessionUser` org fields + `hasActiveOrg`, `requiresOrgGuard` (replaces deleted `authGuard`), `needsOnboardingGuard`, onboarding page with typed form + radio tiles + `defaultOrgName()` pre-fill, `errorDetail` extracted to `core/http-error.ts`. 13 new specs. |

## Acceptance — 13/13 + 0a–0f

- **0a** `/` logged out renders the public landing (no avatar, no shell, chip v2.07a) — verified in preview.
- **0b/0c** Both CTAs call `AuthService.loginWithGoogle()` (same `/auth/google` endpoint) — code-verified; the real Google round-trip is your QC step as with pV2-02.
- **0d** `/login` in dev renders the picker (4 seeded users) — verified.
- **0e** `/login` with an empty picker list redirects to `/` — code-verified (effect on the resource); not live-tested in prod mode.
- **0f** Shell wordmark href is `/home` — verified.
- **1** Orgless authenticated user lands at `/onboarding`, not `/home` — verified with an injected orgless session (created via the new step 3).
- **2** Pre-fill `"Onboarding's Agency"` from display name "Onboarding Tester" — verified.
- **3** Radio flip swaps suffix ("Onboarding's Supplier" ↔ Agency); after a manual edit the field survives flips — verified live.
- **4** Atomicity — rollback drill through the REAL endpoint: a validly-signed JWT for a non-existent user passes `authenticate`, org INSERT succeeds, membership INSERT hits the FK → 500, org count unchanged, zero orphan rows.
- **5** `default_org_id` set in the same transaction — verified in DB.
- **6** Fresh cookie carries the new org: post-submit `/auth/me` shows the org populated AND the gated `/api/team` returns 200 on the new token.
- **7** Submit hard-reloads to **/home** (approved deviation, below); hero renders "Hello, Onboarding Tester" as supplier_admin at the new org.
- **8** Orgless user on a shell URL bounces to `/onboarding` (requiresOrgGuard) — verified.
- **9** Has-org user typing `/onboarding` bounces to `/home` — verified.
- **10** Invitee flow intact — simulated stub + invited membership, then the Google email-link branch: same user row linked, invited→active with joined_at, session lands `/home`, never sees onboarding.
- **11** v1 unchanged — 4200 page 200; ungated v1 API endpoints (statuses/orgs/brand) 200 with no cookie; gated /api/team still 401.
- **12** `ng build` clean, `ng lint` + raw-color guard clean, 0 `any`, no NgModules/`*ngIf`, token-only colors throughout the new components.
- **13** Tests: `org-name-default.spec.ts` (7), `requires-org.guard.spec.ts` (3), `needs-onboarding.guard.spec.ts` (3); admin.guard spec updated for the /home bounce. Suite: 39 client + 13 server, all green.

Test fixtures were soft-deleted afterwards (audit-respecting cleanup — no trigger bypass).

## Concerns not in spec

### Spec-hygiene precedence deviations (Rule 9)

1. **Success redirect → `/home`, not `/`** — pre-approved. The spec's C6/A7 still said `/`, but Section A made `/` the public landing page; reloading there would strand the new user on marketing chrome.
2. **`buildSession` moved AFTER the transaction commits** — the spec's sketch called it inside `withTransaction`, but `buildSession` queries via the shared pool (a different connection): under READ COMMITTED it cannot see the uncommitted org/membership rows, so the sketch would have signed a cookie from the *orgless* session every time. This is the bug class the prompt's concern #3 hinted at, one layer up.
3. **`authWriteLimit` on create-org** — the spec didn't mention rate limiting, but the endpoint signs session cookies, which makes it an auth surface under the hygiene rules (10/min per IP, same as /auth writes).
4. **`users.role` set explicitly to NULL** — the spec said leaving it NULL "is correct," but the column carries v1's `DEFAULT 'member'`: the sketch's INSERT (omitting the column) would have silently re-granted the legacy authority value. The insert now passes NULL explicitly, with a comment.

### The prompt's three named checks

5. **Nullable `activeOrgId` fallout** — audited every `SessionUser` consumer: no non-null assertions anywhere. Orgless users can't reach the shell (requiresOrgGuard), so user-menu/team templates never see null org fields; `can(null-role)` already returns false from AUDIT-02's tests.
6. **`signSessionCookie` extraction / circular imports** — none: `auth-cookie.service.js` depends only on `jsonwebtoken` + `middleware/authenticate` (for COOKIE_NAME); nothing in that chain imports routes.
7. **Audit attribution through `withTransaction`** — verified: `orgs.created_by` = the acting user's id on the real created org (the ALS userId is set by `authenticate` from the JWT `sub`, which is the same user the membership is created for).

### Other observations

8. **Create-org race** (pre-approved): two concurrent submits could both pass the 409 pre-check → two orgs. Accepted for a single-human form; `SELECT … FOR UPDATE` inside the txn is the five-line fix if it ever surfaces. Comment in code.
9. **Old 7-day JWTs still carry the deprecated claims** until they expire (≤7 days from their signing). Nothing reads them (middleware overwrites), no action needed — just noting the window during which both token shapes coexist.
10. **Soft-deleted users now 401 as "Unknown user" on /auth/me** — observed during cleanup; correct and slightly better than before (previously a deleted user with a live cookie read as "no membership").
11. **`/login` 0e redirect is effect-based** — it fires when the resource resolves empty. In prod the page flashes the public header for ~1 round-trip before redirecting. Cosmetic; worth nothing unless QC finds it jarring.
12. **Landing page for signed-in users** is intentionally not auto-redirected (spec edge table); the header still says "Sign In." If that reads oddly in QC, a `hasActiveOrg() → show "Go to app →"` link is a tiny follow-up.
