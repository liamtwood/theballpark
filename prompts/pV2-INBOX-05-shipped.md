# pV2-INBOX-05 — inbox item cards, nested rail, Decline/Cancel + declined excluded from totals

**Shipped:** 2026-07-10, chip `[Dev v2] v2.57`
**Commit:** `<pending>`

Conversational iteration on the project inbox + quote surfaces. The inbox now
renders the *actual* item-preview card the Estimate rail uses (as an
attachment), the conversation rail adopts the Final Quote's nested containment
pattern, either side can Decline/Cancel a line with a reason, and a declined
line drops out of every cost total while staying visible for the record.

## What landed

### Inbox — item preview as a message attachment
- The server attaches the **same `QuoteLine`** the Final Quote renders to each
  thread item (`toThreadItem` now carries `line`), via a new batched
  `projectsService.linesByIds(db, ids)` (reuses `QUOTE_LINE_JOIN` + `toQuoteLine`,
  keyed on the `project_items` row id). No bespoke copy → can't drift.
- Under the **initial quote-request (brief) message**, each item shows as a
  collapsible **attachment**: a `w-80` name bar (paperclip + name + chevron)
  that expands in place to the real **`ItemPreviewComponent`** (cover, "From £X
  / head", Supplier, Category, Description). Fixed `w-80` in both states so
  expanding never shifts width; aligned to the **sender's side** (right in the
  agent inbox — the brief is the agent's own message).
- The `QuoteLine → CatalogueItem` mapping was extracted to
  `quoteLineToCatalogueItem()` (quote-line.util) and reused by BOTH the Estimate
  right-rail and the inbox attachment (removed the inline copy).

### Inbox — nested rail (Final Quote containment pattern)
- The rail is now **outer counterparty card → category band → slim item rows**:
  agency view groups by **supplier** (logo/store glyph + name + total + chevron);
  supplier view groups by the **agency**. Category band = the thread (cat icon +
  name); item row = name + status pill. Clicks: band opens the conversation,
  item focuses it, outer expands/collapses. (`RailOuter` / `RailCat`.)

### Inbox — Decline / Cancel (with a reason)
- New red action in the item action bar: **Decline** (supplier) / **Cancel**
  (agent). Like Request Info, it **seeds the compose box** (`"<item> — Decline/
  Cancel because "`) and focuses it; Send posts the reason **and** marks the
  line declined (`decline` action → `declined_by_supplier` / `declined_by_agent`,
  already wired server-side). Switching item/thread abandons a pending decline.
- `.bp-act--red` added (soft danger fill, matching green/yellow/gray actions).
- Declined is **no longer terminal** — the 4 actions stay available so either
  side can change their mind / undo a mis-click (only `booked` is terminal).
- Agent-cancel pill reads **"You cancelled"** (agent) / **"Agency cancelled"**
  (supplier).

### Declined lines excluded from every total
- **`getEstimate`**, the **project-card `quote_subtotal`** (LIST_SELECT), and the
  **client-side category card total** now exclude `declined_by_supplier /
  declined_by_agent` (NULL cart lines kept). So the **project card ↔ Project
  Quote ↔ Final Quote client total all agree**. Bonus: filtering the declined
  row lets a competing live supplier row be picked for a logical line.
- **Final Quote**: a declined line still lists, now **dimmed with a
  struck-through, muted price** (tooltip "Declined — not included in the total").
- **Project Quote rail**: declined lines **don't appear at all**, and the rail
  now shows the **full server cascade** (Subtotal → Contingency → Your cost →
  Margin → VAT → Client total) via the shared `EstimateBreakdownComponent`
  (scope `all`), reloaded on every add/remove/qty — always identical to the
  Final Quote.

## Files touched
| File | Notes |
|---|---|
| `server/src/services/projects.service.js` | NEW `linesByIds` + export; declined excluded in `getEstimate` + LIST_SELECT card subtotal |
| `server/src/services/inbox.service.js` | require projectsService; `toThreadItem` carries `line`; `makeThread` linesById; both thread builders fetch lines |
| `client-v2/src/app/core/inbox/inbox.service.ts` | `InboxThreadItem.line: QuoteLine` |
| `client-v2/src/app/pages/inbox/inbox-rail.component.ts` | rewrite → nested `RailOuter`/`RailCat` (outer → cat band → item) |
| `client-v2/src/app/pages/inbox/inbox-project.component.ts` | nested railGroups; item-preview attachment (brief-only, w-80, sender-side); Decline/Cancel via compose (`decliningId`) |
| `client-v2/src/app/pages/inbox/inbox-status.ts` | TERMINAL = `booked` only; `declined_by_agent` → "cancelled" labels |
| `client-v2/src/app/pages/projects/quote-line.util.ts` | NEW `quoteLineToCatalogueItem` (shared mapper) |
| `client-v2/src/app/pages/projects/estimate-preview-rail.component.ts` | use shared mapper |
| `client-v2/src/app/pages/projects/estimate-item-row.component.ts` | declined row: dim + struck-through price |
| `client-v2/src/app/pages/projects/project-estimate.component.ts` | category total excludes declined |
| `client-v2/src/app/pages/projects/project-quote-rail.component.ts` | exclude declined; full cascade via `breakdown` input |
| `client-v2/src/app/pages/projects/project-marketplace.component.ts` | `est` resource (scope all) → rail `breakdown`; reload on mutations |
| `client-v2/src/styles.css` | `.bp-act--red` soft fill |
| `BACKLOG.csv` | +Final Quote status filter (declined show/hide); +supplier store category rail scope |

## Notes / follow-ups
- Server `STATUS_META` still flags declined `terminal: true` — only feeds the
  **thread-level aggregate** rollup, not item transitions. Revisit if a revived
  line makes the thread status read wrong.
- Backlog: a **status filter on the Final Quote** to hide declined lines
  entirely (they list-with-strike today).

---

### QC (Liam)
- Verified project card ↔ Project Quote ↔ Final Quote totals all match after
  declining lines. Will re-QC on the next fresh project create + manage.

---

## Iteration — v2.61 (2026-07-17) — pre-preview audit remediation
**Triggered by:** the end-of-arc architect audit (three independent read-only
passes — Angular, backend, security), `docs/audits/2026-07-17-inbox-about-project-arc-audit.md`.
Verdict was NOT-safe-to-promote: 3 blockers + 2 cheap should-fixes. All landed here.

### Fixes
- **B1 — armed decline misfired (HIGH, data-destructive).** `decline()` armed
  `decliningId`; only `send()`/`selectThread()`/`selectItem()` cleared it, so
  Decline → Request Info / Accept / Suggest → Send silently declined the line
  (Request Info *overwrote* the seeded reason, erasing the only clue). Fix: a
  `disarmDecline()` called at the top of `accept()`, `startPropose()`,
  `requestInfo()`. `inbox-project.component.ts`.
- **B2 — declined exclusion applied to 2 of 3 DISTINCT-ON sites (HIGH, wrong
  money).** v2.57 filtered declined in `getEstimate` + `LIST_SELECT` but not
  `listItems`, so the line list and the banner picked different rows of one
  fanned-out logical line. Fix: extracted the rule to ONE place
  (`line-total.util.js` `isDeclinedSql`/`notDeclinedSql`, PREFIX-matched) and had
  `listItems` de-prioritise declined in its ORDER BY (still LISTS them) so all
  three surfaces pick the same row. See RP-11.
- **B3 — What's-new page inverted on preview (HIGH).** `changelog.json` baked
  `previewVersion`/`pending` at generate time; on preview it would show v2.57–v2.61
  as "not yet on preview" with a stale v2.56 pill. Fix (per chat): the deployed
  JSON is now **notes-only** with explicit `dev[]` / `preview[]` sections the
  page renders verbatim — no split computed at read-time, so it can't invert.
  Whatever branch `npm run changelog` runs on bakes the split.
- **S1 — inbox tore down on every message.** `resource.isLoading()` is true while
  *reloading*; gating the skeleton on it alone destroyed the whole pane each
  send (lost compose focus, reset rail collapse state). Fix: `isLoading() &&
  !hasValue()`.
- **S2 — v2.59 client name invisible on the supplier inbox card.** `COALESCE`
  applied to 2 of 3 read sites; `inbox.service.js:354` still did bare `cl.name`
  (always NULL on v2 projects). Fix: `COALESCE(p.client_name, cl.name)`. (RP-11's
  sibling — same (N-1)-of-N shape.)

### Structural / prevention
- **RP-11 logged** in `AUDIT_LEDGER.md`: "a state rule implemented in N sites —
  the (N-1)-of-N failure." B2 is the exact class UNIFY-01a M-2 fixed, reintroduced
  8 days later. The declined predicate is now one definition per side
  (`line-total.util.js` server, `quote-line.util.ts` `isDeclined()` client), both
  matching the `declined` prefix so a new `declined_*` code can't be seen by one
  side and missed by the other — verified against the DB incl. a synthetic
  `declined_by_future_code` and NULL/cart. Grep signature recorded.
- **B1 discipline note (banked for future ships):** armed-state hygiene — any
  `xxxId` signal one action sets must be `clear()`ed by *every* sibling action
  that could plausibly follow it. This is the class independent auditors catch
  and authors don't (both B1 and B2 were introduced *and* missed by the author,
  surfaced only by the independent pass). New regression test
  `inbox-decline-arming.spec.ts` (9 cases) pins the Decline → Request Info → Send
  flow specifically.
- **Changelog trim closed a disclosure proactively:** all three auditors flagged
  `public/changelog.json` shipping 726 unauthenticated commit subjects (incl. a
  map of the admin surface + interim gates). The notes-only trim done for B3 also
  removes that exposure — before it became a post-promote finding. Deployed
  artifact dropped ~11.9k lines → 2.5 KB, zero hashes.

### Also
- Fixed a **pre-existing** stale test (`requires-org.guard.spec.ts` expected
  signed-out → `/login`; the guard has sent them to `/welcome` since pV2-SEC-01).
  A red suite hides real regressions, so corrected in passing (separate concern,
  noted here not to bury it).

### Deferred to follow-up (audit F-series, promotable)
F1 selection-reset-on-reload (linkedSignal on array identity); F2 `QuoteLine.itemId`
typed non-null but null for customs → `/store/items/null`; F4 inbox totals still
include declined; F5 `linesByIds` N+1 in the per-thread loop; F6 `inbox-project`
566 lines → extract `<app-inbox-item-actions>` (would make B1 structurally
impossible); F7 duplicate `client_name` output column in `getDetail`; F8 unbounded
`listClientNames`. Logged in the audit doc; none block preview.

**Files:** `line-total.util.js`, `projects.service.js`, `inbox.service.js`
(server); `inbox-project.component.ts`, `quote-line.util.ts`,
`estimate-item-row.component.ts`, `project-estimate.component.ts`,
`project-quote-rail.component.ts`, `whats-new.component.ts`,
`inbox-decline-arming.spec.ts`, `requires-org.guard.spec.ts` (client);
`gen-changelog.js`, `changelog.json`, `docs/release-notes/v2.59-61.md`,
`AUDIT_LEDGER.md`, the audit doc.
**Build:** clean. **Tests:** 76 passed (14 files).

### Concerns not in spec
- **S3 (decision, not a bug):** even notes-only, `changelog.json` is served
  unauthenticated. It now carries only curated customer-facing prose (no commits),
  so this is acceptable for preview — flagging so it's a conscious choice, not an
  inherited default. If the `dev[]` demo list should never be world-readable even
  as prose, move the fetch behind a gated endpoint (F-follow-up).
- **Promote preconditions** (from the audit doc): `npm run changelog` must run +
  commit on the `preview` branch; bump `environment.staging.ts`; `client_name`
  column is already present in `preview` (applied when v2.59 landed) so the
  promote is not DB-gated.
