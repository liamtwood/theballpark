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

---

## Concerns not in spec (added retroactively on 2026-06-11)

This section was added during pV2-AUDIT-01's retroactive concerns pass. The
original report was silent on these.

### Raw Tailwind color values in the team page (Violation B)
**Where:** `client-v2/src/app/pages/settings/team/team.component.ts` (~7 places) + `team-member-row.component.ts`
**What:** `border-black/10`, `border-black/20`, `text-slate-500`, `bg-white` (plus `text-slate-400/600`, `bg-amber-50`, `bg-red-50`, `text-emerald-700` in the row/badges) bake raw colors into the DOM, outside the token system. **Provenance:** the pV2-01b/01c spec templates themselves contained `text-slate-500`, `bg-white/80`, `border-black/5`; I extended the spec-established pattern under the then-current "visual decisions are settled in the prompt; don't relitigate" rule. The new §"Hygiene rules outrank spec-embedded code" precedence rule resolves this conflict going forward — compliant implementation becomes mandatory, recorded as a precedence deviation.
**Suggested fix:** define the semantic token set + REPLACE the Tailwind palette (compile-time enforcement) and convert all v2 templates (pV2-AUDIT-02 Fix 5).
**Severity:** MEDIUM

### Live-membership gate is a per-route convention, not middleware (Violation F)
**Where:** `server/src/routes/team.js` (router-level `router.use(...)` block)
**What:** the per-request live `user_orgs` re-read (which makes suspension bite immediately) lives inline in the team router only. The next v2 endpoint must remember to copy it; if it forgets, a suspended user's 7-day JWT keeps working there. Allow-list where default-on is correct — the structural risk my original report described as a strength ("LIVE membership check per request") without flagging that it wasn't extracted.
**Suggested fix:** extract `requireActiveMembership(perm?)` middleware, mount once at the v2 router level, delete the inline copy (pV2-AUDIT-02 Fix 1 — blocks pV2-04).
**Severity:** HIGH (structural)

### Twin resource() declarations (finding I)
**Where:** `login.component.ts` + `user-menu.component.ts`
**What:** identical `resource({ loader: listDevUsers().catch(() => []) })` declared in both. Fine at two call sites; a third consumer means extraction (a `devUsers` resource on AuthService).
**Suggested fix:** extract on third consumer; no action now.
**Severity:** LOW

### User-menu popover is keyboard-incomplete (finding K)
**Where:** `shell/user-menu/user-menu.component.ts`
**What:** generic `<p-popover>` — no arrow-key navigation, no `role=menu`. Tab navigation + PrimeNG focus trap work today.
**Suggested fix:** Angular Aria Menu pattern if/when a11y hardening becomes a priority; defer.
**Severity:** LOW

### Additional (spotted during this retroactive pass, beyond the audit list)

### Invite endpoint lacks length limits on free-text fields
**Where:** `server/src/routes/team.js`, `POST /invite`
**What:** `displayName` and `jobTitle` are trimmed but unbounded — a megabyte job title inserts fine. Email is regex-validated; the others aren't length-checked.
**Suggested fix:** cap at sane lengths (e.g. 200 chars) server-side; reject oversize with 400. Small add for pV2-AUDIT-02 or pV2-04.
**Severity:** LOW

### Suspended-invited member unsuspends to 'active', not 'invited'
**Where:** `team.js` `PATCH /:userId/status` (noted in a code comment, never surfaced in the report)
**What:** suspending a still-invited member then unsuspending lands them on `status='active'` without ever signing in — they'd appear as a full member who never joined (`joined_at` NULL).
**Suggested fix:** restore to the prior status (store it, or derive: `joined_at IS NULL → 'invited'`). Cosmetic-to-minor; fix opportunistically.
**Severity:** LOW

### errorDetail() is a local helper in a page component
**Where:** `team.component.ts` (bottom)
**What:** the HttpErrorResponse-unwrapping helper will be wanted by every page that surfaces server guard messages; second consumer should trigger extraction to `core/`.
**Suggested fix:** extract on second consumer.
**Severity:** LOW
