# pV2-STORE-APPROVALS-01 — inline Approve / Reject / Edit on the items-in-approval screen

**Shipped:** 2026-10-14, chip `[Dev v2]` (auto-bumped by the post-commit hook)
**Branch:** rebuild/org-slice
**Scope:** client-only (Angular). First UI caller of the existing approval endpoint.

## What landed
Per-item moderation actions on the **Approvals** screen (the marketplace filtered to
pending — `BALLPARK_NAV` → `/marketplace?status=pending`), gated to what the current
user may do. No server changes — the approve/reject endpoint already existed
(`PUT /api/admin/items/:id/approval { decision: 'approve' | 'reject' }`,
`server/src/routes/admin-items.js`, admin-gated + `withModeration` escape) and
`StoreItemService.decide(id, decision)` already wrapped it with `bust()`. This is its
first UI caller.

- **Item card (`item-card.component.ts`)** — a new **moderation action row** shows for
  a ballpark admin on the queue:
  - **Approve** (green tick, `check`) + **Reject** (red stop, `octagon-x`) — only while
    `approvalStatus === 'pending'`.
  - **Edit** (`square-pen`) — any status, via the shared edit-link helper (admin →
    `/admin/orgs/:supplierId/items/:id`).
  - Gate: `showModeration = isAdmin() && !canManage() && !quickViewOnly()`. `!canManage()`
    keeps it off the owner's Shop tab and the admin org-scoped Shop tab (those already
    render the owner manage row, which already carries Edit) — no duplicate Edit, no
    approve/reject leak there. `!quickViewOnly()` keeps it off browse-only surfaces
    (shopfront). On `/marketplace?status=pending` the admin gets Approve/Reject/Edit.
- **Quick View dialog (`quick-view-dialog.component.ts`)** — mirrored for parity: a
  moderator sees **Approve** / **Reject** (soft `bp-act--green` / `bp-act--red`) in the
  footer on a pending item, alongside the existing **Edit**. A supplier (owner) viewing
  their own item sees **Edit only** — approve/reject are gated out (`canDecide` requires
  `activeOrgType === 'ballpark'`).
- **Shared helper (`shared/catalogue/item-edit-link.ts`, NEW)** — `itemEditLink(user, item)`:
  owner → `/store/items/:id`; ballpark admin on another org → `/admin/orgs/:supplierId/items/:id`;
  else `null`. Extracted from the Quick View's old inline `editLink` (extract-before-duplicate —
  now used by both the dialog and the card's moderation Edit).
- **Icon** — registered `OctagonX` in `app.config.ts` (`.pick`), the only new icon.

## Behaviour
Approve/Reject call `StoreItemService.decide()` → `bust()` bumps `catalogue.rev()`,
which is folded into `MarketplaceStore.itemsRes` params, so the grid reloads and the
decided item drops off the pending view. The card path additionally emits `changed`
(→ `store.reloadItems()`, already wired in `marketplace-page`); the dialog path closes
and lets the rev bump refresh. A `busy` signal guards double-submits.

## Permission model (client UX gate only — server enforces moderator authority)
| Viewer | Pending item | Non-pending item |
|---|---|---|
| Ballpark admin (queue) | Approve + Reject + Edit | Edit |
| Supplier (owner, Quick View) | Edit only | Edit only |
| Agency / non-moderator | none | none |

No approve/reject is rendered for non-moderators on any surface. The server
(`admin-items.js`, mounted under `requireActiveMembership('admin.cross_org_view')`)
remains the authority.

## Standards / hygiene
- Standalone + `OnPush` + signals + `@if`/`@for` + `input()`/`output()` + `inject()`
  throughout (both components were already compliant; new code matches).
- Tokens-only colours — `--color-success-soft` / `--color-danger-soft` + `color-mix`;
  no raw hex / Tailwind colour utils. Reuses the locked soft-fill standard
  (`.bp-act--green` / `--red` in the dialog; token-matched card variants).
- Extract-before-duplicate honoured (shared `itemEditLink`).
- Lucide via `.pick` (`OctagonX` registered).

## Verification
`npx ng build --configuration development` → exit 0 (no compile/template errors).
Not screenshot-verified — Liam QCs visuals on localhost:4202.

## QC pointers (localhost :4202 as a ballpark admin)
1. Nav **Approvals** (`/marketplace?status=pending`) → each pending card shows a green
   tick / red stop / pencil row. Approve or Reject → the item leaves the queue.
2. Open **Quick view** on a pending card → Approve / Reject / Edit in the footer; decide
   there → dialog closes, item leaves the queue.
3. As a supplier on your own pending item's Quick View → **Edit only**, no approve/reject.
