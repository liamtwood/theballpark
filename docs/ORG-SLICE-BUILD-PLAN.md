# Org slice — build plan

The **first vertical slice** of the pre-launch rebuild. Everything FKs to `orgs`, so
org goes first and becomes the **template** every later slice copies. Companion to
`DATA-MODEL-REDESIGN.md` (shapes), `DATA-MODEL-COLUMN-STANDARDS.md` (rules),
`CODELISTS.md`, and `adr/ADR-0002/0003`. Status: plan, 2026-10-04.

## Objective — what & why

Rebuild the org subsystem onto the redesigned data model: clean tables, one write path,
enforced tenancy, consistent names, right-sized files. **Why org first:** it's the tenant
root — users, items, projects, everything carries `org_id` and FKs to `orgs` — so its
shape and conventions set the standard the rest of the build inherits. Get org right and
the later slices are mostly repetition.

## The bar (the qualities every file in this slice must meet)

1. **Consistent** — naming (kebab-case · role suffix on every file · name by *domain* not
   host/slot · no single-file folders) · **one write path per table** (no SQL in routes) ·
   the three-bucket constraint rule · uniform RLS policy shape.
2. **Secure** — acquisition-grade: RLS enforced via `web_app_user` + per-request GUC;
   authority **derived from membership** (`user_orgs.role × org.type`), never a stored flag;
   `org_id` only from the JWT; `app_is_admin()` backdoor closed (FR-00215).
3. **Understandable / navigable** — the cluster reads as **satellites** (each owns a table)
   + **cross-cutting concerns**; one responsibility per file; a shared **types module**;
   predictable folder layout.
4. **Performant** — balance = ledger `SUM` (indexed), not a hot column; one-hop visibility
   via denormalised `org_id`; indexes on every FK + handle/`ref`; reads through views.
5. **Tight** — within the **250-warn / 400-alarm** line caps; **no dead code** (v1 remnants
   dropped); **no duplication** (merge the two team UIs, the two import-preview routes).
6. **Well annotated & described** — every file opens with a purpose header; non-obvious
   decisions link back to the standards docs; the *why* is recorded, not just the shape.

## Scope

**In — the v2 org cluster:** the satellites + concerns below.
**Out — v1 remnants** (retire with v1, not rebuilt): `orgs.js` (ungated legacy),
`clients.js` (v1 CRM — revisit under the *project* slice), `ballsTransactions.js` route,
`force-org-from-jwt.js` (v1 gate; v2 uses the RLS GUC).

## The cluster — satellites + concerns

**Satellites (own a table):**

| satellite | table | service | route | client | state |
|---|---|---|---|---|---|
| org (CRUD) | `orgs` (33-col) | `org.service` | `org.js` · `admin-orgs.js` | `org.service.ts`, `org-profile-edit`, `orgs-admin`, `org-media` | rework |
| subscription | `org_subscription` (new, history) | `subscription.service` (new) | — | profile finance | **new** |
| credits | `org_credits` (new, ledger) | `credits.service` (←balls) | — (surface if needed) | balance in profile | rework |
| favourites | `org_favourites` | `favourites.service` | `favourites.js` | favourites | keep |
| members | `user_orgs` | team ops + `auth.service` | `team.js` | `team.service`, `team.component`, `team-roster` | rework |
| addresses | `addresses` (new) | `address.service` (new) | — | address fields | **new** |

**Cross-cutting concerns (behaviour over org + members):**

| concern | lives in | state |
|---|---|---|
| security (who can CRUD) | `user_orgs.role × org.type` + `permissions.service` + middleware + RLS | align helpers to new tables |
| onboard | `onboarding.js` + onboarding client + `org.service.create` + first membership | rework (call service) |
| owner | `user_orgs.role = 'owner'` (creator/billing/can't-remove) | **new tier** (today only `is_admin`) |

## Data objects (DDL targets — from the standards)

`orgs` (33-col, object contract, `parent_id`→Ballpark root, `status` not `is_active`) ·
`org_subscription` (1-N history, `UNIQUE(org_id) WHERE status='active'`) ·
`org_credits` (append-only ledger; balance = `SUM`) · `user_orgs` (`role` member/admin/owner) ·
`addresses` (org via `primary_address_id`) · `org_favourites` · view `orgs_public`
(`security_invoker`). All carry: audit trio, soft-delete `deleted_at`, `org_id NOT NULL`
(except `orgs` itself), partial-unique handles, numeric `≥ 0`, RLS policy via `app_*` helpers.

## File worklist (every row has a verdict)

| file | → new name | action |
|---|---|---|
| `org.service.js` | — (absorbs `org-profile.util`) | Rework — one write path, status, drop balance writes |
| `org-profile.util.js` | into `org.service.js` | Merge |
| `org-import.service.js` | — (+ `guarded-fetch.util.js`) | Split |
| `balls.service.js` | `credits.service.js` | Rename + ledger rework |
| `organisation.js` (route) | `org.js` | Rename + call service |
| `admin-orgs.js` | `admin-orgs.js` + `admin-org-items.js` + `admin-org-extract.js` | Split (3 features) |
| `onboarding.js` | — | Rework (call `org.service.create`) |
| `orgs.js` | (deleted) | Remove (v1) |
| `org-import.js` | into `org.js` | Merge |
| `organisation.service.ts` | `org.service.ts` | Rename |
| `admin-org.service.ts` | + `catalogue-extract.service.ts` | Split |
| `team/team.service.ts` | `core/team.service.ts` | Rename (flatten folder) |
| `profile-edit.service.ts` | + `profile-media.service.ts` | Split |
| `profile.component.ts` | — | Split + reuse `org-profile-edit` |
| `profile-team-section.component.ts` | `team/team-roster.component.ts` | Merge (reused by profile + team page) |
| `orgs-admin.component.ts` | + `org-create-form.component.ts` | Split (416 → over alarm) |
| `org-name-default.ts` | into `onboarding.service.ts` | Merge (pure fn, no suffix) |
| **new** | `core/org.types.ts` | one types module for the cluster (server shapes mirrored) |
| *(keep as-is)* | auth·auth-cookie·middleware·guards·`team.component`·`team-member-row`·`org-type-strip`·`onboarding.component`·`org-media`·`profile-shopfront`·`org-profile-edit` | Keep |

Naming rules applied throughout: kebab-case · role suffix · domain-not-host · no
single-file folders · services folder holds `*.service.js` only (helpers fold or become
named shared modules).

## Build order (dependency; each sub-slice = DB → service → route → client → QC)

1. **security / RLS** — align the `app_*` helper functions + policies to the new tables; confirm `web_app_user` + `FORCE`.
2. **membership + owner** — `user_orgs` with `role` (member/admin/owner); `permissions.service` extended.
3. **org CRUD** — `orgs` table + view + `org.service` (one write path) + `org.js` + `admin-orgs` (split) + client.
4. **subscription** — `org_subscription` history + `subscription.service`.
5. **credits** — `org_credits` ledger + `credits.service` (balance = SUM).
6. **favourites** — `org_favourites`.
7. **addresses** — `addresses` + `address.service` + `primary_address_id` on `orgs`.
8. **onboard** — create org + first `owner` membership + session re-sign, via the services above.

## Acceptance

- Regression: delete child → delete parent → undelete parent → **child stays deleted**.
- RLS coverage test green (per-tenant isolation; two-party supplier access; admin via membership).
- Every file within line caps; naming lint passes; **zero SQL in routes**; one write path per table.
- Build + lint + type-check green; QC on localhost (:4201 / :3001).

## Open

- `clients` (CRM) deferred to the **project** slice (FK `projects.client_id`), not org.
- `line-total.util.js` (unrelated) flagged to move to a shared lib when the pricing slice runs.
