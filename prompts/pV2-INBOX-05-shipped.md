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
