# BE-00114 — Supplier inbox actions do nothing (error-surfacing first)

**Shipped:** 2026-09-20, chip `Dev v2.491`. **Owner:** CC (f2). Reported by Liam
via ballpark-bd during the EP-00020 sanity-check. Client-only; NOT security.

## Symptom
As a SUPPLIER, on item "scenic totem" in the inbox, Accept Cost / Change Cost /
Delete (decline) + main reply Send all do nothing — no toast, click never reaches
the server.

## Analysis (regression window corrected)
bd's first guess was the v2.488 pricing SSOT (last commit to touch
inbox-project). I diffed f6e41cc7: the ENTIRE v2.488 change to inbox-project is
(1) `import { lineTotal }`, (2) `lineTotalAt` refactored to call it (only invoked
by the `proposedTotal` computed), (3) one line in the edit-decline handler. The
send lifecycle (`send`, `itemAction`, `onAgentAddQuestion`, `submitPropose`) was
NOT touched and every path already resets `sending()` in a `finally`;
`lineCost`/`lineTotal` are null-safe (the agent estimate/cart flows using the same
module work). **So v2.488 is not the cause** (bd agreed). The symptom fits a
PRE-EXISTING mode: a silent early-return (`!thread` / `sending()`), or the empty
`catch {}` in every send path swallowing a real error with no toast.

## This ship — make the failure self-revealing (bd-greenlit, iteration 1)
The empty catches were a genuine defect (invisible failures). Now every inbox
write path surfaces errors + logs why it no-ops:
- Injected `MessageService` + added `<p-toast>` + `providers: [MessageService]`
  on the component itself — REQUIRED because suppliers hit inbox-project on the
  STANDALONE route `/inbox/:projectId` (not embedded in project-detail, so no
  parent provider; injecting a parent-only service would NullInjector-crash that
  route).
- `send`, `itemAction`, `onAgentAddQuestion`, and the line edit-save now
  `console.error(...)` + show an error toast in `catch` (was empty).
- `send`/`itemAction` guards now `console.warn(...)` the reason when they skip
  (no thread / already sending) so a silent no-op is visible.

Build clean; behaviour unchanged on success. On Liam's next retry the toast +
console will name the root cause; I'll then fix it precisely (iteration 2).

## Iteration 2 — ROOT CAUSE FOUND + FIXED (server-side)
It was **not** the client and **not** a stuck flag — the client trace showed the
guard can't fire when the buttons render. Root cause is in the SERVER reply
handler (`inbox.service.js reply()`), pre-existing:

- A thread is `(project, supplier, category)` and `thread.id = the LEAD (earliest)
  brief message` (`makeThread`). `getSupplierThreads` attaches items from **every**
  brief in the category (the "late-add" behaviour, line 326-328).
- But the reply handler matched each item-action's item to **only the lead
  message** (`mtag.message_id = threadId`). An item added on a **later** brief
  (an RFQ / quote-request line) is tagged to that later message → the lookup
  returned no row → the action was **silently `continue`'d** (no transition, no
  bubble, HTTP 200) → "does nothing, no toast, empty console".
- **Data confirmed:** the items tagged only by a non-lead message are exactly
  Scenic Totem, Tunnel Installation, 3 Course Italian Dinner — Liam's failing
  lines. OLD lead-only check → 0 rows; NEW thread check → 1 row.

**Fix:** the reply handler now matches the item to **any** message in the same
thread `(project_id, supplier_org_id, category_id)` — the true thread membership,
same ownership scope (the thread was already verified as the caller's). The
formerly-silent skip now `console.warn`s. So supplier accept / change-cost
(propose) / decline work on out_for_quote/RFQ lines.

Server-side; the v2.491 client error-surfacing stays (genuine improvement + surfaces
any future failure). Server nodemon reloaded, healthy.

## Next
- Liam re-QCs: as supplier, on an out_for_quote item (Scenic Totem / Tunnel),
  Accept / Change cost / Delete should now take effect (status changes + bubble).

## QC notes
(Liam)
