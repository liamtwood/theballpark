# pV2-EA-02 — `/ballpark-settings` home + Early Access port (3 tabs)

**Shipped:** 2026-06-22, chip `[Dev v2] v2.33b`
**Commit:** `<pending>`

The Ballpark-team admin umbrella in v2: a `/ballpark-settings/` home + the
Early Access page (Signups, Page content, Notifications-admin half), behind the
interim sessionStorage `ADMIN_API_SECRET` gate. Feature Flags, the user-welcome
email + signature, the URL move, and the Orgs/Users stubs are EA-03 / EA-04.

## What landed
- **Interim auth gate** — `/ballpark-settings/*` is **pure-bleed** (no app shell,
  no org session): the secret IS the auth. [admin-secret.service.ts](../client-v2/src/app/core/admin/admin-secret.service.ts)
  holds it in **sessionStorage** (not localStorage); [admin-secret.interceptor.ts](../client-v2/src/app/core/admin/admin-secret.interceptor.ts)
  attaches `x-bp-admin-secret` to every `/api/admin/*` call; the layout shows a
  one-time entry form, validates by hitting a gated endpoint, and never logs the
  secret (RP-A1). Retires to a `ballpark_admin` JWT guard at AUTH-01 (TECH-DEBT-01).
- **Home** ([ballpark-settings-home](../client-v2/src/app/pages/ballpark-settings/ballpark-settings-home.component.ts)) —
  5 tiles: Profile (cross-link → `/settings/profile`), Early Access (active),
  Orgs / All Users / Admin (coming-soon, dimmed + badge; built in EA-04).
- **Early Access** ([early-access](../client-v2/src/app/pages/ballpark-settings/early-access/early-access.component.ts)) —
  v1 port on v2 standards (standalone, OnPush, signals, `resource()`, `@if`/`@for`,
  zero `.subscribe`):
  - **Signups** — Total / Today / This week / **By-environment** stat tiles;
    search (debounced); **environment** filter chips (All / Dev / Preview / Master /
    Unknown) with counts; sort toggle; CSV export; table (First · Last · Email ·
    Env · Date · soft-delete) on the new schema.
  - **Page content** — per-slide cards (Hero/Suppliers/Producers/Guestlist) with
    dirty-tracked save.
  - **Notifications (admin half)** — recipients chip input, subject + body editors,
    send-test, live preview pane. *(User-welcome + signature sub-cards = EA-03.)*
- **Server** — `listSignups` gains an `envs` filter + `by_environment` stats;
  `GET /api/admin/signups?envs=` parses it.

## Files touched
| File | Notes |
|---|---|
| `server/src/services/marketing.service.js` | `envs` filter + `by_environment` stats |
| `server/src/routes/adminMarketing.js` | parse `?envs=` |
| `client-v2/src/app/core/admin/admin-secret.service.ts` | NEW — sessionStorage secret |
| `client-v2/src/app/core/admin/admin-secret.interceptor.ts` | NEW — attaches `x-bp-admin-secret` |
| `client-v2/src/app/core/admin/admin-marketing.service.ts` | NEW — typed `/api/admin/*` client |
| `client-v2/src/app/pages/ballpark-settings/ballpark-settings-layout.component.ts` | NEW — secret gate + outlet |
| `client-v2/src/app/pages/ballpark-settings/ballpark-settings-home.component.ts` | NEW — tile home |
| `client-v2/src/app/pages/ballpark-settings/early-access/early-access.component.ts` | NEW — 3-tab Early Access |
| `client-v2/src/app/app.config.ts` | register interceptor + 4 Lucide icons |
| `client-v2/src/app/app.routes.ts` | `/ballpark-settings` parent + children |
| `docs/BALLPARK_ADMIN.md` | version history |

## Acceptance — verified (dev, real UI)
- Interim auth — ✓ no/wrong secret → 403, correct → 200; entry form unlocks, secret persists in sessionStorage, interceptor attaches it
- Home — ✓ 5 tiles; Early Access active, Orgs/Users/Admin coming-soon
- Signups table reflects the new schema — ✓ (Bob · Hello · bob@hello.com · dev · 1h ago); stats total 19 / by-env D1 P0 M18 U0; env chips with counts
- Page content — ✓ 4 slides, 25 fields load
- Notifications — ✓ recipients (beth/megan), subject/body editors, live preview renders sample
- Build green — ✓ (`ng build` clean)
- Mutations (delete / save slide / save settings / send test) — code-verified against the existing endpoints; full click-through = Liam's QC

## Dev note — `ADMIN_API_SECRET`
The gate needs `ADMIN_API_SECRET` set server-side (otherwise the legacy x-bp-user-id
bypass blocks the secret flow). I added `ADMIN_API_SECRET=dev-ea2-secret-2026` to the
**local `.env`** (gitignored, not committed) for dev parity + testing — that's the
value to type in the gate locally. Preview/prod already set their own.

## API audit — `GET /api/admin/signups` (modified)
- ✓ Method GET; ✓ admin-gated (`requireAdmin` secret); ✓ `envs` split + bound `= ANY($n)` (parameterised); ✓ soft-delete filter unchanged; ✓ response additive (`by_environment`); ✓ no PII beyond what the admin already sees. Other admin endpoints unchanged.

## Concerns not in spec
### Interim auth is browser-secret (RP-A1 / TECH-DEBT-01)
**What:** The secret lives in sessionStorage + an `x-bp-admin-secret` header. It's never logged/echoed, but it is a shared secret in the browser. This is the locked interim pattern; retires at AUTH-01.
**Severity:** LOW (by design, sunset locked).

### Coming-soon tiles don't navigate
**What:** Orgs/Users/Admin tiles are dimmed + badged but inert (no target routes yet — EA-04). No stub pages this ship.
**Severity:** LOW (scoped to EA-04).

### Recipients chip input is hand-rolled
**What:** Simple add-on-Enter / remove-× chips rather than a PrimeNG component (PrimeNG Chips is deprecated). Functional; matches v1 intent.
**Severity:** LOW.

## QC notes
(Liam fills this in — enter the dev secret at `/ballpark-settings`, browse signups by environment, edit a slide, send a test admin email)

## Chat audit
(chat fills this in)
