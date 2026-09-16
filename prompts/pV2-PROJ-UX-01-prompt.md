# pV2-PROJ-UX-01 — Project workspace UX fixes (client feedback)

**Type:** client-v2 UI/UX · project workspace
**Owner:** CC implements + commits. Chat authored this spec. Liam QCs on
localhost (ng serve :4201 + server :3001), then promotes to preview.
**Source:** direct client feedback, 2026-09-16.

All five changes live in the project workspace, mostly across
`project-detail.component.ts`, `project-estimate.component.ts`,
`estimate-item-row.component.ts`, `quote-document.component.ts`. Paths/lines
below are from a fresh explore of the current tree — verify before editing.

---

## 1. Collapse the redundant cart actions → single "Message suppliers"

**Where:** `client-v2/src/app/pages/projects/project-estimate.component.ts`,
cart-view footer, ~lines **271–285** — the two buttons **"Edit in marketplace"**
(`(click)="addItems.emit()"`) and **"Go with this Ballpark"**
(`(click)="goToFinal.emit()"`).

**Client's point:** those two options already exist at the top of the view, so
the footer pair is redundant — it should just be **"Message suppliers."**

**Do:** first confirm the top of the cart view already offers the
edit-in-marketplace and go-with-ballpark actions (so nothing is lost). If so,
replace the footer's two buttons with a single **"Message suppliers"** button,
reusing the existing `messageSuppliers()` handler (the same action used in the
final view, ~lines 234–242). If the top does **not** already carry both, stop
and flag — don't strip an only-path action.

---

## 2. Show the supplier name on the item card

**Where:** `client-v2/src/app/pages/projects/estimate-item-row.component.ts`,
title/meta block ~lines **29–44**.

**Data is already there** — the card's `line = input.required<QuoteLine>()`
carries `line().supplierName` (see `core/projects/project.types.ts` ~65–69);
it's simply not rendered. Add a small meta line rendering
`line().supplierName` (guard the null case). Match the existing meta styling on
the row — no new tokens/colours. No data-layer change needed.

---

## 3. "Back" from the Quote document returns to Ballpark Cost, not Reports

**Where:** `client-v2/src/app/pages/projects/project-detail.component.ts`
~line **321**:
```html
@if (docView()) {
  <app-quote-document [projectId]="p.id" [project]="p" (close)="docView.set(false)" />
}
```
**Bug:** the quote document is opened from the **Reports** tab, so
`docView.set(false)` drops the user back on Reports. The "Back to builder"
button (`quote-document.component.ts` ~63–65) is documented to return to the
Final Quote / Ballpark Cost builder.

**Do:** on close, also route to the Ballpark Cost tab — e.g.
`(close)="docView.set(false); setTab('final')"` (use the existing
`setTab`/`goToTab` helper, ~lines 480–502, which sets `queryParams.tab`).
Verify `'final'` is the Ballpark Cost tab key (tabs computed ~396–407).

---

## 4 + 5. Message suppliers → live Overview, Inbox next to Overview with an attention badge

These two are one flow: **Ballpark Cost → Message suppliers → land on the live
Overview, with Inbox as the next tab showing an attention notification.**

### 4. Tab reorder — Inbox right after Overview
**Where:** `project-detail.component.ts`, the `tabs` computed ~lines **396–407**.
Current live order: `details (About/Overview) → final (Ballpark Cost) →
marketplace → reports → inbox`.
**Do:** move the `{ key: 'inbox', label: 'Inbox' }` push to immediately after
the `details` push. Keep the existing `if (!draft)` gating for inbox. New live
order: **About → Inbox → Ballpark Cost → Marketplace → Reports.**

### 5a. On a successful "Message suppliers" send, go to the live Overview
**Where:** the message-suppliers confirm path — `messageSuppliers()` /
`onSendBriefs()` in `project-estimate.component.ts` (~829–863). After a
**successful** send, navigate to the Overview tab (`setTab('details')` via the
parent, or emit an output the parent handles). Do not navigate on cancel or on
send failure.

### 5b. Inbox tab shows an attention notification
The Inbox tab should carry an attention badge/dot when there are pending
supplier responses / unread items — so right after messaging suppliers the
user sees Inbox lit up next to Overview.
**Do:** wire an attention indicator on the Inbox tab. Reuse the existing
inbox/messages signal if one exists (the messages-landing work added
`GET /api/inbox/summary` with per-supplier action rollups —
`itemWaitingOn`/`itemAction`/unread). Surface a boolean "has attention" from
that summary and render a badge/dot on the Inbox tab via `app-tab-band`
(extend the tab model with an optional `badge`/`attention` flag if the
tab-band doesn't already support one). If no attention signal is readily
available, flag it — don't invent a new backend endpoint in this prompt;
scope 5b to the smallest wiring that lights the tab from existing data.

---

## Acceptance
- [ ] Cart footer shows a single **Message suppliers** (only after confirming
      the top retains edit/go-with); nothing becomes unreachable.
- [ ] Item card shows the supplier name (null-safe), styled to match.
- [ ] Back from the Quote document lands on **Ballpark Cost**, not Reports.
- [ ] Live-project tab order: **About → Inbox → Ballpark Cost → Marketplace → Reports.**
- [ ] Successful Message-suppliers send routes to **Overview**; cancel/failure do not.
- [ ] Inbox tab shows an attention badge/dot when there are pending responses
      (or 5b flagged if no signal exists yet).
- [ ] v2 builds clean; version chip bumped. Liam QCs visuals.

## Notes for the ship report
- Confirm the #1 "top already has both actions" check result.
- State the source of the 5b attention signal (or why it was deferred).

## Concerns not in spec
Standard section. Flag any tab-band model changes needed for 5b, and any
routing edge cases (e.g. draft projects that lack the inbox tab).
