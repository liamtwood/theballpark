# Auth & Users — Plan

Parallel-safe planning doc for the auth + multi-org build. Runs alongside the
inbox-v2 arc (orientation: `prompts/inbox-v2-plan.md`). Read this once before
picking up any p0xxx-auth prompt.

## Decisions (locked)

| | Decision |
|---|---|
| Provider | **Supabase Auth** — native, Google + Magic Link out of the box |
| Login methods (v1) | Google OAuth + Magic Link (email). No password. |
| Multi-org | **Schema supports many-to-many; UX exposes single-org in v1** |
| Roles | **Per membership** — role lives on `user_orgs`, not on `users` |
| Dev data | **Reset on launch** — drop, re-seed, no migration of old UUIDs |

## Data model

Three tables touch auth. The existing `users` table gets re-shaped; `user_orgs`
is new.

```sql
-- Owned by Supabase. Read-only from app code.
auth.users (id, email, raw_user_meta_data, ...)   -- managed by Supabase Auth

-- App-side profile. One row per auth.users.id.
public.users (
  id UUID PRIMARY KEY,                  -- equals auth.users.id
  email TEXT NOT NULL UNIQUE,           -- denormalised from auth.users for joins
  display_name TEXT,
  avatar_url TEXT,
  default_org_id UUID,                  -- which org to land in on login
  created_at, updated_at, deleted_at,
  created_by, updated_by, deleted_by    -- universal audit cols
);

-- Membership: a user belongs to N orgs. Admin flag per membership; effective
-- role is derived from (org.type, is_admin) — no enum column.
public.user_orgs (
  user_id   UUID NOT NULL REFERENCES public.users(id),
  org_id    UUID NOT NULL REFERENCES public.orgs(id),
  is_admin  BOOLEAN NOT NULL DEFAULT false,
  job_title TEXT,                              -- e.g. "Account Manager" — display only
  status    TEXT NOT NULL DEFAULT 'active',    -- active / invited / suspended
  invited_by_user_id UUID,
  invited_at TIMESTAMPTZ,
  joined_at  TIMESTAMPTZ,
  created_at, updated_at, deleted_at,
  created_by, updated_by, deleted_by,
  PRIMARY KEY (user_id, org_id)
);
```

## Role model — derived from two flags

We don't store an enum role. The user's effective role in their active org is
derived at session time from:

- `orgs.org_type` — `agency` | `supplier` | `ballpark`
- `user_orgs.is_admin` — boolean

| org_type   | is_admin | Effective role     |
|------------|----------|--------------------|
| `agency`   | true     | `agency_admin`     |
| `agency`   | false    | `agency_member`    |
| `supplier` | true     | `supplier_admin`   |
| `supplier` | false    | `supplier_member`  |
| `ballpark` | (always) | `ballpark_admin`   |

| Role | Can do |
|---|---|
| `ballpark_admin` | See all orgs (Ballpark-internal). Cross-org tooling. |
| `agency_admin`   | Full read/write for that agency. Invite. Billing. |
| `agency_member`  | Day-to-day work for that agency. No billing, no invite. |
| `supplier_admin` | Full read/write for that supplier. Invite. Payouts. |
| `supplier_member`| Day-to-day work for that supplier. No payouts, no invite. |

The flag is per (user, org), so a single user account can be `is_admin=true` at
Creative Agency Ltd AND `is_admin=false` at Bloom Co — same login.

## v1 UX simplification

In v1, the UX picks ONE org for the session (the user's `default_org_id`). No
org switcher in the nav. New routes / queries scope by that org.

When multi-org UX lands (future):
- Add org switcher in top nav avatar dropdown
- `currentOrgId` becomes a session signal (defaults to `default_org_id`)
- All queries respect `currentOrgId` from session, not always `default_org_id`

No schema change needed to enable later.

## Permissions matrix

Codified in one file `client-angular/src/app/v2/auth/permissions.ts` and mirrored
on the server in `server/src/services/permissions.service.js`. RBAC.

```typescript
type Role = 'ballpark_admin' | 'agency_admin' | 'agency_member'
          | 'supplier_admin' | 'supplier_member';

type Permission =
  | 'org.invite_member'
  | 'org.manage_billing'
  | 'project.create' | 'project.delete'
  | 'item.create'    | 'item.delete'
  | 'inbox.reply'    | 'inbox.adjust_cost'
  | 'cart.checkout'
  | 'admin.cross_org_view';

const MATRIX: Record<Role, Permission[]> = { ... };
function can(role: Role, perm: Permission): boolean { ... }
```

Matrix sketch (P0):

```
                     agency_admin  agency_member  supplier_admin  supplier_member  ballpark_admin
org.invite_member         ✓             —              ✓                —                ✓
org.manage_billing        ✓             —              ✓                —                —
project.create            ✓             ✓              —                —                —
project.delete            ✓             —              —                —                —
item.create               ✓             ✓              ✓                ✓                —
item.delete               ✓             —              ✓                —                —
inbox.reply               ✓             ✓              ✓                ✓                —
inbox.adjust_cost         ✓             ✓              ✓                ✓                —
cart.checkout             ✓             ✓              —                —                —
admin.cross_org_view      —             —              —                —                ✓
```

## Login UX flow

```
/login (public)
  ↓
[Continue with Google]   ↳ Supabase OAuth → callback /auth/callback
[Or use Magic Link]      ↳ form: email → Supabase sends email → click link → /auth/callback
                                                                              ↓
                                                                       has app user row?
                                                                       /         \
                                                                      yes         no
                                                                       ↓           ↓
                                                            default_org_id?  /onboarding
                                                                /     \
                                                              yes      no
                                                               ↓        ↓
                                                          /home    /select-org
                                                                   (pick one of the orgs you belong to)
```

### Onboarding (first-time signup)

User signs in with Google → no `public.users` row exists → server creates it →
shows `/onboarding`:

1. "What's your role?" — agency / supplier
2. "What's your company name?" — creates `orgs` row + `user_orgs` membership with
   `agency_admin` or `supplier_admin` role
3. Land on `/home`

In v1, all self-signups become admins of a new org. Joining an existing org
happens only via invite (next).

### Invite flow

Existing admin → Settings → Team → "Invite member":

1. Form: email + role
2. Server creates `user_orgs` row with `status='invited'` (no user_id yet) + sends
   email via Supabase Magic Link with org_id encoded
3. Invitee clicks → signs in with Google or Magic Link → server matches the
   `user_orgs` row by email + flips to `status='active'` + sets `user_id`
4. Land on `/home` for that org

## Build order

| Prompt | Scope | Notes |
|---|---|---|
| `pAUTH-01` | Schema + Supabase Auth config | Reset dev DB, create `users` + `user_orgs` tables, configure Supabase Auth (Google client id, allowed redirect URLs). |
| `pAUTH-02` | Server-side auth middleware | Verify JWT from Supabase. Populate `req.user.id` + `req.user.org_id`. Replace any existing user-context plumbing. |
| `pAUTH-03` | Permissions matrix + `can()` helper | Shared client + server file. |
| `pAUTH-04` | Login + callback pages | `/login`, `/auth/callback`. Supabase JS SDK in Angular. |
| `pAUTH-05` | Onboarding flow | `/onboarding` page. First-time-user role + org creation. |
| `pAUTH-06` | Invite flow | Settings → Team → Invite. Server endpoint + email template + acceptance handler. |
| `pAUTH-07` | Retire dev persona switcher | The current dev-only PersonaService and switcher come out. Replaced by real auth. |

7 prompts, each small. Doable in ~1-2 weeks of work for CC alongside the
inbox-v2 arc.

## What this means for the inbox-v2 arc

Three touchpoints to flag (don't block — just heads up):

1. **`viewerRole` input on inbox-v2** — currently a string `'agency' | 'supplier'`. After auth lands, it'll derive from `currentMembership.role` (which is `agency_admin` etc) — but the surface input stays the same shape.

2. **`org_id` in inbox queries** — already coming from JWT per WORKING_STANDARDS. No change.

3. **Persona switcher (dev tool)** — exists in the avatar dropdown today. After `pAUTH-07` it's gone, replaced by real signed-in identity.

The inbox-v2 arc can ship before auth lands (it works with the current dev-user
plumbing). When auth lands, no inbox-v2 code changes.

## Out of scope (in this whole arc)

- SSO / SAML / Microsoft / Apple login
- SCIM provisioning
- MFA (Supabase can layer this on later — config only, no code)
- Audit-log UI for "who did what when"
- Org-level billing
- Email/password as a login method
- Migration of existing dev UUIDs (we reset)
