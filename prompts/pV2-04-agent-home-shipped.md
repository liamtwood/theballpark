# pV2-04 — Agent home + page-settings drawer · SHIPPED

**Status:** Shipped (awaiting chat audit pass before Done) — **one action needed from Liam first, see ⚠ below**
**Version chip:** `[Dev v2] v2.09a`
**Branch:** dev — five code commits + this ship commit.

## ⚠ Pending your single action: run the migration

`org_type_config` **does not exist in the database** — the p0021 migration file was written but never applied, and the server's ConfigService has been silently degrading to `{}` via its 42P01 catch ever since (v1 page settings were riding localStorage the whole time). The table now lives in `migrate-schemas.js` (single source of truth, all three schemas, seeded). The permission classifier rightly blocked me from running DDL against the shared DB, so:

```
cd server && npm run db:migrate:schemas
```

Until that runs: drawer saves 500 → the optimistic update **rolls back visibly** (verified working). After it runs, acceptance 16/17/18 (persist / reload-restore / cross-admin) go green with zero code change. I also couldn't seed demo rows into Creative Agency Ltd (classifier), so section cards currently show their **empty** states — either green-light a small seed (2 projects + 2 favourites + a balance for Sarah's org) or QC the data states through real usage.

## Commits

| # | SHA | What |
|---|-----|------|
| 1 | `54bde79` | org_type_config in migrate-schemas + dual-auth config routes (v1 path untouched; v2 cookie path: GET membership-gated returning the `payload.v2Home` slice, PUT admin-gated + own-orgType + Zod) + single-statement `jsonb_set` merge so v1/v2 never clobber each other's payload keys |
| 2 | `825b1e8` | `/api/dashboard/*` — stats, upcoming, activity, credits, saved-suppliers on the gated v2 router, Zod-bounded query params |
| 3 | `44b1434` | `PageConfigService` (signal store, optimistic update + reload-on-failure) + typed payload + `DashboardService` (httpResource factories) + `timeAgo` + initializer-chain wiring |
| 4 | `eeae55e` | Page-settings drawer (p-drawer + p-tabs two-tab per p0032, save-on-change) + toggle/select/text row controls + launcher tile/grid (gradient primary) + section-card primitive + Coming-soon stubs + card/elevation tokens |
| 5 | `227aa34` | `<app-home-agent>` at /home (hello retired/deleted) — configured hero + admin cog, stats strip, fixed 3-track grid, six sections with loading/error/empty/data states, stub routes, hero-title pure fn |

## Acceptance — 25 ✓ · 2 ◐ · 3 pending migration

✓ 1–5 (layout: home renders, greeting hero "Welcome back, Sarah" + org subtitle, cog toggles drawer, 3-col desktop / 1-col mobile by computed style, Lucide eyebrows) · ✓ 6 & 8 (httpResource per card with visible error templates; toggles mount/unmount instantly — optimistic update AND its rollback observed live) · ✓ 9–11 (5 tiles, gradient primary by computed background-image, stubs render Coming-soon heroes) · ✓ 12–15 (drawer 480px right, Dashboard/General tabs, all fields present incl. conditional fixed-title input) · ✓ 19 (Alex: no cog; direct PUT → 403) · ✓ 20 (walks below) · ✓ 21–27 (hygiene greps zero, raw-color guard, host bindings, no new subscribes, justified catches, parity spec green, 22 new pure-fn specs; client suite 61, server 25) · ✓ 28 (v1 4200 page + APIs 200) · ✓ 29 (dev-user switch: Sarah → Alex updated greeting + cog visibility)

◐ 7 — loading + empty states verified live; **data** states blocked on the seed (above).
◐ 30 — suspension → 403 flows through `requireActiveMembership` (drill-verified in AUDIT-02); not re-run live this prompt.
✗ 16/17/18 — persistence, blocked solely on the migration run.

## API audit checklist walks

#### `GET /api/config/:orgType` (modified — v2 path added)
- ✓ Method: GET, idempotent read
- ✓ Mount: documented dual-auth exception — same URL serves v1 (open legacy) and v2 (cookie → authenticate + requireActiveMembership); the shim dies with v1 (pV2-11)
- ✓ Input: `:orgType` validated against the VALID_ORG_TYPES allow-list (400)
- ✓ Status codes: 200 / 400 invalid type / 401 no cookie (v2 path)
- ✓ Response: v2 gets the flat PageConfigPayload slice; no PII; degrades to `{}` pre-migration
- ✓ Info disclosure: nothing schema-shaped in errors
- N/A idempotency/perf concerns: single-row PK read

#### `PUT /api/config/:orgType` (modified — v2 path added)
- ✓ Method: PUT — same body twice → same end state (jsonb_set is idempotent)
- ✓ Authz: v2 → `requireActiveMembership('org.invite_member')` + **own-orgType check** (agency admin cannot author supplier config — 403); v1 keeps requirePlatformAdmin
- ✓ Input: PageConfigSchema (Zod, strip-unknown, enums + length bounds); 400 `{ error, details }`
- ✓ Status codes: 200 / 400 / 401 / 403 (member, cross-type) / 429 (none — see concern 6) / 500 pre-migration
- ✓ Response: the persisted v2Home slice; one error shape
- ✓ Write safety: single-statement `jsonb_set` upsert — atomic, no read-modify-write race with concurrent v1 writes

#### `GET /api/dashboard/stats|upcoming|activity|credits|saved-suppliers` (new ×5)
- ✓ Methods: GET, idempotent reads, nouns
- ✓ Mount: gated v2 router — authenticate + requireActiveMembership inherited
- ✓ Input: limit params Zod-coerced + bounded (3/10, 10/50, 4/20); 400 with field details (verified limit=999)
- ✓ Authz: org scoping ALWAYS `req.user.org_id`; cross-org reads impossible by construction (no foreign ids accepted)
- ✓ Status codes: 200 / 400 / 401 / 403 (suspended via middleware) / 404 (credits: org gone)
- ✓ Response: typed shapes mirrored in dashboard.service.ts; ISO-8601 timestamps; no PII beyond org-own data
- ✓ Performance: single queries, no N+1, LIMIT everywhere, explicit columns
- ◐ Observability: 5xx flows through the centralised handler (prod-generic); structured security-event logging remains the AUDIT-03 concern #2 follow-up

## Concerns not in spec

### Spec-hygiene precedence deviations (Rule 9)

1. **DESIGN.md's per-component `LucideAngularModule.pick()` is the v1 pattern** — `.pick()` returns `ModuleWithProviders`, which Angular rejects in standalone `imports`. v2's actual pattern (established pV2-01) is one global pick in app.config's `importProvidersFrom`. New icons added there; DESIGN.md §12 needs a v2 note.
2. **Spec's stats/paths assumptions** — `/api/credits/balance` and `/api/suppliers/saved` were "likely existing; verify": they don't exist. All five reads live under `/api/dashboard/*` instead of two new namespaces for one consumer.
3. **`timeRelative` from the server** — the spec sketch wanted relative time strings server-side; the API checklist mandates ISO-8601. Server ships ISO, client renders relative (`timeAgo()`, tested).
4. **`<app-settings-text-row>`** — not in the spec's control list, but the drawer has five text fields; same extraction logic as the spec'd toggle/select rows. Commits on blur/Enter so keystrokes aren't PUTs.

### Findings

5. **The headline find: org_type_config never existed** (see ⚠). v1's "DB-persisted" page settings have been localStorage-only in practice since p0021. Worth a v1-side sanity check someday — out of scope here.
6. **`projects.event_date` is free text** ("25–30 May 2026", "2027", "2nd Jun or 9th Jun") — upcoming can't date-sort; ordered by created_at with the raw string as the label. Schema debt: a typed `event_date_at` column + backfill is its own prompt.
7. **v1's Recent Activity was hard-coded HTML** — v2's is real (projects created / suppliers saved / replies received, UNION'd off audit columns). The "Quotes in progress: 0" stat was also hard-coded; v2's openBriefs/awaiting derive from messages (direction + msg_status + read — `next_action_by` is all-NULL in practice).
8. **No rate limit on the config PUT** — it's not an auth artifact (Rule 3 doesn't bind it) and it's admin-gated, but a misbehaving drawer could hammer it. If we ever add a general write limiter, this is the first customer.
9. **Sweep completeness** — surfaces changed: routes (home swap + 4 stubs), app.config (initializer + icon pick), hello deleted. Verified unchanged: login/onboarding/team/auth-callback flows (re-exercised live), v1 4200. Explicitly skipped: hero-demo sandbox (untouched), user-menu (no config dependency).
10. **PrimeNG drawer/tabs/select/toggleswitch** were first-time v2 usages — all rendered with Aura + BallparkPreset without extra CSS; the bp-drawer styleClass currently has no v2-specific overrides (v1's parchment drawer chrome was not ported — v2 drawer is Aura-default; QC may want a styling pass later).
