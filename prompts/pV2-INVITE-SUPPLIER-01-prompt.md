# pV2-INVITE-SUPPLIER-01 — invite a supplier who isn't on Ballpark

**Status:** Ready (design locked with Liam 2026-11-08)
**Branch:** cut from `rebuild/org-slice` (needs 0033 + the supplier-costed add flow, `pV2-ADD-LINE-SUPPLIER-01`)
**Rationale:** `docs/DATA-MODEL-REDESIGN.md` decision log, 2026-11-08 "invite a new supplier".

## Why
An agency often has a supplier in mind who isn't on Ballpark yet. Today it can only add the line as its own cost.
It should be able to invite that supplier from the estimate, put lines against them, and send once they've joined.
Every invite is also supplier acquisition for the marketplace.

## Locked decisions
1. **A real pending supplier org** — `orgs` row, `type='supplier'`, `status='pending'` (already allowed by the
   0002 check). Not an agency-private contact record. Lines point at it with the existing
   `project_items.requested_provider_org_id` FK (0033) — nothing re-points when they join.
2. **Hold until joined.** Lines for a pending supplier can be added and edited, but Send is disabled ("Waiting for
   <Name> to join"). No anonymous `/brief/:token` quoting in this ship.
3. **One pending org per supplier, shared across agencies** — dedupe by invite email (lower-cased). A second agency
   inviting the same email reuses the pending org (it does NOT see the first agency's anything — only the org).
4. **Its own ship** — this spec. Agent-owned lines (top "Add line" → My own costs) stay exactly as they are.

## Scope

### UI (client-v2)
- **Top "Add line" gets a ⋯ menu** (estimate, Ballpark quote section header): **My own costs** (= today's
  `openAdd()`, unchanged) · **Invite a new supplier**. Use the shared app menu pattern (`docs/DESIGN.md`) — no new skin.
- **Invite dialog** (shared dialog chrome per `docs/DIALOGS.md`): Business name*, Contact name, Email*, Website,
  Category* (the project's category buckets). Submit → creates/reuses the pending org (see server) and seeds an
  empty supplier banner in that category.
  - Dedupe hit on an ACTIVE supplier → "Already on Ballpark: <Name>" with **Use them** (adds the banner for the
    existing supplier instead). Hit on a PENDING org → reuse silently.
- **Pending supplier banner:** the existing soft-pink supplier banner + an **Invited** pill (`app-status-pill`,
  new codelist value — see Data) + "+" (the supplier-costed add flow, unchanged). The per-supplier send icon is
  disabled with tooltip "Waiting for <Name> to join"; Message Suppliers skips pending suppliers with a note.
- **Supplier's first sign-in:** an invited user (seat `status='invited'` on a pending supplier org) lands on an
  accept screen: "<Agency> invited you to join Ballpark as <Business name>" → **Accept** → profile edit (they own
  and can correct everything the agency typed).

### Server
- `POST /api/projects/:id/suppliers/invite` — `{ businessName, contactName?, email, website?, categoryId }`.
  zod; agency-only (`requireActiveMembership`, agency org type); rate-limited (`authWriteLimit`).
  In ONE transaction (Rule 1):
  1. Dedupe: active supplier whose member/seat email matches, or whose website host matches → 409
     `{ existingSupplier: { id, name } }` (client offers "Use them"). Pending org with an invited seat for the email
     → reuse its id.
  2. Else create: `orgs` (type supplier, status pending, name, website) + `users` stub by email (the team-invite
     pattern, `team.js`) + `user_orgs` OWNER seat `status='invited'`, `invited_by_user_id`, `invited_at`.
     Cross-tenant write ⇒ the narrow owner-pool path (as `onboarding.js` create-org), audited.
  3. Record the inviting agency: `org_invites (id, supplier_org_id → orgs, agency_org_id → orgs, project_id,
     invited_by_user_id, email, created_at, accepted_at)` — the agency's read of "orgs I invited" and the
     acceptance notification hang off this. (New table — confirm at build start; see Data.)
  4. Send the invite email via `email.service` (Resend), gated by env flag `SUPPLIER_INVITE_EMAILS_ENABLED`
     (mirrors `QUOTE_REQUEST_EMAILS_ENABLED`). Never log the address in plaintext (`maskEmail`).
- **`addCustomItem` supplier check** (pV2-ADD-LINE-SUPPLIER-01): accept `supplier_directory` (active) OR a pending
  org this agency has an `org_invites` row for. Nothing else.
- **Estimate supplier name** for pending orgs: the agency can't read them (orgs RLS own-org; `supplier_directory`
  is active-only). Add a security-definer `invited_supplier_contact(target)` (mirrors `org_contact`, 0023) gated
  on an `org_invites` row for the caller's org → name/city/website + `status`. QuoteLine gains `supplierStatus`.
- **`sendOutreach`** refuses pending suppliers (400 "Supplier hasn't joined yet") — defence in depth behind the
  disabled UI.
- **Accept:** `POST /api/onboarding/accept-supplier-invite` — the invited user (authenticated, seat `invited`)
  flips seat → `active`, org → `active`, stamps `org_invites.accepted_at`, notifies each inviting agency (email,
  same flag). After accept the org appears in `supplier_directory` like any supplier.

### Data
- `org_invites` (new, agency-scoped RLS: agency reads its own rows; supplier members read rows for their org).
  Rebuild migration `0034`; DATA-MODEL-REDESIGN entry.
- `line_display_status` / supplier status pill: an **Invited** value (codelist seed in the same migration, colour
  editable in Settings ▸ Codelists).
- No change to `orgs`, `project_items` (0033 already covers routing), or `project_providers` (still created only at
  send).

## Out of scope
- Quoting without an account (`/brief/:token` for pending suppliers).
- Re-sending / expiring invites, invite management UI (list, revoke) — follow-up.
- Admin approval of agency-invited suppliers before they appear in the marketplace — follow-up decision (today an
  accepted supplier is just `active`; items still go through the normal approval flow).

## Acceptance
- ⋯ menu: My own costs behaves exactly as today's Add line.
- Invite a new email → pending org + invited owner seat + `org_invites` row; banner shows **Invited**; lines added
  under it carry `requested_provider_org_id` = the pending org; Send disabled; server send refuses it.
- Invite an email already on an active supplier → 409 → "Use them" adds that supplier's banner.
- Second agency invites the same email → reuses the pending org; neither agency can see the other's invite/project.
- Pending supplier does NOT appear in the marketplace / `supplier_directory`; cannot read any project.
- Invited user signs in → accept → org + seat active; inviting agency notified; the banner's Invited pill clears and
  Send works.
- RLS coverage test extended for `org_invites` + `invited_supplier_contact`.

## Addendum — 2026-11-10: "Add outside supplier" (dialog merges invite + request + send)

**Decision (Liam, 2026-11-10):** collapse the two-step flow (invite → bounce into Add Line → send on banner)
into ONE dialog. The invite IS supplier acquisition for the marketplace, and the first request rides along.

**Dialog** (`invite-supplier-dialog.component.ts`, reworked — no new server work):
- Retitled **"Add outside supplier"** / subtitle *"Invite a supplier to join the Ballpark Marketplace and quote
  for this project."*
- Fields: **Company name\***, **Email\***, **Category\***, **"What would you like quoted?"** (`bp-store-textarea`,
  optional). Dropped Contact name + Website from the UI (still sent as `null` — the server body is unchanged).
- Actions: **Cancel · Save · Send invitation** (both disabled until name + valid email + category).
  - **Save** → provision the pending marketplace org + banner + request line; hold (nothing "sent"). Lands back on
    the estimate so they can add more items, send later.
  - **Send invitation** → same, then the existing `sendSupplierInvite`. **No notifications yet**, so the email leg
    is a no-op; the dialog carries an honest note: *"Email invitations are pending sender-domain setup."*
- `InvitedSupplier` emit payload gains `quoteText` + `send`; "Use them" (409 active match) carries the same brief
  and the pressed Save/Send intent.
- **Coach tip** (`app-coachmark page="add-outside-supplier" name="intro"`) INSIDE the dialog — the menu item that
  opens it is transient, so the dialog is where the teach lands (mirrors `custom-line-dialog`'s in-dialog coachmark).

**Request brief → a custom line** (`onInvited` in `project-estimate.component.ts`): the brief becomes a custom line
(`addCustomItem`, name "Quote request", `cost:null`) tagged to the supplier via `supplierOrgId` — the "add item"
half of the merge, reusing the built pV2-ADD-LINE-SUPPLIER-01 path (accepts a pending org the agency invited). No
separate pending-supplier message object exists yet; when notifications/inbox-for-pending land, this can move to a
true thread seed. Entry menu item renamed **"Invite a new supplier" → "Add outside supplier"**.

**Claim flow (future, when notifications are hooked up):** the pending org is pre-provisioned at invite, so the
invited user just picks a password to claim the org that already exists — request waiting, no duplicate.

## Ship report
`prompts/pV2-INVITE-SUPPLIER-01-shipped.md` per `docs/CLAUDE.md` (API audit checklist for all three routes).
