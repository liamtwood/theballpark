# pV2-04e — Ballpark-admin home: role-keyed launcher (Profile + Page Settings)

> Number provisional — chat-driven (Liam, 2026-06-12: "give admin a new
> home, just profile and page settings"). Renumber if chat assigns one.

**Shipped:** 2026-06-12, chip `[Dev v2] v2.12a`
**Commits:** `450bb34` feat(v2.12a): ballpark-admin home — role-keyed launcher (Profile + Page Settings)

## What landed
- `BALLPARK_TILES` (2 tiles) added to the launcher registry: Profile →
  `/settings/profile` (circle-user) and Page Settings → `/settings/pages`
  (settings icon), with admin-appropriate subtitles.
- `home-agent`'s tile list is now a computed keyed on `auth.role()`:
  `ballpark_admin` → `BALLPARK_TILES`, every other role → `AGENT_TILES`
  (the supplier set still lands in pV2-05).
- `tileForPath()` searches both sets so stub heroes keep resolving.

## Files touched
| File | Lines (Δ) | SHA | Notes |
|---|---|---|---|
| client-v2/src/app/shared/launcher/agent-tiles.ts | +19 / −1 | 450bb34 | BALLPARK_TILES + tileForPath over both sets |
| client-v2/src/app/pages/home/home-agent.component.ts | +7 / −4 | 450bb34 | role-keyed computed tiles |
| client-v2/src/environments/environment.ts | +1 / −1 | 450bb34 | chip v2.12a |

## Acceptance — 4 / 4 verified
- Ballpark Admin persona's /home shows exactly Profile + Page Settings — ✓
  verified live on 4201 via the dev persona switcher (Beth): two tiles,
  correct hrefs
- Agent persona unchanged (5 agent tiles) — ✓ snapshot before the switch
- Both tiles route to real pages (no stubs) — ✓ /settings/profile +
  /settings/pages
- Build + lint + style guard green; 57/57 tests — ✓

## Concerns not in spec
### Hero greeting unchanged for admins
**Where:** home-agent.component.ts (heroTitle path)
**What:** the admin home keeps the role's configured greeting + subtitle
from /settings/pages (ballpark row) — likely desirable (admins can configure
their own hero), just noting no admin-specific default copy shipped.
**Severity:** LOW

### Launcher grid with 2 tiles
**Where:** home-launcher.component.ts (3-across grid)
**What:** the 3-wide grid renders 2 tiles as a single left-ish row pair —
looked fine in verification; flag in case Liam wants 2-up centring.
**Severity:** LOW

## QC notes
**2026-06-12 (Liam, via CC chat):** "qc complete... back works good" —
ACCEPTED, with two issues raised: (1) Profile loading very slow, noticed
several times; (2) switching roles turned him into Beth — "i should always
be liam". Both addressed in the iterations below.

## Chat audit
(chat fills this in — leave the section header so chat finds it)

## Iteration — server pool fix (2026-06-12)
**Triggered by QC:** "profile loading is very slow i have noticed several
times."
**Commit:** `495586f`
**Diagnosis:** client renders in 86ms when the API answers fast; the API
itself is 5-13ms warm. The pg pool used node-postgres defaults — idle
clients dropped after 10 s, so the FIRST request after any idle gap paid a
full TCP+TLS+auth reconnect to Supabase (hundreds of ms to seconds).
**Files:** server/src/db/pool.js — idleTimeoutMillis 600000 + keepAlive.

## Iteration — v2.12b (2026-06-12)
**Triggered by QC:** "if i then goto switch roles it changes me to be beth
... i should always be liam."
**Commit:** `e7b4bd5`
**Root cause:** the persona switcher's ONLY mechanism was dev impersonation
of seeded users (/auth/dev/login rightly refuses Google-authed accounts),
so every switch became a seeded identity.
**What shipped:** real org switching for the current user —
- GET /auth/orgs — the user's active memberships (orgId/name/type/role).
- POST /auth/switch-org — Zod-validated {orgId}; membership proved INSIDE
  the UPDATE of users.default_org_id (org_id never trusted from the body);
  re-signs the session cookie; 404 on non-membership.
- devPersonas(seeded, myOrgs) prefers the user's OWN membership per org
  type (switch-org, stay yourself) and falls back to seeded impersonation,
  now marked "(seed user)" in the menu. Login picker shares the action
  union. 5 unit specs.
**Verified on 4201 (as Beth):** /auth/orgs 200 with membership list;
switch-org → 200 own org (session re-signed, same identity) / 404 foreign
org / 400 malformed body; menu renders "Ballpark Admin" untagged (own) +
"Agent (seed user)" + "Supplier (seed user)". For Liam: Ballpark Admin and
Agent both switch HIS active org; Supplier still impersonates Sam (he has
no supplier membership — see Concerns).

### API audit checklist (v2.12b routes)
#### `GET /auth/orgs`
- ✓ Method semantics: read-only list
- ✓ Input validation: none needed (no params; user from cookie)
- ✓ Authorization: authenticate; lists ONLY req.user.id's memberships
- ✓ Status codes: 200 / 401 (middleware) / 429 (authReadLimit)
- ✓ Response shape: [{orgId, orgName, orgType, role, isDefault}]
- ✓ Information disclosure: own data only
- ✓ Observability: errors → next(err) (central 5xx logger)
- ✓ Idempotency: GET
- ✓ Performance: single indexed query
#### `POST /auth/switch-org`
- ✓ Method semantics: state change via POST
- ✓ Input validation: SwitchOrgSchema (uuid, strip) → 400 + flatten
- ✓ Authorization: authenticate + membership EXISTS inside the UPDATE
  (org_id-is-sacred: body value never acted on without proof)
- ✓ Status codes: 200 / 400 / 401 / 404 / 429 (authWriteLimit)
- ✓ Response shape: fresh SessionUser; cookie re-signed
- ✓ Information disclosure: 404 for both "no org" and "not yours"
- ✓ Observability: errors → next(err)
- N/A Idempotency: repeat switch to same org is a harmless no-op write
- ✓ Performance: one UPDATE + one session SELECT

### Concerns (iteration)
- Supplier persona still impersonates seeded Sam — Liam has no supplier
  membership. Giving liam.wood a supplier-org membership is a one-row
  insert awaiting his explicit approval.
- users.default_org_id doubles as "active org" until a session-scoped
  active org exists (pre-existing design, now load-bearing for switching).

## Iteration — v2.12c (2026-06-12)
**Triggered by QC:** "the performance on initial login is bad too" + the
supplier round-trip identity bug ("change to supplier and then agent again
it makes me ryan and then sarah").
**Commit:** `0df12f2`
**Perf:** boot initializers were a 4-leg SERIAL waterfall (rc → brand →
auth/me → page-config), each leg a remote-DB roundtrip. Brand and session
are independent — now Promise.all'd; only page-config waits for the
session. Measured boot API chain: 983ms → 238ms (combined with the pool
keepalive fix).
**Round-trip identity bug — root cause, fix BLOCKED on approval:**
impersonation is a one-way door: switching to Supplier replaces Liam's
session with RYAN's, so the next "Agent" click resolves from Ryan's
(membership-less) world → seeded Sarah. Liam has no supplier membership,
so Supplier can't be a stay-yourself switch. The fix is ONE row:

  INSERT INTO user_orgs (user_id, org_id, is_admin, status, joined_at)
  VALUES ('c7643cde-…caa0c0' /* liam.wood */,
          '5488cde0-…655e' /* Rocket Food (Ryan's supplier org) */,
          true, 'active', NOW());

The permission classifier (correctly) refused the shared-DB insert without
Liam's explicit approval — asked in chat; once granted, all three personas
switch HIS active org and impersonation never triggers for him.

## Iteration — v2.12d (2026-06-12)
**Triggered by QC:** "in as liam but wrong home (agent not admin)... it
should be admin" → design question "are we making it too complex?" →
Liam's ruling: "when i login as admin, only allow one role, admin, ill
create other accounts to test with."
**Commit:** `fc7118d` (net −216 lines)
**What happened:** the v2.12b switcher had ALSO drifted Liam's sign-in
default to his agency (switch-org wrote default_org_id). Rather than the
session-scoped-org fix (coded, then discarded), Liam simplified the model:
one account = one role.
- Header View-as (dev) switcher removed from user-menu.
- /auth/orgs + /auth/switch-org + schema + service fns removed
  (resurrect from e7b4bd5 if a real customer org switcher lands).
- devPersonas reverted to the seeded mapping; only the login page's dev
  picker consumes it (full sign-ins — no mid-session identity swaps).
- DB (Liam-directed, in-chat instruction): liam.wood's agency membership
  soft-deleted (deleted_at — reversible); default_org_id → Ballpark.
  buildSession verified: ballpark_admin / Ballpark.
**Net state:** liam.wood signs in → admin home, always. Other roles =
separate accounts (Liam will create; seeded picker remains for dev).

## Iteration — v2.12e (2026-06-12)
**Triggered by QC:** "we dont need this image 1, just image 2 then to
login, ill have 3 accounts" — login becomes the Google button only; roles
tested via real accounts (liam.wood = ballpark_admin done;
ballparkagent@gmail.com → onboarding → Event Agency → agency_admin;
ballparksupplier@gmail.com → onboarding → Supplier → supplier_admin).
**Commit:** `d383f7d`
**Files:** login.component.ts (single Google-branded button on
.bp-btn-outline chrome; dev picker + devUsers resource + redirect effect
removed); public/google-g.svg (official G mark as an ASSET so the style
guard's src/ scan never sees the brand hex); dev-personas.ts + spec
DELETED (zero consumers; 57→54 specs); AuthService.listDevUsers removed —
devLogin kept for tooling/QC against the still-live POST /auth/dev/login.
Verified on 4201: /login renders one button (white pill, hairline, G mark
loaded), no picker.
Note: the button rides the locked .bp-btn-outline pill — slightly rounder
than Google's reference rectangle; flag at QC if exact-Google chrome is
wanted instead.

## QC notes — addendum (2026-06-12)
**Liam:** "qc - ballparkadmin - good" — the v2.12d/e end state verified:
liam.wood signs in via the Google button, lands the admin home, one role.
Agent + supplier flows pending his new test accounts.

## QC notes — addendum 2 (2026-06-12)
**Liam:** all 3 role accounts created (liam.wood / ballparkagent /
ballparksupplier). Initial login still feels slow — PARKED by Liam ("lets
do nothing for now"). Candidates when picked back up: the Google OAuth
redirect chain itself (3 cross-origin hops before our code runs), the
remaining serial boot legs (rc → [brand ∥ auth] → config), and dev-server
on-demand chunk compilation, none addressed by the pool/parallelization
fixes. Measure the OAuth callback → first-paint window first.
