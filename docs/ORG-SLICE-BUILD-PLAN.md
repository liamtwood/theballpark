# Org slice — build plan

The **first vertical slice** of the pre-launch rebuild. Everything FKs to `orgs`, so
org goes first and becomes the **template** every later slice copies. Companion to
`DATA-MODEL-REDESIGN.md` (shapes), `DATA-MODEL-COLUMN-STANDARDS.md` (rules),
`CODELISTS.md`, and `adr/ADR-0002/0003`. Status: plan (architect + design reviewed,
findings folded 2026-10-04).

## Objective — what & why

Rebuild the org subsystem onto the redesigned data model: clean tables, one write path,
enforced tenancy, consistent names, right-sized files. **Why org first:** it's the tenant
root — users, items, projects, everything carries `org_id` and FKs to `orgs` — so its
shape and conventions set the standard the rest of the build inherits.

## The bar

1. **Consistent** — naming (kebab · role suffix · name by domain not host/slot · no single-file
   folders) · **one write path per table** (no SQL in routes) · three-bucket constraint rule · uniform RLS shape.
2. **Secure** — RLS enforced (`web_app_user` + per-request GUC) · authority **derived from membership** ·
   `org_id` only from JWT · `app_is_admin` blanket backdoor **replaced** (see support model).
3. **Navigable** — cluster reads as **satellites** + **cross-cutting concerns**; one responsibility per file;
   a shared **types module**; predictable layout.
4. **Performant** — balance = ledger `SUM` (indexed) · one-hop visibility via denormalised `org_id` ·
   indexes on every FK + handle · reads through views.
5. **Tight** — within 250-warn / 400-alarm caps · no dead code (v1 remnants dropped) · no duplication.
6. **Annotated** — every file opens with a purpose header; non-obvious decisions link to the standards docs.

## Preconditions (MUST hold before step 3's destructive changes)

- **P1 — clean DB break.** New dev DB is **v2-only**. v1 (:4200) stays on the **legacy DB** (frozen, for
  reference), retired/pinned **before** any `orgs` rename lands. (ADR-0003.)
- **P2 — bootstrap exists (step 0).** **Ballpark org #1** (tree root) + a **sentinel system user** (no login;
  owns seed/machine data — codelists, extractor output; breaks the first-user chicken-and-egg) are seeded
  first, with audit FKs **nullable through bootstrap**, then re-enforced NOT NULL. A real human (Liam) is the
  **first owner** of Ballpark. Rebuild DDL lives in a **fresh build script**, NOT `migrate-schemas.js` (BE-00095, fatals ~2139).

## Scope

**In:** the v2 org satellites + concerns below.
**Out — v1 remnants** (retire with v1): `orgs.js` (ungated legacy), `clients.js` (v1 CRM → revisit under the
*project* slice), `ballsTransactions.js` route, `force-org-from-jwt.js` (v1 gate; v2 uses the RLS GUC).

## The cluster — satellites + concerns

**Satellites (own a table):**

| satellite | table | class | service | route | client | state |
|---|---|---|---|---|---|---|
| org (CRUD) | `orgs` (33-col) | A | `org.service` | `org.js` · `admin-orgs.js` | `org.service.ts`, profile sections, `orgs-admin`, `org-media` | rework |
| subscription | `org_subscription` (new, history) | C | `subscription.service` (new) | — | profile finance | new |
| credits | `org_credits` (new) | **E (append-only ledger)** | `credits.service` (←balls) | — | balance in profile | rework |
| favourites | `org_favourites` | C | `favourites.service` | `favourites.js` | favourites | keep |
| members | `user_orgs` | D | team ops + `auth.service` | `team.js` | `team.service`, `team.component`, `team-roster` | rework |
| addresses | `addresses` (new) | A | `address.service` (new) | — | address fields | new |

**Cross-cutting concerns:**

| concern | lives in | state |
|---|---|---|
| security | `user_orgs.role × org.type` + `permissions.service` + middleware + RLS | align primitives |
| onboard | `onboarding.js` + client + `org.service.create` + first owner membership | rework (service + `withTransaction`) |
| owner | `user_orgs.role = 'owner'` (creator/billing/can't-remove) · **multiple owners allowed** (enables clean transfer) | new tier |

### Ownership handoff (new capability)

Invites carry a **target role** (member / admin / **owner**). Ownership is **transferable**, and the guard
*"≥ 1 owner always"* makes every transfer safe (promote-then-demote, never a zero-owner gap).

**Concierge handoff (Ballpark created the org):**
1. Ballpark admin creates the org (holds the creator/edit grant).
2. Ballpark **invites the real person as `owner`**.
3. They accept → `role = owner` → the org now has a real owner.
4. On join, prompt them: **"Remove Ballpark's access to this org?"** — Yes = revoke Ballpark's grant (org
   self-owned; Ballpark → default view-only support); No = keep it. (Step 3 precedes step 4, so never zero owners.)

**Self-serve transfer:** an owner can promote a member to owner (co-owner) and step down — blocked if it would
leave the org with no owner. **Last-owner guard** applies to demote / remove / suspend / leave.

### Support-access model (replaces the `app_is_admin` backdoor — FR-00215)

Three tiers, consent-based, replacing the blanket GUC. **Build the replacement before removing the GUC —
one atomic cut-over.**
1. **View** — Ballpark support has **read-only** cross-org visibility by default ("best support with view access").
2. **Approve/reject** — platform governance recorded in an **approvals log** (FR-00214), NOT by impersonating the org.
3. **Edit another org** — **only with the org's explicit, time-boxed, audited grant.** An org is owned by its
   admin; no silent cross-org writes.

## Data objects (DDL targets)

`orgs` (33-col, `parent_id`→Ballpark root, `status` not `is_active`) · `org_subscription` (1-N history,
`UNIQUE(org_id) WHERE status='active'`) · `org_credits` (**append-only**, balance = `SUM`) · `user_orgs`
(`role` member/admin/owner) · `addresses` (org via `primary_address_id`) · `org_favourites` · view `orgs_public`.

**FK cycle** — `orgs.primary_address_id → addresses` and `addresses.org_id → orgs` is mutual. Create both
tables, then add `orgs.primary_address_id` (nullable) via a **deferred `ALTER`** once `addresses` exists.

**Every table carries:** audit trio, `deleted_at`, `org_id NOT NULL` (except `orgs`), its **own RLS policy**
(created with the table), and these **indexes / partial-unique**:
- FK indexes on every `*_id`; handle/`ref` `UNIQUE(...) WHERE deleted_at IS NULL`.
- `org_credits(org_id)` (SUM), `org_favourites(org_id, type)`, `org_subscription(org_id) WHERE status='active'`.
- `user_orgs` membership lookup covered by the composite PK (hot path: `require-active-membership`).

## File worklist

| file | → new name | action |
|---|---|---|
| `org.service.js` | — | Rework — one write path; **accepts injected `{ pool }`** (owner-pool at onboarding, RLS elsewhere); `status`; no balance writes |
| `org-profile.util.js` | **split** | read projection (`ORG_PROFILE_SELECT`/`toProfile`) → the **view**; `buildOrgUpdate` → `org.service` |
| `org-import.service.js` | — (+ `guarded-fetch.util.js`) | Split |
| `balls.service.js` | `credits.service.js` | Rename + append-only ledger (balance = SUM) |
| `organisation.js` | `org.js` | Rename + call service |
| `admin-orgs.js` | `admin-orgs.js` + `admin-org-items.js` + `admin-org-extract.js` | Split (items/extract are **item-domain** — migrate to Item slice later) |
| `onboarding.js` | — | Rework — `org.service.create` via **`withTransaction({ pool: ownerPool })`** (retire hand-rolled BEGIN/COMMIT) |
| `orgs.js` | (deleted) | Remove (v1) |
| `org-import.js` | into `org.js` | Merge |
| `organisation.service.ts` | `org.service.ts` | Rename |
| `admin-org.service.ts` | + `catalogue-extract.service.ts` | Split |
| `team/team.service.ts` | `core/team.service.ts` | Rename (flatten) |
| `profile-edit.service.ts` | + `profile-media.service.ts` | Split |
| `profile.component.ts` | — | **Section-level** split: extract About/Branding/Company/Gallery as section components (reuse the **service**, not a block); owner page composes shared sections + interleaved Team/Finance/Terms |
| `org-profile-edit.component.ts` | — | Keep (admin composition) + **admin-context banner** when `[orgId]` set ("Editing [Org] as admin") |
| `profile-team-section.component.ts` | `team/team-roster.component.ts` | Merge → one roster with **`[manage]` flag** (off = preview + "Manage team →"; on = full actions); invite = §10 drawer + `ed-input` |
| `orgs-admin.component.ts` | + `org-create-form.component.ts` | Split (416 → over alarm) |
| `org-name-default.ts` | into `onboarding.service.ts` | Merge (pure fn) |
| **new** | `core/org.types.ts` | one cluster types module (server shapes mirrored — **contract-tested**) |
| **new** | shared **Fetch-from-website** control | de-dup the 3 copies (profile / org-profile-edit / orgs-admin) |
| *(keep)* | auth·auth-cookie·middleware·guards·`team.component`·`team-member-row`·`org-type-strip`·`onboarding.component`·`org-media`·`profile-shopfront`·`§11 status/role pills incl. owner` | Keep / standardise pills |

## Build order (each sub-slice = DB → service → route → client → QC)

0. **Bootstrap** — Ballpark #1 + sentinel system user (audit FKs nullable → re-enforce). *(precondition P2)*
1. **Security primitives only** — `web_app_user` role, `app_current_org/user_id/is_admin` GUC helpers, `FORCE`
   convention, the uniform policy *shape*. (Per-table policies ship **with each table**, not here.) Design the
   **support-access replacement** for `app_is_admin`.
2. **orgs + user_orgs + addresses tables together** — resolves the FK cycle + the membership/`users` dependency
   (needs the bootstrapped system user); `user_orgs.role` (member/admin/owner); extend `permissions.service`.
3. **org CRUD** — `org.service` (injected pool) + `org.js` + `admin-orgs` (split) + section-level client.
4. **subscription** → 5. **credits** (ledger) → 6. **favourites** → 7. **onboard + ownership** (create org +
   first owner via `withTransaction`; invite-as-owner + handoff + "remove Ballpark?" prompt; cut over
   `app_is_admin` → support model).

## Acceptance

- Soft-delete regression: delete child → delete parent → undelete parent → **child stays deleted**.
- **RLS coverage test** (tenant isolation; two-party supplier access; support = view-only; edit only by grant).
- **Permission-mirror contract test** (server `permissions.service` ↔ client `permissions.ts`) + **`org.types.ts`
  contract test** + `effectiveRole`/`can` unit tests for the new **owner** tier.
- **Ownership handoff** — invite-as-owner; accept promotes to `owner`; concierge "remove Ballpark?" prompt
  revokes the grant **only after** a real owner exists; **"can't remove/demote the last owner"** guard + test
  (team ops; optional DB backstop); self-serve promote-then-step-down leaves ≥ 1 owner.
- Every file within caps; naming lint; **zero SQL in routes**; one write path per table; build/lint/type green;
  QC on localhost (:4201 / :3001).

## Open / deferred

- `clients` (CRM) → **project** slice (FK `projects.client_id`).
- `line-total.util.js` → move to a shared lib when the pricing slice runs.
- Confirm `org_subscription` lifecycle exclusivity (should `trialing` block `active`, or only `active` is unique?).
