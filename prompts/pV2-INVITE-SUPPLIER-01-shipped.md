# pV2-INVITE-SUPPLIER-01 — invite a supplier who isn't on Ballpark

**Shipped:** 2026-11-08, chip `[Dev] v2.1145`
**Branch:** `claude/invite-supplier-01` (cut from `rebuild/org-slice` @ 618313e9). NOT merged into org-slice.
**Commits:** `17bedb3c` (feature), + this report.
**DB:** rebuild migration `0034_org_invites.sql` applied to dev2 (`jwerngwvensmmhwrcgul`) on its own via the Supabase MCP (dev2 has no run.js ledger). preview / prod untouched.

## What landed
- **Estimate "Add line" → menu.** Same overlay-menu markup as the inbox thread kebab. **My own costs** = today's `openAdd()` (unchanged). **Invite a new supplier** opens a new `app-invite-supplier-dialog`: Business name\*, Contact, Email\*, Website, Category\* (the project's buckets, via a new `GET /:id/categories`). The dialog includes the designer's one-line hold explainer.
- **Invite (server).** `POST /api/projects-v2/:id/suppliers/invite`. Agency-only, zod-validated, rate-limited per user (`supplierInviteLimit`, 20/h). It runs in ONE bootstrap transaction:
  - **Dedupe, cross-agency, on the owner path:** email → an active supplier seat = 409 `{existingSupplier}`. Email → a pending org's invited seat = silent reuse. An active supplier with the same website host or name = 409. A pending org with the same name = silent reuse.
  - **Otherwise create** the `orgs` row (supplier, pending), a `users` stub and a `user_orgs` OWNER seat with status `invited`.
  - **Link:** an `org_invites` row (upsert; one per agency × supplier).
  - **Email** via Resend, behind `SUPPLIER_INVITE_EMAILS_ENABLED`. It's sent only when this agency's link row is new. Addresses are masked in logs.
  - A fresh invite and a reuse return the same response shape, so the endpoint can't be used to check whether someone was already invited.
- **Routing / display.** `addCustomItem` now accepts `supplier_directory`, or a pending org that the caller's agency invited. QuoteLine reads the name/city of a pending supplier through the gated definer `invited_supplier_contact()` and carries a new **`supplierStatus`** (`active` / `pending`). The banner shows an **Invited** pill (`supplier_summary_status` code `invited`), derived by `supplierInviteCode()` from the one stored state, `orgs.status='pending'`. After an invite or "Use them", the supplier's banner appears in that category straight away (seeded client-side until it has lines).
- **Send held.** Message Suppliers skips pending suppliers and shows a "Waiting for <Name> to join" toast. `sendOutreach` refuses them with 400 "<Name> hasn't joined yet", which is the defence behind the UI.
- **Accept.**
  - The pV2-03 sign-in auto-accept now **skips seats on pending orgs**, so an invited user arrives orgless at `/onboarding`.
  - That page loads `GET /api/onboarding/supplier-invites` and shows an accept card: "<Agency> invited you to join Ballpark as <Business>".
  - `POST /api/onboarding/accept-supplier-invite` sets seat and org to active, stamps `accepted_at` on **every** `org_invites` row for that org, emails **every** inviting user, and re-signs the cookie into the org. The client then lands on `/settings/profile`.

## Files touched
| File | Lines (Δ) | Notes |
|---|---|---|
| server/db/rebuild/0034_org_invites.sql | +104 | table, RLS, `invited_supplier_contact`, `invited` codelist value |
| server/db/rebuild/tests/0034_org_invites.test.js | +111 | rollback-only RLS acceptance test (web_app_user) |
| server/src/db/rls-coverage.test.js | +27 | catalogue-driven definer lockdown: search_path pinned, cross-org fns not PUBLIC |
| server/src/services/supplier-invite.service.js | +280 | invite / listMyInvites / accept + emails |
| server/src/schemas/supplier-invite.schema.js | +22 | zod |
| server/src/db/with-transaction.js | +36/-1 | `withBootstrapTransaction` (owner pool, is_admin pinned for the txn) |
| server/src/middleware/rate-limits.js | +14/-1 | `supplierInviteLimit` (per user) |
| server/src/routes/projects-v2.js | +41 | `POST /:id/suppliers/invite`, `GET /:id/categories` |
| server/src/routes/onboarding.js | +33 | `GET /supplier-invites`, `POST /accept-supplier-invite` |
| server/src/services/project-line.service.js | +42/-3 | addCustomItem gate, QuoteLine `supplierStatus`, `listProjectCategories` |
| server/src/services/inbox.service.js | +17 | sendOutreach refuses pending |
| server/src/services/auth.service.js | +8/-2 | auto-accept skips pending-org seats |
| client-v2/.../projects/invite-supplier-dialog.component.ts | +155 | new dialog |
| client-v2/.../projects/project-estimate.component.ts | +112/-8 | menu, dialog host, seeded banners, Invited pill, held-send toast |
| client-v2/.../onboarding/onboarding.component.ts | +49/-2 | accept screen |
| client-v2/.../core/onboarding.service.ts, projects/project.service.ts, project.types.ts, status/line-display-status.ts | small | API + types + `supplierInviteCode` deriver |
| client-v2/src/app/app.config.ts | +4 | Lucide `Ellipsis`, `UserPlus` |
| docs/DATA-MODEL-REDESIGN.md | +22/-1 | decision-log entry: why the table won, final shape, build findings |

## Acceptance — 7 / 7 verified (dev2)
The walk ran against my branch's API on :3011 → dev2, with throwaway fixtures (two "ZZ Invite Test" agencies and their own projects; Liam's demo data untouched). **29/29 checks passed**, and the RLS test passed **12/12**.
- ⋯ menu: **My own costs** behaves exactly as today's Add line. ✓ by construction: the item calls the unchanged `openAdd()`. The visual is for Liam's QC.
- Inviting a new email gives a pending org + invited owner seat + `org_invites` row; lines carry `requested_provider_org_id` = the pending org; `supplierStatus` is `pending` (Invited pill); the server send refuses (400) and the project stays draft. ✓ API + SQL.
- Inviting an email that's already on an active supplier → 409 `existingSupplier`, so the dialog can offer "Use them". Same for an active supplier's name. ✓ API. The "Use them" banner seed itself is client-side, for Liam's QC.
- A second agency inviting the same email → reuses the pending org, with a response shape identical to a fresh invite; each agency sees only its own `org_invites` row and not the other's project or lines. A re-invite from the same agency keeps one row. ✓ API + RLS.
- A pending supplier is not in `supplier_directory`, reads no projects or lines, and is hidden by orgs RLS; an uninvited agency gets nothing from the contact fn; a tenant INSERT/UPDATE of `org_invites` is denied. ✓ RLS.
- The invited user lists the invite (both agencies) and accepts. A non-invitee gets 404. After accept the org and seat are active and **both** invite rows are stamped (fan-out); the line's `supplierStatus` becomes `active`; send → 201, one thread (on the test project only). ✓ API + SQL. The emails are behind the flag, which is unset on dev, so they were not sent.
- The RLS coverage test is extended (definer lockdown) and passes. The `0034_org_invites.test.js` acceptance test passes. ✓

**Not runtime-verified:**
- The Google sign-in path: the auto-accept exclusion is SQL-reviewed only, because the accept walk used a minted JWT.
- Visuals: the menu, dialog, pill and accept card are left for Liam's QC.

## API audit checklist
#### `POST /api/projects-v2/:id/suppliers/invite`
- ✓ **Method:** POST, creates (201).
- ✓ **Validation:** zod `SupplierInviteSchema`; the `:id` uuid param guard.
- ✓ **Authorization:** gated v2 router (authenticate + active membership) + `org_type==='agency'` (403); project ownership is checked on the RLS pool (404 if not the caller's); the category must belong to the project (400).
- ✓ **Status codes:** 201 / 400 / 403 / 404 / 409 (`existingSupplier`, or a name taken by a non-supplier) / 429.
- ✓ **Response shape:** `{ supplier:{id,name,status}, categoryId }`, identical for fresh and reuse.
- ✓ **Information disclosure:** a pending reuse is silent; a 409 names only ACTIVE suppliers, which are public in the marketplace. See Concerns for the name echo.
- ✓ **Observability:** one log line with the email masked.
- ✓ **Idempotency:** a re-invite is idempotent (`ON CONFLICT DO NOTHING`, and no repeat email).
- ✓ **Rate limit:** per user, 20/h (the abuse surface the designer flagged).
- ✓ **Performance:** a handful of indexed lookups (`users_email_uidx`, `orgs_name_uidx`). The host match scans `orgs` with a regex; fine at today's org count, noted under Concerns.

#### `GET /api/projects-v2/:id/categories`
- ✓ Gated router; own-org project check (404); read-only; bounded by the project's buckets.

#### `GET /api/onboarding/supplier-invites`
- ✓ `authReadLimit` + authenticate. Keyed on the JWT user only, read on the bootstrap path (the invited user has no org yet). Returns only that user's invited seats on pending orgs, plus the inviting agency names.

#### `POST /api/onboarding/accept-supplier-invite`
- ✓ `authWriteLimit` + authenticate; zod `{supplierOrgId}`.
- ✓ The seat must be the caller's own, `invited`, on a pending supplier org (`FOR UPDATE`), else 404. One transaction.
- ✓ The org flip runs AS the new owner (own-org policy) and is asserted via `RETURNING`.
- ✓ Re-signs the cookie (as onboarding create-org does). A repeat accept → 404 (idempotent-safe).

## Concerns not in spec

### Spec-hygiene precedence deviations
- **Route path.** The spec said `/api/projects/:id/suppliers/invite`; I built `/api/projects-v2/...`, because v2 projects live on the interim `/projects-v2` mount (v1 still owns `/api/projects`).
- **Rate limit.** The spec named `authWriteLimit` (per IP, 10/min). I added a per-USER limit at 20/h instead (designer flag; an office shares one IP).
- **"Audited" on the owner path.** There's no audit-log table in v2dev. Audit = the `created_by`/`updated_by` columns on every written row (the inviter) plus a masked log line.

### orgs UPDATE has no admin escape (by design) — the accept path acts as the owner
**Where:** `supplier-invite.service.js` `acceptInvite`.
**What:** My first run silently failed to activate the org. FR-00215 (0013) made `orgs` UPDATE member-only, so the bootstrap `is_admin` flag doesn't cover it, and RLS filtered the update to 0 rows without an error. Fix: once the seat is active, set `app.current_org_id` to the supplier org inside the transaction, so the ordinary own-org policy applies; `RETURNING` proves the update landed.
**Severity:** LOW (fixed). It's a pattern worth remembering: a bootstrap path can't write `orgs` cross-tenant.

### Silent reuse echoes the existing pending org's NAME
**Where:** the invite response and the banner (`invited_supplier_contact`).
**What:** If agency B types "Fern Flowers" for an email agency A invited as "ZZ Invited Florist", B's banner shows A's typed name. That reveals that someone else invited this email under that name. It's a weak oracle, but it isn't zero.
**Suggested fix:** deferred, needs a design decision. Either per-agency display names (an `org_invites.display_name`), or accept it, since the supplier will rename on accept anyway.
**Severity:** LOW.

### Name collisions with non-supplier orgs
**Where:** `inviteSupplier` dedupe.
**What:** `orgs.name` is globally unique. A business name equal to an agency's name gets 409 "already in use — add a location". That reveals that an org with that name exists; onboarding create-org has the same property today.
**Severity:** LOW.

### An existing Ballpark user with an active org never sees the accept screen
**Where:** `onboarding.component.ts`.
**What:** The accept card lives on `/onboarding`, which only orgless users reach. If the invited email belongs to someone already active in another org (an agency user who also runs a supply business), the seat sits `invited` with no surface to accept it.
**Suggested fix:** a follow-up, e.g. a home banner or a user-menu item driven by `GET /supplier-invites`.
**Severity:** MEDIUM for the follow-up list; rare today.

### Website-host dedupe is a regex over `orgs`
**Where:** `HOST_SQL` in `supplier-invite.service.js`.
**What:** It's an unindexed expression scan, which is fine at today's org count.
**Suggested fix:** an expression index or a stored `website_host` column if orgs grow.
**Severity:** LOW.

### Seeded banners are session-only
**Where:** `project-estimate.component.ts` `seededBanners`.
**What:** An invited supplier's banner with no lines disappears on reload (banners derive from lines). It's the same model as today, but it could surprise: invite, navigate away, and the supplier "vanishes" until a line is added. The invite itself persists.
**Suggested fix:** derive banners from `org_invites` for the project, or prompt for a first line in the success flow.
**Severity:** LOW (worth checking at QC).

### No per-supplier send icon exists today
**Where:** the draft supplier banner.
**What:** The spec says to disable "the per-supplier send icon". The draft banner has no such control, so the hold surfaces as the Invited pill (tooltip "Waiting for <Name> to join") plus the Message Suppliers toast.
**Severity:** LOW.

### Merge note
**What:** The `rebuild/org-slice` worktree has uncommitted edits to `project-estimate.component.ts` from another session, so expect a merge conflict in that file. The `environment.ts` build number (v2.1145) may also collide.
**Severity:** LOW.

### Email flag
**What:** `SUPPLIER_INVITE_EMAILS_ENABLED` is unset everywhere, so no invite or joined emails send on dev. Set it, along with `RESEND_API_KEY` / `WEB_BASE_URL`, per env when ready.
**Severity:** LOW.

### Test fixtures on dev2
**What:** The verification used "ZZ Invite Test Agency A/B" (ids `e1000000-0000-4000-8000-0000000000{a1,b1}`) with users, projects and a category bucket. These were deleted after the run (see the session report).

## Iteration 2 — invite on Send (Liam 2026-11-10)
**Ask:** "leave as is, just don't send the invite; the invite gets sent once they click Send (then hopefully they've added all the items they need)."
- `inviteSupplier` no longer emails. It still creates or reuses the pending org, the invited seat and the `org_invites` link. The dialog copy is now "Add supplier" ("Add your lines for them first...").
- **New:** `POST /api/projects-v2/:id/suppliers/:supplierId/send-invite` calls `sendInvite`.
  - agency-only, `supplierInviteLimit`, uuid params
  - project ownership checked on the RLS pool
  - 400 if no lines are put against the supplier
  - the pending owner email is read on the bootstrap path, gated on THIS agency's `org_invites` link (400 if no outstanding invite)
  - the email lists the line names; budget and prices are never included; the address is masked in logs
  - re-sendable, so the agency can add more lines and send again
- **Banner Send** is no longer disabled for an invited supplier. It calls `sendInvite`, and the toast reads "Invite sent to X, with N lines". Message Suppliers still skips invited suppliers and points to their banner Send.
- **Unchanged:** after they accept, the agency gets the "joined" email and sends the brief as normal (no auto-brief).
- **Verified:** `ng build` is clean; :3002 health is OK after reload; the route is mounted (401 unauthenticated). **Not exercised end to end:** emails stay off on dev (`SUPPLIER_INVITE_EMAILS_ENABLED` unset), so Liam's QC sees the toast but receives no email.

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in)
