# CC Prompt — p0009 — Inbox item card uses the marketplace card shape

This **supersedes §4.4 of p0008** (`MessageItemCardComponent` chrome). The shape described in p0008 — image left / name / description / price / status pill stacked, action row below — was wrong. The card should reuse the marketplace's existing item card shape exactly, so a viewer's eye recognises "this is the same kind of object" whether they're browsing the catalogue or replying in the inbox.

Everything else in p0008 §4.4 still holds: the component is standalone, used in three places (inbox summary header, inbox conversation stream, public `/brief/:token` page), props `item: MessageItem` + `viewer: 'agent' | 'supplier'` + `compact: boolean`, action set is `(status, viewer)`-driven per the table in p0008.

This is the only change: **the visual shape of the card matches the marketplace card**, not the layout p0008 originally described.

## What the marketplace card looks like

Two layouts, same data:

### Row layout (used in the marketplace list mode)

```
[image]  Name                              £ Price       [+ ♥ ✉]  >
         eyebrow line                       Unit
```

Image is a small square on the left, ~48px, `--radius-button`. Name is bold, primary text. Eyebrow below name in `--color-text-muted`, smaller. Price column on the right (bold price, smaller unit underneath). Action icons after. Trailing chevron when the card is clickable for detail.

### Grid layout (used in the marketplace card grid)

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

Image fills the top of the card, action icons sit overlaid in the top-right corner of the image (the existing pattern in `catalogue-grid.component.ts` — pink-filled `+`, outlined `♥`, outlined `✉` *post-p0007 that ✉ is gone*).

Classes already defined: `.bp-item-card`, `.bp-item-card-img`, `.bp-item-card-body`, `.bp-item-card-name`, `.bp-item-card-price`, `.bp-item-card-unit`, `.bp-item-card-supplier` — these are the source of truth for typography, spacing, radii, hover lift. Don't reinvent.

## How the inbox card differs from the marketplace card

Three changes, nothing else:

1. **Action slot replaces the icon cluster.** Where the marketplace card has `+ ♥ ✉` (post-p0007: `+ ♥`), the inbox card has the state-aware button cluster from p0008's table — `Accept · Decline · Adjust` or `Pay · Decline · Adjust` or nothing, depending on `(status, viewer)`. The slot lives in the same position the icons occupy on the marketplace card (right side in row layout, top-right of image in grid layout).
2. **Status pill replaces or supplements the eyebrow.** The marketplace eyebrow is "Unique Venues of London" (supplier name). The inbox card carries a status pill (`Brief Sent / Holding / Quoted / Accepted / Booked / Declined / …`) using the semantic token from the codelist. In **row layout**, the pill sits inline next to the name in a small `--radius-pill` chip. In **grid layout**, the pill is overlaid bottom-left of the image (mirror of the action cluster).
3. **Price gains was→now treatment when adjusted.** If `price_ref !== price_current`, render `£X̶ £Y` (strikethrough on the original, current price prominent). Token: muted text for the strikethrough, primary for the live price.

That's it. No description line, no nested action panel below the card body, no separate status row — the status is the pill, the actions are the slot, everything else matches the marketplace card pixel for pixel.

## Three contexts the card appears in

| Context | Layout | Compact prop | Action slot | Notes |
|---|---|---|---|---|
| Inbox summary header (top of conversation panel — collapsible nav) | row | `compact=true` | hidden (this is nav, not action) | Click the row → smooth-scroll the chat stream below to that item's most recent appearance and pulse-highlight it for ~1.2s. Status pill shown. |
| Inbox conversation stream (inline in chat bubble lane) | row | `compact=false` | shown (state-aware) | Sender-aligned (card sits inside the bubble lane, right-aligned for the viewer's own actions, left-aligned for the other party's). Card width fills the bubble lane (max ~70% of panel). |
| Public `/brief/:token` page | row | `compact=false` | shown (state-aware, `viewer='supplier'`) | Same as the conversation stream context — supplier sees their action set. |

Grid layout is not used in any inbox context today. It's listed here only because the component should still support it (cleanly) so the same component could be dropped into a future "items in this quote" grid view without rework.

## Action slot specifics

- Use `--radius-pill` outlined buttons in a tight cluster. Calm — no big primary fills.
- The `Accept` button carries `--theme-accent` text colour to draw the eye; the rest are neutral text.
- Buttons share a height with the price column so the right side of the card stays balanced.
- When the action set is empty (waiting on the other party, or terminal), the slot collapses to nothing — don't render a placeholder.
- Clicking a button does what p0008 §4.4 describes (Accept flips status, Decline opens reason popover, Adjust opens inline form, Pay flips to `booked`). The button cluster is the *only* part of the card chrome that p0008 §4.4 still drives.

## Implementation note

`MessageItemCardComponent` should import the `.bp-item-card*` style block from the existing component (or copy it into its own stylesheet — whichever fits the existing Angular pattern best). If copying, leave a comment pointing back to the source-of-truth definition in `catalogue-grid.component.ts` so a future change to the marketplace card travels back here.

If there's an obvious refactor — extract the `.bp-item-card*` rules into a shared stylesheet imported by both components — do it as part of this prompt, but don't get pulled into a bigger styling cleanup. Scope is the marketplace shape adoption for the inbox card.

## Verify

- The inbox conversation panel renders item cards in the **exact** visual shape of a marketplace row card — image / name + eyebrow / price + unit / action slot. Spacing, radii, typography all identical.
- The summary header at the top of the conversation panel uses the same row card, `compact=true`, no action slot, status pill present.
- The public `/brief/:token` page reuses the same component; supplier sees their action set.
- Status pill colours pull from the `message_item_status` codelist's semantic tokens (`--color-action / waiting / quoted / booked / danger`).
- Adjust → price changes → card now shows `£X̶ £Y`. Reload. Persists.
- Side-by-side: open the marketplace tab and the inbox conversation tab; the item cards visually match minus the three documented differences (action slot, status pill, price was→now).

When complete and verified, mark p0009 `Done` in `prompts/README.md`.
