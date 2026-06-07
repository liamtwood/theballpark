# Seed `org_type_config` from localStorage (one-off) — p0021 / Piece 2

Moves the page-settings config you've already authored (it lives in **your
browser's** localStorage, not in any file) into the new `org_type_config` DB
table. Run **once per environment**, after the migration.

The seed is a browser-console snippet rather than a SQL file on purpose: the
source data is in `localStorage`, so there's nothing to hand-write into SQL.
It reads your three role profiles and PUTs them through the live, gated
`/api/config/:orgType` endpoints — i.e. it exercises the exact path the app
uses, so a successful seed also proves the write path end-to-end.

## Mapping

| localStorage profile  | → | `org_type` row |
|-----------------------|---|----------------|
| `Ballpark::agent`     | → | `agency`       |
| `Ballpark::admin`     | → | `admin`        |
| `Ballpark::supplier`  | → | `supplier`     |

> **Scope note:** this seeds the ConfigService config only (hero / sections /
> labels / theme / `pageSettings`). Catalogue-view settings still live in their
> own role-scoped localStorage store (`ballpark:catview:<surface>::<kind>`,
> Piece 1) and are **not** folded into the DB payload yet — that's **Piece 2b**
> (grid reads/writes catalogue view via ConfigService). Seeding catview now
> would write data the runtime doesn't read. Left out deliberately.

## Preconditions

1. `migration_org_type_config.sql` has been applied to this environment (table exists).
2. The server is running with the `/api/config` routes (**v1.66dg+**).
3. Your **active persona is the platform admin (Beth)** so `/org/users`
   resolves your platform-org (`orgs.type='admin'`) user id — the PUT is
   platform-admin gated and 403s otherwise.
4. You're on the host whose `localStorage` holds the authored config (the
   machine/browser where you've been editing page settings).

## Snippet

Open the app (e.g. `http://localhost:4200`), open DevTools console, paste:

```js
(async () => {
  // Match environment.apiUrl for the host you're on:
  //   dev → 'http://localhost:3001/api'   preview/prod → '/api'
  const API = 'http://localhost:3001/api';
  const ROLE_TO_ORGTYPE = { agent: 'agency', admin: 'admin', supplier: 'supplier' };

  const raw = localStorage.getItem('ballpark_config_profiles');
  if (!raw) { console.error('No ballpark_config_profiles in localStorage — nothing to seed.'); return; }
  const profiles = JSON.parse(raw);

  // Platform-admin user id for the x-bp-user-id write header (same source the app uses).
  const users = await (await fetch(`${API}/org/users`)).json();
  const userId = users?.[0]?.id;
  if (!userId) { console.error('Could not resolve current user id from /org/users.'); return; }

  const results = [];
  for (const [role, orgType] of Object.entries(ROLE_TO_ORGTYPE)) {
    const payload = profiles[`Ballpark::${role}`];
    if (!payload) { results.push({ orgType, result: 'skipped (no profile)' }); continue; }
    const res = await fetch(`${API}/config/${orgType}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-bp-user-id': userId },
      body: JSON.stringify({ payload }),
    });
    results.push({ orgType, status: res.status, result: res.ok ? 'OK' : await res.text() });
  }
  console.table(results);
  console.log('Seed complete. Reload to hydrate the live app from the DB.');
})();
```

## Verify

- The console table shows `status: 200, result: OK` for `agency`, `admin`, `supplier`.
- `GET http://localhost:3001/api/config/admin` now returns a **populated**
  `payload` (not `{}`).
- Reload the app and switch personas — each role paints its own settings,
  now sourced from the DB (localStorage is just the fast-paint cache).
- A 403 means precondition 3 failed (not running as the platform admin).
- An empty `payload {}` after seeding means the table was missing (precondition 1).

## Idempotent

Re-running overwrites the same three rows with your current localStorage state
(`updated_by` / `updated_at` refreshed by the upsert + trigger). Safe to re-run.
