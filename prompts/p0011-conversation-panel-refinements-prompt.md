# CC Prompt — p0011 — Conversation panel refinements (v2)

**Supersedes:**
- p0009 in full (rolled forward into p0010, now into p0011)
- p0010 in full (superseded — header approach changed)
- p0008 §4.4 (action table replaced by §2 below)

Same three jobs as p0010 — card shape, symmetric action table, header restyle — with one change: the header is now built from the **existing supplier list-mode card** (the same row card used in the catalogue's supplier list), not a bespoke header strip. Same visual vocabulary as the catalogue, no new chrome.

Same rules as ever: v1.22 tokens only, Lucide icons only, theme-vs-semantic split, no hardcoded shadows / radii / hex.

## 1. Item card uses the marketplace card shape

The current `MessageItemCardComponent` was built per p0008's original §4.4 — image / name / description / price / status pill stacked, action row below. That was wrong. The card should reuse the marketplace's existing item card shape exactly, so the eye recognises "this is the same kind of object" whether browsing the catalogue or replying in the inbox.

### What the marketplace card looks like

Two layouts, same data:

**Row layout** (used in the marketplace list mode):

```
[image]  Name                              £ Price       [+ ♥ ✉]  >
         eyebrow line                       Unit
```

Image: small square left, ~48px, `--radius-button`. Name: bold, primary text. Eyebrow below: `--color-text-muted`, smaller. Price column right (bold price, smaller unit underneath). Action icons after. Trailing chevron when clickable.

**Grid layout** (used in the marketplace card grid):

```
+-----------------+
|                 |
|     image       |  ← action icons overlaid top-right of image
|                 |
+-----------------+
  Name
  £ Price  Unit
  eyebrow line
```

Classes already defined in `catalogue-grid.component.ts`: `.bp-item-card`, `.bp-item-card-img`, `.bp-item-card-body`, `.bp-item-card-name`, `.bp-item-card-price`, `.bp-item-card-unit`, `.bp-item-card-supplier`. Source of truth for typography, spacing, radii, hover lift. Don't reinvent.

### Three deltas from the marketplace card

1. **Action slot replaces the icon cluster.** Where the marketplace card has `+ ♥ ✉` (post-p0007: `+ ♥`), the inbox card has the state-aware button cluster from §2 below.
2. **Status pill replaces or supplements the eyebrow.** In **row layout**, the pill sits inline next to the name in a small `--radius-pill` chip. In **grid layout**, the pill is overlaid bottom-left of the image.
3. **Price gains was→now treatment when adjusted.** If `price_ref !== price_current`, render `£X̶ £Y` — strikethrough muted on the original, current price primary.

No description line, no nested action panel below the card body, no separate status row — the status is the pill, the actions are the slot, everything else matches the marketplace card pixel for pixel.

### Three contexts the card appears in

| Context | Layout | Compact prop | Action slot | Notes |
|---|---|---|---|---|
| Inbox summary header (items section above chat) | row | `compact=true` | hidden | Click row → smooth-scroll the chat stream to that item's most recent appearance + pulse-highlight ~1.2s. Status pill shown. |
| Inbox conversation stream (inline in chat bubble lane) | row | `compact=false` | shown | Sender-aligned. Card width fills the bubble lane (max ~70% of panel). |
| Public `/brief/:token` page | row | `compact=false` | shown (`viewer='supplier'`) | Same as the conversation stream context. |

Grid layout isn't used in any inbox context today; the component should still support it cleanly.

### Implementation note

Import the `.bp-item-card*` style block from the existing marketplace component, or extract into a shared stylesheet imported by both — whichever fits the existing Angular pattern. If copying, leave a comment pointing to the source-of-truth in `catalogue-grid.component.ts`.

## 2. Symmetric action table (supersedes p0008 §4.4)

### The rule

- **Think · Decline · Adjust** — universal. Available to either party at any non-terminal state.
- **Accept** — turn-based. Available only when the *other* party made the most recent non-think move.
- **Pay** — agent-only, on `accepted`. Flips to `booked`.

### Action set per status

| status | agent view | supplier view |
|---|---|---|
| `brief_sent` | Think · Decline · Adjust | Accept · Think · Decline · Adjust |
| `holding` | Think · Decline · Adjust | Accept · Think · Decline · Adjust |
| `quoted` | Accept · Think · Decline · Adjust | Think · Decline · Adjust |
| `adjusted_by_supplier` | Accept · Think · Decline · Adjust | Think · Decline · Adjust |
| `adjusted_by_agent` | Think · Decline · Adjust | Accept · Think · Decline · Adjust |
| `accepted` | Pay · Decline · Adjust | Pay (disabled) · Decline · Adjust |
| `booked` | — | — |
| `declined_*` | — | — |

### Notes

- **Think on `accepted` is intentionally omitted.** Once both parties have agreed, the next step is concrete (pay or cancel). No thinking room.
- **Adjust on `accepted` un-accepts.** Clicking Adjust on an `accepted` item flips it back to `adjusted_by_{viewer}` and the other party gets the Accept button back.
- **Adjust on your own most recent state is allowed** — it's "I want to change my own most recent state". Same data flow as a fresh adjust.
- **Think is `holding` with a friendlier button label.** Status code stays `holding`. Pill label stays `Holding`. Button label is **Think**. Clicking Think opens the clock popover (calendar, today preselected, quick offsets) — picking a date sets `next_action_by` on the item AND flips status to `holding`.
- **Empty action set collapses.** No placeholder.
- Use `--radius-pill` outlined buttons in a tight cluster. `Accept` carries `--theme-accent` text colour; the rest neutral.

### Wire-up

If the server-side reply endpoints don't yet accept a `think` action, add it: `{ action: 'think', next_action_by, note? }` → calls `transitionItem({ toStatus: 'holding', actor, next_action_by, note })`. Single helper, single transition. Everything else is client-side in `MessageItemCardComponent`.

## 3. Conversation panel header — reuse the supplier list-mode card

The current header has back arrow + supplier logo + supplier name + category eyebrow + a row of four pills (`Action / Waiting / Quoted / Booked`). The four pills were originally intended as a manual status-setter; that's not needed any more — per-item status is driven by the action table, and the per-thread aggregate is computed.

Drop the bespoke header entirely. Replace it with **the existing supplier list-mode card** (the same row card used in `catalogue-grid.component.ts` for supplier list mode — image + name + eyebrow + trailing actions). Same component, same styles, same visual rhythm as the catalogue tab.

### Layout

Single horizontal strip across the top of the conversation panel:

```
[<]  [logo]  Supplier Name                              [Status pill]  [Clock chip]  [⋯]
             eyebrow line
```

- **Back arrow** — Lucide `chevron-left`, `--color-text-muted`, ~24px tap target. Closes the conversation, returns to the thread list. Sits to the LEFT of the card, in the strip's gutter — not inside the card itself.
- **Supplier card** — the existing supplier list-mode card component, instantiated with the thread's supplier. Renders the supplier logo (square, ~48px, `--radius-button`), supplier name (bold), and eyebrow.
  - Eyebrow content: `{contact_name} · {category_name}` (e.g. `James Chen · Stand Structure`). If `contact_name` is null, just `{category_name}`. This is the *only* change from the catalogue's supplier card — the catalogue uses location (`London`); the inbox uses contact + category.
  - The heart icon and chevron from the catalogue card are **not** rendered in this context — the card is mounted with a `mode: 'inbox-header'` prop (or equivalent) that suppresses them.
- **Status pill** — the thread-level aggregate (`message_status` per p0008 §1.2 — computed from items by priority: Action / Waiting / Quoted / Booked / Closed). Sits where the heart icon would on the catalogue card. Uses the semantic token (`--color-action / waiting / quoted / booked`). Read-only — clicking it does nothing (or, future-future, opens a status legend).
- **Clock chip** — only when `messages.next_action_by` is set. Lucide `clock` + relative format (`Next: Fri 29 May`). `--theme-soft` background, `--radius-pill`. Hover for precise time. **Overdue**: chip uses `--color-danger-soft` background, `--color-danger` icon and text. Click → opens the clock popover to change/clear.
- **Overflow menu** — Lucide `more-horizontal`. Keeps whatever's currently behind it (mark as read, archive, etc.). Unchanged.

### What gets dropped

- The four-pill row (`Action / Waiting / Quoted / Booked`) — removed entirely.
- The bespoke header chrome — replaced by the supplier card.

### Where the per-item statuses live

- On each item card's status pill in the items section above the chat.
- On each item card's status pill inline in the chat stream (when the item is referenced).
- The thread-level pill in the header surfaces the aggregate.

### Implementation note

If the supplier list-mode card is currently embedded inline in `catalogue-grid.component.ts` rather than extracted as a standalone component, extract it now into something like `SupplierRowCardComponent` (or whatever name fits the existing pattern). Same data — `supplier`, `mode?: 'catalogue' | 'inbox-header'`, optional `statusPill`, optional `trailingChip`. Both the catalogue tab and the conversation panel header import the same component.

If extraction is bigger than expected, drop a `TODO(p0011-§3-extract)` marker and inline-copy the template + styles for now, but flag it so we can extract in a follow-up.

## Verify

- **Card shape:** inbox conversation panel renders item cards in the exact visual shape of a marketplace row card — image / name + eyebrow / price + unit / action slot. Side-by-side check against the marketplace tab passes.
- **Summary header items:** same row card with `compact=true`, no action slot, status pill present. Click → scroll+pulse works.
- **Action symmetry:** on a `brief_sent` item, the agent view shows `Think · Decline · Adjust` (no Accept). Supplier view shows `Accept · Think · Decline · Adjust`.
- **Think button:** clicking Think on either side opens the clock popover. Picking a date flips status to `holding` and sets `next_action_by`. Reload — persists.
- **Adjust on `accepted` un-accepts:** click Adjust on an accepted item from the agent side; status flips to `adjusted_by_agent`. Supplier view (incognito + token URL) offers `Accept · Think · Decline · Adjust`.
- **Price was→now:** adjust an item, change the price; card shows `£X̶ £Y` with strikethrough on the original.
- **Header:** conversation panel header now uses the supplier list-mode card. Back arrow on the left, supplier logo + name + `{contact} · {category}` eyebrow, status pill where the heart was, clock chip when set, overflow on the right. Side-by-side check against the catalogue's supplier list — same card, same dimensions, same fonts, only the eyebrow content differs.
- **Same component on `/brief/:token`:** the public brief page header uses the same card pattern, but with the *agency*'s identity instead of the supplier's. Status pill and clock chip behave identically. Items below are the same `MessageItemCardComponent`.
- **Theme sweep:** Amber + Pink + Slate × Light + Bold — status pills stay semantic, action cluster reads, card shape unchanged across themes.

When complete and verified, mark p0011 `Done` in `prompts/README.md` and confirm p0010 stays `Superseded`.
