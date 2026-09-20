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

## Next
- Liam retries Accept/Send in the supplier inbox → capture the toast text +
  console error → root-cause fix appended here.

## QC notes
(Liam)
