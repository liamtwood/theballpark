# CC Prompt — p0010 — Conversation panel refinements

**Supersedes:**
- p0009 in full — the card shape change is carried forward here, plus more.
- p0008 §4.4 (action table) — replaced by the symmetric table in §2 below.
- p0008's implicit conversation panel header chrome — restyled in §3.

This consolidates three small refinements to the inbox conversation panel (and the public `/brief/:token` page that reuses the same components) into one coherent pass. They all touch the conversation panel chrome and the `MessageItemCardComponent` — landing them together avoids a stack of overlapping styling commits.

Same rules: existing v1.22 tokens only, Lucide icons only, theme-vs-semantic split, no hardcoded shadows / radii / hex.

## 1. Item card uses the marketplace card shape (was p0009)

The current `MessageItemCardComponent` was built per p0008's original §4.4 — image / name / description / price / status pill stacked, action row below. That was wrong. The card should reuse the marketplace's existing item card shape exactly, so a viewer's eye recognises "this is the same kind of object" whether they're browsing the catalogue or replying in the inbox.

### What the marketplace card looks like

Two layouts, same data:

**Row layout** (used in the marketplace list mode):

```
[image]  Name                              £ Price       [+ ♥ ✉]  >
         eyebrow line                       Unit
```

Image is a small square on the left, ~48px, `--radius-button`. Name bold, primary text. Eyebrow below in `--color-text-muted`, smaller. Price column on the right (bold price, smaller unit underneath). Action icons after. Trailing chevron when clickable.

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

Classes already defined in `catalogue-grid.component.ts`: `.bp-item-card`, `.bp-item-card-img`, `.bp-item-card-body`, `.bp-item-card-name`, `.bp-item-card-price`, `.bp-item-card-unit`, `.bp-item-card-supplier`. These are the source of truth for typography, spacing, radii, hover lift. Don't reinvent.

### Three deltas from the marketplace card

1. **Action slot replaces the icon cluster.** Where the marketplace card has `+ ♥ ✉` (post-p0007: `+ ♥`), the inbox card has the state-aware button cluster from §2 below — `Think · Decline · Adjust` (+ `Accept` when applicable, + `Pay` post-accept). The slot lives in the same position the icons occupy on the marketplace card (right side in row layout, top-right of image in grid layout).
2. **Status pill replaces or supplements the eyebrow.** The marketplace eyebrow is the supplier name; the inbox card carries a status pill using the semantic token from the codelist. In **row layout**, the pill sits inline next to the name in a small `--radius-pill` chip. In **grid layout**, the pill is overlaid bottom-left of the image.
3. **Price gains was→now treatment when adjusted.** If `price_ref !== price_current`, render `£X̶ £Y` — strikethrough on the original (muted), current price prominent (primary).

That's it. No description line, no nested action panel below the card body, no separate status row — the status is the pill, the actions are the slot, everything else matches the marketplace card pixel for pixel.

### Three contexts the card appears in

| Context | Layout | Compact prop | Action slot | Notes |
|---|---|---|---|---|
| Inbox summary header (items section above chat) | row | `compact=true` | hidden | Click row → smooth-scroll the chat stream to that item's most recent appearance + pulse-highlight ~1.2s. Status pill shown. |
| Inbox conversation stream (inline in chat bubble lane) | row | `compact=false` | shown (state-aware) | Sender-aligned. Card width fills the bubble lane (max ~70% of panel). |
| Public `/brief/:token` page | row | `compact=false` | shown (state-aware, `viewer='supplier'`) | Same as the conversation stream context. |

Grid layout isn't used in any inbox context today; the component should still support it cleanly so it can drop into a future "items in this quote" grid without rework.

### Implementation note

Import the `.bp-item-card*` style block from the existing marketplace component, or extract into a shared stylesheet imported by both — whichever fits the existing Angular pattern. If copying, leave a comment pointing to the source-of-truth in `catalogue-grid.component.ts` so a future change travels back here.

## 2. Symmetric action table (supersedes p0008 §4.4)

The original §4.4 had the agent doing nothing on `brief_sent` ("waiting on supplier"). Wrong — the agent might want to cancel an item before the supplier replies (client changed mind), adjust before the supplier replies (caught a spec error), or punt with a clock (internal review needed). Same applies in reverse — a supplier might want to retract a quote before the agent acts.

### The rule

- **Think · Decline · Adjust** — universal. Available to either party at any non-terminal state (`brief_sent`, `holding`, `quoted`, `adjusted_*`, `accepted` for Decline/Adjust only — see exceptions below).
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
- **Adjust on `accepted` un-accepts.** Clicking Adjust on an `accepted` item flips it back to `adjusted_by_{viewer}` and the other party gets the Accept button back. The Adjust inline form pre-fills with current values.
- **Adjust on `quoted` / `adjusted_by_*` from your own side is allowed** — it's a "I want to change my own most recent state". Same data flow as a fresh adjust.
- **Think (Hold) is the existing `holding` status with a friendlier verb.** Button label: **Think**. Pill label in codelist: keep as **Holding** (status pill on the card). Clicking Think opens the clock popover (calendar, today preselected, quick offsets) — picking a date sets `next_action_by` on the item AND flips status to `holding`. Same primitive we already have, just promoted to a first-class action button.
- **Empty action set collapses.** When no actions apply (waiting on the other party with no override, or terminal), the action slot renders nothing — don't render a placeholder.
- Use `--radius-pill` outlined buttons in a tight cluster. Calm. `Accept` carries `--theme-accent` text colour; the rest neutral.

### Wire-up

The transition logic is already in `transitionItem()` server-side — no new endpoint work needed. Adding new (status, viewer) → action mappings is purely client-side in `MessageItemCardComponent`. The Decline reason popover, Adjust inline form, and clock popover already exist (or are in the deferred TODO list) — wire Think to the clock popover, then on confirm fire `action: 'think'` (or whatever code the public/agent reply endpoints accept — add it server-side if missing) with the picked date.

If the server-side reply endpoints don't yet accept a `think` action, add it: `{ action: 'think', next_action_by, note? }` → calls `transitionItem({ toStatus: 'holding', actor, next_action_by, note })`. Single helper, single transition.

## 3. Conversation panel header restyle

The current header has back arrow + supplier logo + supplier name + category eyebrow + a row of four status pills (`Action / Waiting / Quoted / Booked`). The four pills are wrong — they look like the inbox filter rail but they don't filter anything inside a single thread. The header is also missing the contact name and the ref/subject context.

### New header layout

Single horizontal strip, no second row of pills. Left-to-right:

- **Back arrow** (Lucide `chevron-left`, `--color-text-muted`) — closes the conversation, returns to thread list.
- **Supplier logo** — 32px square, `--radius-button`. Falls back to initials in a themed-tint square if no asset.
- **Identity column** (the meaty bit, takes remaining width):
  - Tiny eyebrow line: `Ref {ref_code}` — small caps, `--theme-text` muted, 10px. e.g. `REF WA-001`.
  - Supplier name — bold, primary text, 15px. e.g. `Illusion Design & Construct`.
  - Subline — muted, 12px. Format: `{contact_name} · {category_name}`. e.g. `James Chen · Stand Structure`. Drop the contact name half if `contact_name` is null.
- **Spacer** (flex).
- **Next action chip** — only when `messages.next_action_by` is set. Lucide `clock` icon + relative format (`Next: Fri 29 May`). `--theme-soft` background, `--radius-pill`. Hover shows precise time. **Overdue**: chip background flips to `--color-danger-soft`, icon and text use `--color-danger`. Click → opens the clock popover to change/clear.
- **Overflow menu** (Lucide `more-horizontal`) — keep whatever's currently behind it (mark as read, archive, etc.). Unchanged.

### What gets dropped

- The four-pill row (`Action / Waiting / Quoted / Booked`) — removed entirely. Per-thread status is computed from items and surfaced on the **thread row in the inbox list** (already done in p0006), not duplicated inside the conversation panel.

### Where the per-item statuses live

- On each item card's status pill (the chip in §1).
- On each row of the summary header (items section) above the chat — same status pill.
- That's enough surface for the eye to scan "what state is this thread in" without a duplicate filter rail at the top.

## Verify

- **Card shape:** inbox conversation panel renders item cards in the exact visual shape of a marketplace row card — image / name + eyebrow / price + unit / action slot. Spacing, radii, typography all identical. Side-by-side check against the marketplace tab passes.
- **Summary header items:** same row card with `compact=true`, no action slot, status pill present. Click → scroll+pulse works.
- **Action symmetry:** on a `brief_sent` item, the agent view shows `Think · Decline · Adjust` (no Accept). Supplier view shows `Accept · Think · Decline · Adjust`.
- **Think button:** clicking Think on either side opens the clock popover. Picking a date flips status to `holding` and sets `next_action_by`. Reload — persists.
- **Adjust on `accepted` un-accepts:** click Adjust on an accepted item from the agent side; status flips to `adjusted_by_agent`. Switch to supplier view (incognito + token URL); `Accept · Think · Decline · Adjust` is offered.
- **Price was→now:** adjust an item, change the price; card shows `£X̶ £Y` with strikethrough on the original.
- **Header:** four-pill row is gone. Logo + eyebrow `REF XX-NNN` + supplier name + `{contact} · {category}` subline. `next_action_by` chip appears top-right when set; turns red when overdue.
- **Same component on `/brief/:token`:** open the public brief page. Header (different chrome — agency logo instead of supplier, since the supplier is the *viewer* there) but same item card component below renders identically minus the action set being supplier-side.
- **Theme sweep:** Amber + Pink + Slate × Light + Bold — status pills stay semantic, action button cluster reads, card shape unchanged across themes.

When complete and verified, mark p0010 `Done` in `prompts/README.md` and bump p0009 to `Superseded`.
