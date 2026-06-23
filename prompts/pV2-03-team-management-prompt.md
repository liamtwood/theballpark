# pV2-03 — Team Management (Settings → Team)

## Read first

1. `WORKING_STANDARDS.md`
2. `prompts/cc-onboarding.md`
3. `prompts/auth-and-users-plan.md` (current role model: `org.type` + `user_orgs.is_admin`)
4. `prompts/pV2-02-google-oauth-and-users-shipped.md` (confirm auth shipped and `users` + `user_orgs` tables are live)
5. This prompt

## Goal

A working team management page at `/settings/team` where org admins can list,
invite, change role, suspend, reinstate, and remove members of their own org.

Surface is gated by `can(orgType, isAdmin, 'org.invite_member')` — practically
that means admins of agency or supplier orgs.

## UX shape

```
Settings → Team

┌──────────────────────────────────────────────────────────────────────┐
│  Team members                              [ + Invite Team Member ]  │
├──────────────────────────────────────────────────────────────────────┤
│  [SJ]  Sarah Johnson         Account Manager                          │
│        sarah@studiobuild.co                                           │
│                                  [ Admin ⬤ ]  [ Suspend ◯ ]  [ 🗑 ]   │
├──────────────────────────────────────────────────────────────────────┤
│  [MD]  Mike Davies           Project Lead                             │
│        mike@studiobuild.co                                            │
│                                  [ Admin ◯ ]  [ Suspend ◯ ]  [ 🗑 ]   │
├──────────────────────────────────────────────────────────────────────┤
│  [—]   liam@nike.com         (pending invite)                         │
│        liam@nike.com                                                  │
│                                  [ Admin ◯ ]  [ Suspend ◯ ]  [ 🗑 ]   │
└──────────────────────────────────────────────────────────────────────┘
```

### Row layout

- **Avatar** (left, 36px circle): user's Google avatar if available, otherwise initials on `--theme-soft` background
- **Name** (top line, bold): `users.display_name`, or email if no display name yet (invited but not signed in)
- **Job title** (under name, muted small text): `user_orgs.job_title`. If null, show "—".
- **Email** (third line, muted): `users.email`
- **Right side**:
  - Admin toggle (`<p-toggleswitch>`)
  - Suspend toggle (`<p-toggleswitch>`) — when on, status = `suspended`; when off, status = `active`
  - Trash icon button (Lucide `trash-2`)

Pending invitees (no `users.id` yet) show with placeholder avatar (—), no name
(or "(pending invite)" subtitle), still get all three controls.

### Invite modal

Triggered by `[ + Invite Team Member ]`:

```
┌─────────────────────────────────────┐
│  Invite a team member           ✕   │
├─────────────────────────────────────┤
│  Email *           [____________]   │
│  Name              [____________]   │
│  Job title         [____________]   │
│  [✓] Make admin                     │
│                                     │
│              [ Cancel ]  [ Invite ] │
└─────────────────────────────────────┘
```

- Email required, rest optional (name + title get filled when they sign in)
- Submit → POST `/api/team/invite`
- Server creates a placeholder `users` row (no `google_sub` yet — gets set on
  first sign-in via email match) + `user_orgs` row with `status='invited'`
- Modal closes, row appears in the list immediately (optimistic update)

### Delete confirmation

Trash click → confirm dialog:

```
┌──────────────────────────────────────┐
│  Remove Sarah Johnson?               │
│                                      │
│  They'll lose access to this org.    │
│  Reversible — you can re-invite      │
│  them by email.                      │
│                                      │
│              [ Cancel ]  [ Remove ]  │
└──────────────────────────────────────┘
```

Confirm → DELETE `/api/team/:userId` → row vanishes (with a 5-second undo
toast).

## Server-side

### Endpoints

```
GET    /api/team                     — list members of current org
POST   /api/team/invite              — create invited member (email, name?, jobTitle?, isAdmin)
PATCH  /api/team/:userId             — update member (isAdmin? / jobTitle?)
PATCH  /api/team/:userId/status      — flip status (active <-> suspended)
DELETE /api/team/:userId             — soft-delete the user_orgs row
```

All gated by JWT middleware + the `can(orgType, isAdmin, 'org.invite_member')`
permission check. Always scope writes to `req.user.activeOrgId` (never trust
`org_id` from body).

### GET /api/team response shape

```typescript
interface TeamMember {
  userId: string | null;        // null when invited but never signed in
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  isAdmin: boolean;
  status: 'active' | 'invited' | 'suspended';
  invitedAt: string | null;
  joinedAt: string | null;
}
```

### Guards (server)

1. **Self-modification guard** — you cannot suspend, demote, or delete yourself.
   Returns 400 with `"You can't change your own membership."`
2. **Last-admin guard** — if removing or demoting would leave the org with zero
   active admins, refuse. Returns 400 with `"Org needs at least one active admin."`
3. **Cross-org guard** — any `:userId` not in the requester's `activeOrgId`
   returns 404 (no cross-org leak).

### Invite logic

On POST `/api/team/invite`:
1. Validate email format.
2. Look up `users` by email.
3. If exists → check for existing `user_orgs` row for this org.
   - If exists AND `deleted_at IS NULL` → 409 "Already a member"
   - If exists AND soft-deleted → undelete + flip status to 'invited' (re-invite flow)
   - If not exists → create `user_orgs` row with `status='invited'`
4. If `users` row doesn't exist → create a stub (email only, `google_sub` NULL)
   then create `user_orgs` row.
5. Stamp `invited_by_user_id = req.user.id`, `invited_at = NOW()`.
6. (Optional v1) Send email via Resend — see "Email" below.
7. Return the new TeamMember row.

### Email — defer for now

Don't wire Resend in this prompt. The invitee won't get an automated email;
the admin tells them manually for now. That's the "simple" version per Liam's
spec. Add later when the invite flow needs polish.

(`Email` row in the TeamMember table for "Invited" status acts as the
to-do-tell-them indicator visually.)

### Sign-in linking

When a user signs in with Google for the first time:
- pV2-02's upsert logic checks `users.email` lookup.
- If a stub `users` row exists for that email (no `google_sub`), this is the
  linking case: set `google_sub` from Google, update `display_name` + `avatar_url`.
- For each `user_orgs` row with `status='invited'`, flip to `status='active'`,
  set `joined_at = NOW()`.

CC may need to extend pV2-02's upsert function slightly to support this — note
it in the ship report if so.

## Client-side

### Route

`/settings/team` — new route. Lazy-loaded standalone component.

Apply `authGuard` AND a new `adminGuard` that checks
`can(authService.activeOrgType(), authService.isAdmin(), 'org.invite_member')`.

### Component — `TeamComponent`

`client-v2/src/app/pages/settings/team/team.component.ts`:

- Standalone, OnPush
- Signal-based state: `members = signal<TeamMember[]>([])`, `loading = signal(true)`, `inviteModalOpen = signal(false)`
- Loads via `TeamService.list()` on init
- Uses `@for (m of members(); track m.userId ?? m.email)` for the row list
- Each row is a small `<app-team-member-row>` child component (for cleanliness)

### Child — `TeamMemberRowComponent`

`client-v2/src/app/pages/settings/team/team-member-row.component.ts`:

- Inputs: `member: TeamMember`, `currentUserId: string`
- Outputs: `roleChanged`, `statusChanged`, `removed`
- Self-modification guard: if `member.userId === currentUserId`, disable all
  three controls + tooltip "You can't change your own membership."

### Invite modal — `InviteTeamMemberModalComponent`

- Standalone, lives in `team.component.ts`'s host
- Reactive form: `email` (required, email), `displayName` (optional), `jobTitle` (optional), `isAdmin` (boolean default false)
- On submit → `TeamService.invite(...)` → close modal, refresh list (or push optimistically)

### Service — `TeamService`

`client-v2/src/app/core/team/team.service.ts`:

```typescript
@Injectable({ providedIn: 'root' })
export class TeamService {
  private api = inject(ApiService);
  list()                                     { return this.api.get<TeamMember[]>('/team'); }
  invite(body: InvitePayload)                { return this.api.post<TeamMember>('/team/invite', body); }
  setAdmin(userId: string, isAdmin: boolean) { return this.api.patch<TeamMember>(`/team/${userId}`, { isAdmin }); }
  setJobTitle(userId: string, t: string)     { return this.api.patch<TeamMember>(`/team/${userId}`, { jobTitle: t }); }
  setStatus(userId: string, suspend: boolean){ return this.api.patch<TeamMember>(`/team/${userId}/status`, { suspend }); }
  remove(userId: string)                     { return this.api.delete<void>(`/team/${userId}`); }
}
```

### Toggles

PrimeNG `<p-toggleswitch>` for Admin + Suspend. On `(onChange)` → call
`TeamService` → optimistic UI update (revert on error with a toast).

### Trash + confirm

PrimeNG `<p-confirmdialog>` for the remove confirmation, or hand-rolled small
modal. CC's call — match the visual style of the invite modal.

Optional 5-second undo toast after delete (PrimeNG `<p-toast>` with action):
"Sarah Johnson removed. [Undo]". If undone within 5s → restore the row +
reverse the soft-delete.

## Acceptance criteria

1. Visit `/settings/team` while logged in as admin → list renders with the org's members.
2. Visit `/settings/team` while logged in as non-admin (`is_admin = false`) → redirected away (or shown "Permission denied" page).
3. Invite modal opens, form validates email, submit creates `user_orgs` row with `status='invited'`. New row appears in list with "(pending invite)" subtitle and empty avatar.
4. Toggle Admin on for a member → server flips `is_admin`; toggle reflects new state. Refresh → state persists.
5. Toggle Suspend on for a member → status changes to `'suspended'`; toggle reflects. That user's next API call gets 403.
6. Toggle Suspend off → status `'active'`. User can act again.
7. Trash a member → confirm dialog appears. Confirm → row vanishes; `user_orgs.deleted_at` is set.
8. Self-modification blocked: your own row's three controls are disabled with a tooltip.
9. Last-admin guard: try to demote / remove the only admin → 400 from server, toast surfaces the reason.
10. Sign in for the first time as an invited user → existing `user_orgs` row flips from `'invited'` to `'active'`, the `users` row gets `google_sub` + `display_name` set.
11. No console errors. `ng build` clean. Lint clean. No `any` types in new code.
12. Old `client-angular/` on 4200 unchanged.

## Out of scope

- Cross-org admin view (Ballpark admin seeing all teams) — separate prompt
- Email invite sending via Resend — deferred
- Audit log UI (who suspended whom when) — separate prompt
- Bulk operations (CSV import, bulk suspend)
- Per-member permission overrides (we only have admin/member, not fine-grained perms)
- Editing the user's own profile (different surface — Settings → Profile)

## Bump + ship

1. Version chip `[Dev v2] v2.02a`
2. Commit messages per cc-onboarding
3. Ship report `prompts/pV2-03-team-management-shipped.md`
4. Flip backlog row to Done

## Reply with

- 12/12 acceptance criteria ticked
- Confirmation: old app still works
- Any decision points (which confirm dialog style, etc.)
- Brief on whether pV2-02's upsert needed extending for invitee linking
