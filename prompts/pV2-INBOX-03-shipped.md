# pV2-INBOX-03 — agent inbox (project Inbox tab)

The agent side of the conversation, at the project level (Liam, 2026-06-29):
select a project → **Inbox** tab → read every supplier's thread.

## Slice 1 — agent reads the project's supplier conversations (read-only)

**Shipped:** 2026-06-29, chip `[Dev v2] v2.36a`

### What landed
- **`GET /api/inbox/projects/:projectId/threads` is now role-aware**
  (server-side, by JWT org_type): a **supplier** gets their own threads
  (per category); an **agency** gets **every supplier's** threads on a
  project it owns (RP-INB1 — ownership verified). Same `{ project, threads }`
  shape; bubbles + status mapped to the viewer's perspective.
- The inbox surface (`InboxProjectComponent`) is now **viewer-aware** —
  reused, not duplicated:
  - **Agency**: embedded in the project **Inbox tab** (`[viewer]="'agency'"
    [embedded]="true"`); the rail groups by **supplier → their items**; the
    header shows the supplier; status pills read agency-side ("Supplier
    accepted", "You revised"); **read-only** (agent compose + per-item
    actions are the next slice).
  - **Supplier**: unchanged standalone `/inbox/:projectId` (hero, PROJECT
    ITEMS tree, compose + Accept/Suggest/Request).
- Server reader refactored into shared `makeThread(viewer)` /
  `getProjectSummary` / `sortThreads` helpers feeding both
  `getSupplierThreads` + `getAgentThreads`.

### Files touched
| File | Notes |
|---|---|
| server/src/services/inbox.service.js | viewer-aware `toBubble`; `makeThread`/`getProjectSummary`/`sortThreads`; `getAgentThreads` (ownership-guarded) |
| server/src/routes/inbox.js | `/threads` branches on org_type |
| client-v2/.../core/inbox/inbox.service.ts | `InboxThread` supplier fields; `supplierInbox`→`projectInbox` |
| client-v2/.../pages/inbox/inbox-project.component.ts | `viewer`/`projectId`/`embedded` inputs; supplier-rail vs agent-rail; agency read-only; agency pill labels |
| client-v2/.../pages/projects/project-detail.component.ts | Inbox tab → embedded agency inbox |
| client-v2/src/environments/environment.ts | chip → v2.36a |

### Acceptance
- Agent opens a project → Inbox tab → suppliers (grouped) + their items +
  the conversation (read-only). Verified reader against live data: 4 threads
  across 3 suppliers, agent perspective, ownership guard returns 404. ✓
- Supplier `/inbox/:projectId` unchanged. ✓
- v2 build + server load clean. ✓

### API audit — `GET /api/inbox/projects/:projectId/threads`
- ✓ Method/validation (uuid param) · ✓ Authorization (gated; agency path
  verifies project ownership, supplier path scoped to own feed — RP-INB1) ·
  ✓ 404 for not-found AND not-owned (no disclosure) · ✓ Response shape
  unchanged · ✓ Performance (per-thread item fetch; small N).

### Concerns not in spec
#### Agent read-only this slice
**What:** the agency view hides compose + per-item actions. Agent compose +
actions (accept a supplier's suggested cost, counter, book) need the reply
endpoint extended for agency viewers (direction outbound + ownership check)
— the next slice. **Severity:** info

## QC notes
(Liam)

## Chat audit
(chat)
