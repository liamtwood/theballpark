# Shipped — pV2-03 — Team Management (Settings → Team)

**Version:** v2.05a (chip `[Dev v2] v2.05a` — sequence-corrected; the prompt's "v2.02a" predated pV2-02 shipping as v2.04a)
**Shipped:** 2 commits (server · client) — see commit log
**Prompt:** `pV2-03-team-management-prompt.md`

## What changed

### Server
- **`routes/team.js`** (mounted `/api/team`): `GET /` list · `POST /invite` · `PATCH /:userId` (isAdmin/jobTitle) · `PATCH /:userId/status` (suspend/unsuspend) · `DELETE /:userId` (soft-delete membership). Router-level gate = JWT middleware + a **LIVE membership read every request** (fresh `user_orgs` lookup), so a suspension takes effect on the member's very next call. Admin-gated via `can(orgType, isAdmin, 'org.invite_member')`. Writes scope to `req.user.org_id` from the verified JWT only.
- **Guards:** self-modification (400 "You can't change your own membership."), cross-org (404), last-admin (400). **Note on last-admin:** with this endpoint set the invariant is also structural — the requester must themselves be an active admin and can never modify their own row, so no single action can take the org to zero admins; the coded guard is defense-in-depth (reachable by future bulk/cross-actor paths). Criterion 9's 400 is observable today via the self-guard (sole admin demoting themself).
- **Invite logic:** email validate → user-by-email or stub `users` row (`google_sub` NULL; `name` populated — v1 NOT NULL) → existing-active membership 409 · soft-deleted membership **re-invite path** (undelete + status 'invited' + fresh inviter/при stamp) · else new membership `status='invited'`.
- **pV2-02 upsert extended** (the prompt anticipated this): on the email-link branch, all `status='invited'` memberships flip to `'active'` + `joined_at = NOW()`, and `default_org_id` backfills to the first active membership — so an invitee's first Google sign-in lands them in the org that invited them.
- No email sending (deferred per prompt — the "pending invite" badge is the tell-them-manually indicator).

### Client (`client-v2/`)
- `ApiService.patch()` added (didn't exist).
- **`core/team/team.service.ts`** — `TeamMember`/`InvitePayload` types + list/invite/setAdmin/setStatus/remove (paths under `/api/team`).
- **`core/auth/admin.guard.ts`** — functional guard on `can(role, 'org.invite_member')`; non-admins → `/`.
- **`/settings/team`** route (shell child → authGuard + adminGuard).
- **`TeamComponent`** — page hero ("Team" / org name) with the **`[hero-actions]` slot hosting the Invite button** (first real use of pV2-01c's slot); member list via `resource()`; invite `p-dialog` with **typed `FormGroup<InviteForm>`** (nonNullable; email required+validated); remove confirmation as a second `p-dialog` (matches the invite modal's chrome — the prompt left p-confirmdialog vs hand-rolled to CC); `p-toast` error surfacing (server guard messages flow into toasts); toggle ops reload from server truth on error (revert behaviour).
- **`TeamMemberRowComponent`** — `input.required()`/`output()`, avatar + name/title/email + status badges ("pending invite" amber / "suspended" red) + two `<p-toggleswitch>` + trash (`trash-2` registered). Self row: all three controls disabled + tooltip.
- Optional 5-second undo toast: **not implemented** (explicitly optional in the prompt; remove is reversible via the re-invite path, which IS implemented and tested).

## Verify — 12/12
1. ✓ Admin (Sarah) sees `/settings/team`: hero Team/Creative Agency Ltd, Invite button, 2 rows.
2. ✓ Non-admin (Alex, agency_member) → adminGuard bounces to `/`.
3. ✓ Invite modal: validated email; invited liam@nike.example → row appears with "pending invite" badge, `status='invited'` in DB.
4. ✓ Admin toggle on Alex → persisted (reload-confirmed), toggle reflects.
5. ✓ Suspend Alex → badge shows; **his next API calls: `/api/team` → 403 "Membership suspended or revoked", `/auth/me` → 401** (live membership check).
6. ✓ Unsuspend → Alex's `/auth/me` 200 again.
7. ✓ Trash → confirm dialog → row gone; `user_orgs.deleted_at` set (DB-verified), `users` row intact.
8. ✓ Sarah's own row: Admin/Suspend/trash all disabled + tooltip; server twin returns 400 on self-PATCH (curl-verified).
9. ✓ Last-admin: 400 observable (self-guard on the sole admin); invariant otherwise structural — see note above.
10. ✓ First-sign-in linking: re-invited liam@nike.example then ran the real `upsertUserFromGoogle` with a matching profile → `google_sub` set, membership `invited → active`, `joined_at` stamped. (Re-invite undelete branch exercised in the same flow.)
11. ✓ No new console errors (two stale-chunk fetch errors occurred during an HMR rebuild race mid-verification — explained, not from the feature); `ng build` + `ng lint` clean; 0 `any`/`*ngIf`/`*ngFor`.
12. ✓ Old `client-angular/` on 4200 unchanged (`[Dev] v1.70a`).

## Decision points
- Confirm dialog = second `p-dialog` styled like the invite modal (consistency over `p-confirmdialog`'s separate service plumbing).
- Toggle error-handling = reload-to-server-truth rather than hand-rolled optimistic rollback (simpler, same UX outcome at this scale).
- `userId` stays non-null in practice (invites always create a stub users row); type keeps `| null` per the spec's forward-compat shape.
- pV2-02 upsert DID need extending (linking + default_org_id backfill) — flagged here as the prompt requested.

pV2-03 row added to `prompts/backlog.md` as Done (no row existed). Backlog: invite emails (Resend), undo toast, cross-org Ballpark view remain open per the prompt's out-of-scope list.
