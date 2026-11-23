# pV2-ADMIN-ORG-EDIT-01 — Admin organisation access (seat-scoped) — SHIPPED

**Release:** Preview **v0.11.1** (build v2.1245) · 2026-11-23
**Branch:** rebuild/org-slice → preview

## What shipped

A cluster of fixes that make platform-admin organisation management correct and
**seat-scoped**, plus the team-invite fix that started the thread.

1. **Team invite works for Ballpark admins** (`7535beb6`)
   `ballpark_admin` was missing `org.invite_member`, so the Team roster 403'd and
   invites failed for anyone whose active org is Ballpark — while the button (gated
   on `org.manage_billing`) still showed. Added `org.invite_member` to
   `ballpark_admin` in both matrices (`permissions.ts` + `permissions.service.js`);
   the two gates now cover the same roles.

2. **"Couldn't load this organisation" fixed** (`cf60e4be`)
   The supplier-detail Profile/AI-Assist tabs passed the URL **handle**
   (`pinnedSupplierId()`, pV2-BPIN-01) to the UUID-keyed admin route → `::uuid`
   cast error at `admin-orgs.js`. Now pass the resolved org UUID (`sup.id`).

3. **Admin org editing is seat-scoped** — the access model (Liam's call)
   A system admin edits an organisation's **profile + items** only by holding a
   **seat** in it and using **admin → Orgs → "Switch to"** (acts as the org → edits
   via the own-org path). Organisations with no seat are **view + moderate**
   (Approve / Reject) only.
   - Blanket "any admin edits any org" (withActingOrg + canEdit relax) was built then
     **reverted** (`c1b579bf` → `36be7136`). Resurrect from `c1b579bf` only if we
     later want seat-gated *in-place* editing.
   - Item editor: `isModerator = isEdit && activeOrgType==='ballpark'` — read-only +
     Approve/Reject on the admin route unless acting as the org (`81bde9cb`).
   - `itemEditLink()`: no Edit affordance for a ballpark admin without a seat —
     owner (switched-in) only (`fe3ff6a8`).

## Verified (dev2)

- ballpark_admin GET /api/team 200 + POST /api/team/invite 201 (both 403 before).
- Supplier Profile/items load via UUID; non-member admin edit **reverted** → RLS
  denies cross-org writes (seat-scoped).
- As Beth (ballpark admin): org with a seat → Switch to → edit profile + items;
  org without a seat → view + Approve/Reject only, no Edit pencil.
- Client builds clean at each step.

## Still open (not in this release)

- **AI-Assist catalogue extract** is the one remaining admin cross-org write. Default
  intent: seat-scoped (Switch-to first). Decision pending.
- **Invite email**: team invites send no email; a seat sits `invited` until the
  invitee's next sign-in. Wiring a Resend invite email is owed (per env key).

See memory `project_admin_supplier_access_model` for the standing decision.
