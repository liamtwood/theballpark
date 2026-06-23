# pV2-ROLES-01 — Seed Liam as ballpark_admin + add `page_config.edit` permission

> **Ready** — Liam approved 2026-06-11. Two interdependent changes in one
> commit; lands BEFORE the page-settings-on-stubs prompt so the gating in
> that prompt is real + testable end-to-end on first ship.
>
> **Naming note:** the role stays `ballpark_admin` (rename to `ballpark_staff`
> was considered + dropped as busy work). The semantic distinction —
> `ballpark_admin` = elevated for THE Ballpark platform; `agency_admin` /
> `supplier_admin` = elevated within an org — gets a one-sentence clarification
> in `docs/ARCHITECTURE.md`'s auth section as part of this ship.

## Why

One missing permission, plus the absence of a real ballpark_admin identity
in dev:

1. **No `page_config.edit` permission yet.** The cog that edits
   `org_type_config` is a platform-level action (writes the template that
   applies to every org of a given type). Currently no permission encodes
   "may edit page-config" — overloading `admin.cross_org_view` for the
   guard would conflate two semantics. Add a dedicated permission.
2. **Liam can't actually be ballpark_admin today.** He's
   `is_admin = true` on an agency-type org → derives to `agency_admin`. To
   test the gating, he needs a real membership on a ballpark-type org. Seed
   one + add him as admin + flip his default_org_id.

## Read first

1. `docs/CLAUDE.md`
2. `docs/ARCHITECTURE.md` (auth flow + permissions matrix sections)
3. `docs/ENGINEERING.md` (Rule 4 JWT identity-only claims; Rule 9 precedence)
4. `client-v2/src/app/core/auth/permissions.ts` (the matrix)
5. `server/src/services/permissions.service.js` (mirrored matrix)
6. `server/src/db/migrate-schemas.js` (the multi-schema pattern this seed uses)
7. This prompt

## What changes

### 1. Add `page_config.edit` permission

In both the client matrix (`permissions.ts`) and server matrix
(`permissions.service.js`):

```ts
export type Permission =
  | …existing
  | 'page_config.edit';

export const MATRIX: Record<Role, Permission[]> = {
  ballpark_admin:  ['admin.cross_org_view', 'page_config.edit'],
  agency_admin:    [/* …unchanged */],
  agency_member:   [/* …unchanged */],
  supplier_admin:  [/* …unchanged */],
  supplier_member: [/* …unchanged */],
};
```

Only `ballpark_admin` gets it. No customer org admin should be able to write
`org_type_config` — that's a platform-level setting.

### 2. Seed "Ballpark Internal" org + flip Liam to `ballpark_admin`

New one-shot migration `server/src/db/migrations/2026-06-11-seed-ballpark-org.js`
(or wherever the existing one-shot migrations live), applied to all three
schemas via the migrate-schemas pattern.

For each schema (`public`, `preview`, `master`):

1. **Upsert** the "Ballpark Internal" org if it doesn't exist:
   ```sql
   INSERT INTO {schema}.orgs (name, type)
   VALUES ('Ballpark Internal', 'ballpark')
   ON CONFLICT (name) WHERE deleted_at IS NULL DO NOTHING
   RETURNING id;
   ```
   Capture the org id (or SELECT it if already existed).
2. **Find** the `liam.wood@gmail.com` user row in that schema (skip cleanly
   if absent — preview/master may not have a real user yet).
3. **Upsert** his membership on the new org as `is_admin = true,
   status = 'active'`:
   ```sql
   INSERT INTO {schema}.user_orgs (user_id, org_id, is_admin, status)
   VALUES ($1, $2, true, 'active')
   ON CONFLICT (user_id, org_id) DO UPDATE
   SET is_admin = true, status = 'active', updated_at = now();
   ```
4. **Flip** his `users.default_org_id` to the new ballpark org id:
   ```sql
   UPDATE {schema}.users SET default_org_id = $1, updated_at = now()
   WHERE id = $2;
   ```
5. **Leave his existing agency membership intact** — preserves the
   agency-side test surface for when we need to verify the agency_admin
   role flow.

Wrap the whole per-schema sequence in `withTransaction` so audit attribution
is correct.

## Acceptance

1. Build clean on both client + server.
2. `permissions.spec.ts` + `permissions.parity.spec.ts` green; matrix has
   `ballpark_admin` with `['admin.cross_org_view', 'page_config.edit']`.
3. Migration runs idempotently against all three schemas (re-run = no-op).
4. After migration: `liam.wood@gmail.com` signs out, signs back in via
   Google → session derives role = `ballpark_admin`; `can(role,
   'page_config.edit')` = true; `can(role, 'project.create')` = false (he no
   longer has agency_admin perms by default since the ballpark membership is
   primary).
5. His original agency org + membership still exist in the DB (verify via
   query); future org-switcher work can let him hop back. No data deleted.
6. Devtools / network: JWT carries identity only (per AUDIT-01 Rule 4) —
   role is NOT in the JWT, it's derived per request on the server via
   `requireActiveMembership`.
7. `docs/ARCHITECTURE.md` auth section gets a one-sentence clarification
   noting `ballpark_admin` = elevated for the Ballpark platform, distinct
   from `agency_admin` / `supplier_admin` = elevated within an org.
8. v1 on 4200 unchanged.

## Out of scope

- The cog visibility check + server PUT guard wiring for page settings
  (lands in the next prompt — page-settings-on-stubs)
- Org switcher UI (multi-org membership is enabled by this seed, but the
  switcher is a future UX feature)
- Seeding ballparksupplier@gmail.com or the future agency gmail — they come
  through Google OAuth + onboarding naturally
- Any UI changes (this is plumbing only)

## Concerns not in spec

Per `docs/ENGINEERING.md` — mandatory in your ship report. Items I'd want to
know:

- Whether `deriveRole` (or equivalent) already handles the `'ballpark'`
  org type case correctly, or needs an explicit branch — and whether any
  org-type Zod validators need `'ballpark'` added to their enum
- Whether the seed migration's idempotency holds when run on a schema where
  the "Ballpark Internal" name already exists but with a different type
  (defensive — probably not, but flag)
- Whether the onboarding flow needs any safeguard to prevent a regular
  Google sign-in from accidentally landing on the ballpark org (probably
  not — onboarding only offers Agency or Supplier radio tiles per pV2-02b)

## Bump + ship

1. Chip `[Dev v2] v2.11a`
2. Single commit (permission + seed are interdependent — one atomic change)
3. Ship report `prompts/pV2-ROLES-01-seed-and-permission-shipped.md`
   with "Concerns not in spec"
4. Flip backlog to `Shipped`; await audit-before-shipped pass for Done

## Reply with

- Commit SHA
- 8/8 acceptance verified
- Confirmation that Liam's role derives to `ballpark_admin` on next sign-in
- Concerns not in spec
- Confirmation v1 on 4200 unchanged
