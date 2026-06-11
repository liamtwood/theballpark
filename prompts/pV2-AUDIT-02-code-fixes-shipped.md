# pV2-AUDIT-02 — Code fixes for the AUDIT-01 violations · SHIPPED

**Status:** Shipped (awaiting chat audit pass before Done)
**Version chip:** `[Dev v2] v2.06a`
**Branch:** dev — ten commits, priority order as specified.

## Commits

| # | SHA | What |
|---|-----|------|
| 0 | `192069e` | `withTransaction(fn)` helper — BEGIN → `set_config('app.current_user_id', …, true)` from ALS → fn(client) → COMMIT; ROLLBACK + rethrow on throw; release in finally. The GUC interplay lives in ONE place. |
| 1 | `9a79560` | `requireActiveMembership(perm?)` middleware + gated v2 router. Live `user_orgs`+`orgs` query per protected request, cached on `req.freshMembership` (stacked instances = 1 query); overwrites `req.user`'s authority fields with DB truth; 403 on missing/suspended membership or failed perm check. `team.js` degutted to `router.use(authenticate, requireActiveMembership('org.invite_member'))`. |
| 2 | `26dad8b` | Brand-new-signup branch of `upsertUserFromGoogle` wrapped in `withTransaction` — forced mid-txn failure left zero orphan orgs; ALS attribution (`created_by`) verified. |
| 3 | `4af5ce4` | JWT `org_type`/`is_admin`/`role` claims commented **DEPRECATED** (backward-compat only; middleware overwrites with live truth); `org_id` annotated identity-adjacent with its move-out condition. Grep: zero consumers authorize off the stale claims. |
| 4 | `ae149e7` | `express-rate-limit` on `/auth/*` + `/api/dev/users` (write 10/min, read 30/min, oauth 30/min) + `app.set('trust proxy', 1)`. Verified: same-IP 11th hit → 429; distinct X-Forwarded-For → separate buckets. |
| 4b | `34d01f8` | `sessionCookieOptions()` factory — `clearCookie` mirrors every set option (the AUDIT-01 finding Liam promoted). Login → me 200 → logout → me 401 verified; clear header carries `Path=/`. |
| 5 | `bfeacc8` | Tailwind palette **REPLACED** with token-only map; semantic state tokens (`success/warn/danger/info/action` + `-soft`) + structure tokens in styles.css; ~50 raw-color classes migrated across 9 files; `scripts/check-raw-colors.js` chained into `npm run lint`. |
| 6 | `9608a1a` | First test batch — 41 specs (28 vitest / 13 node:test) incl. the client↔server matrix **parity** spec (createRequire across the boundary). Server gains `npm test`. |
| 7 | `851ed7e` | Catch blocks justify themselves: `loadSession` warns on non-401; dev-picker error classification centralized in `listDevUsers` (401/403 silent by design, anything else warns). |
| 8 | `493f2c3` | hello health probe → `httpResource` via new `ApiService.getResource<T>()`; **zero** raw `.subscribe` in client-v2. |

Plus the chip bump + this report (ship commit).

## Verification highlights

- **Fix 1**: suspension bites immediately — Sarah 200 / member without perm 403 "Permission denied" / suspended 403 "Membership suspended or revoked" / unsuspend restores. Unknown `/api/*` now 401s (accepted behavior change); all v1 routes verified untouched.
- **Fix 2**: statement-2 varchar violation → org count unchanged (rollback proof); success run carries acting user in `created_by` (GUC survives the txn).
- **Fix 5**: violation drill — raw class added → `check-raw-colors.js` exits 1 while `ng build` passes silently (see concerns); dist CSS contains zero raw-palette selectors and emits every token utility incl. not-yet-rendered states (`warn`, `medium`); computed-style parity confirmed live on `/login`, `/` (hello success states), `/settings/team`.
- **Fix 6**: parity drill — removing `cart.checkout` from the server's `agency_member` fails the spec with "role agency_member diverges". Guards run every role through the REAL matrix.
- **Fix 7**: live proof — transient dev-server restarts produced `[auth] /auth/me failed unexpectedly` warns (status-0 faults) while steady-state stays silent.
- Full suite at ship time: `ng build` clean, client `npm test` 28/28, server `npm test` 13/13, `npm run lint` (ESLint + raw-color guard) clean.

## Concerns not in spec

### Spec-hygiene precedence deviations (Rule 9)

1. **v2 router mount order** — the spec's sketch mounted the gated v2 router at `/api` before the v1 routes; Express registration order means that would have 401'd every v1 `/api/*` route. Mounted AFTER all v1 mounts instead (commented ORDERING IS LOAD-BEARING in `index.js`).
2. **`/api/dev` outside the gate** — the spec placed it inside the gated router, which would have killed the pre-auth login picker. It stays outside (it has its own prod-403 + seeded-only guards).
3. **Tailwind v3 does NOT fail builds on unknown classes** — the spec's acceptance assumed palette replacement gives compile-time failure. Reality: unknown utilities are silently ignored (inert, paint nothing). The genuinely failing check is `scripts/check-raw-colors.js` in `npm run lint`. `app.config.ts` is the single exemption (the documented BallparkPreset brand ramp).
4. **Muted token value** — spec's `--color-text-muted: #6b7280` equals the existing `--color-text-secondary`, which would collapse two roles into one value. Set to `#9ca3af` (one step lighter) instead, flagged in-code.

### Other concerns

5. **Per-request membership query** — `requireActiveMembership` costs one DB round-trip on every protected request. Correct for now (freshness is the point); if it ever shows up in p95s, a short-TTL cache (≤30 s) is the lever — do NOT go back to trusting JWT claims.
6. **JWT shape for pV2-02b** — onboarding will need `buildSession` to return a partial session for orgless users and a fresh JWT signed after org creation. The deprecated claims should be DROPPED from newly-signed tokens in that prompt (middleware already ignores them), completing Fix 3's deprecation.
7. **No CI** — `.github/workflows` doesn't exist; the 41 new specs and the raw-color guard only run when someone types the commands. A minimal workflow (client lint+test, server test) is cheap and makes Fix 6 actually load-bearing.
8. **Bundle budget warning is pre-existing** — initial bundle is ~527 kB vs the 500 kB budget (since PrimeNG arrived); Fix 5 shaved 0.4 kB. Either raise the budget intentionally or treat as a future trim task; right now every build cries wolf.
9. **Post-commit log hook can fail silently** — its `2>/dev/null || true` swallowed a failure on the Fix 6 commit (caught during ship verification; manually logged after confirming the row was absent). Consider dropping the stderr redirect so a failed log is at least visible.
10. **version-chip hex fallback removed** — `var(--color-text-secondary, #6b7280)` was a second source of truth for the token value; the new guard caught it on its first run (it works).
