# CC Prompt — p0013 — Brief as cards (event card + items + WhatsApp-style chat)

A real product shift. Today the brief is a formal HTML email built by the outreach compose modal — prose paragraphs ("Hi, We're sourcing quotes for…"), event details written out as sentences, items listed. Replies become more prose. It reads like a CRM template.

New model: **structured cards carry the data, short notes carry the human warmth.** Same shape as Amazon / Etsy / WhatsApp — the dominant interaction is clicking buttons on cards; freeform messages are the rare exception layer.

Three things move:

1. The conversation panel splits into **three collapsible sections** — Event details / Items / Conversation — each behaving like an accordion.
2. Every state change (Accept / Decline / Adjust / Think) lands as a **structured event card in the stream**, sender-aligned, not as a text bubble. Notes (if any) attach as small captions underneath.
3. The notification email matches — first email of a thread shows the event card + item cards + agent's note (if any) + CTA, rendered HTML. Reply emails strip to "Bob replied — open thread."

This supersedes the prose-heavy approach in p0008 §4.2 (chat stream) and §7 (email templates). Everything else from p0008 / p0011 / p0012 stands.

Same rules: v1.22 tokens only, Lucide icons only, theme-vs-semantic split, no hardcoded shadows / radii / hex.

## 0. Conversation panel header — email-style, supersedes p0011 §3

p0011 §3 specified the header reuse the catalogue's supplier list-mode card. In practice that creates a card-in-a-card effect (the supplier card sitting inside the conversation panel chrome with its own rounded corners + shadow + hover lift). It reads heavy and redundant — the agent already knows which supplier they're talking to from the inbox row they clicked.

Replace with an **email-message-header style** strip — flat, no card chrome, just text + actions:

```
[<]  [logo]  ProBuild Events                              [Waiting]  [⋯]
             Bob Smith · Ref HS-001 · Health & Safety
```

### Layout

Single horizontal strip across the top of the conversation panel, ~56px tall. Left to right:

- **Back arrow** — Lucide `chevron-left`, `--color-text-muted`, ~24px tap target. Closes the conversation, returns to the thread list.
- **Supplier logo** — 32px square, `--radius-button`. No shadow, no border. Falls back to initials in a themed-tint square if no asset.
- **Identity column** (the meaty bit, flex-grows to fill):
  - Top line: supplier name, bold, primary text, 15px (e.g. `ProBuild Events`).
  - Subline: `{contact_name} · Ref {ref_code} · {category_name}` in muted text, 12px (e.g. `Bob Smith · Ref HS-001 · Health & Safety`). Drop the contact half if `contact_name` is null. Drop the ref half if `ref_code` is null. Use the middle dot as the separator consistently.
- **Status pill** — thread-level aggregate (`message_status` per p0008 §1.2). Semantic token colour. `--radius-pill`, outlined or `--theme-soft` filled — match the existing inbox-row badge style for visual consistency.
- **Clock chip** — only when `messages.next_action_by` is set. Lucide `clock` + relative format (`Next: Fri 29 May`). `--theme-soft` background, `--radius-pill`. Hover for precise time. Overdue: `--color-danger-soft` background, `--color-danger` icon and text. Click → opens the clock popover.
- **Overflow menu** — Lucide `more-horizontal`. Keep whatever's currently behind it (mark as read, archive, etc.).

### What gets dropped vs. p0011 §3

- The card chrome (rounded outer container, shadow, hover lift) — gone. The strip sits directly on the conversation panel background with just a hairline divider below it.
- The "supplier list-mode card" reuse — gone. Don't import `SupplierRowCardComponent` here.

### Why email-style works

The header's job is identity (who am I talking to) + context (what's this thread about) + status (what state is it in). A flat email-style header carries all three in one line + one subline, costs ~56px of vertical space, and doesn't compete visually with the cards inside the conversation. The supplier card belongs in the catalogue, where it's the primary content; in the inbox it would just be repeating itself.

## 1. Three collapsible sections in the conversation panel

Below the header (§0), the conversation panel body is now three stacked sections, each collapsible.

### Section frame

Each section has a header strip (clickable to collapse/expand) and a body. Header:

- Small Lucide leading icon (`calendar-days` for Event details, `package` for Items, `message-circle` for Conversation).
- Small-caps `--theme-text` label.
- Right side: a small badge (`1 ITEM`, `3 messages`, etc.) + Lucide `chevron-up` / `chevron-down`.
- Header has a hairline divider below it; clicking anywhere on the header toggles the section.

Use existing `--shadow-xs`, `--radius-card`, `--border-hairline` — no new tokens.

### Default state

- **Event details:** collapsed (the agent usually knows what event they're in; supplier expands it once on first view).
- **Items:** expanded (this is the active surface).
- **Conversation:** expanded (the main content; can't actually collapse to zero — see below).

Persistence: collapse state stored in component-local state, not server-side. Reset on thread switch.

### Conversation section can't fully collapse

When Event details + Items are both collapsed, the Conversation expands to fill the panel. When one or both are expanded, Conversation shrinks but stays scrollable. There's no state in which Conversation header is shown collapsed — the section is always at least the chat stream + compose chip strip.

## 2. Event details card

The structured event-context card. Designed to mirror the visual rhythm in the screenshot the user provided:

```
+------------------------------------------------+
| EVENT DETAILS                              [⋯] |  ← --theme-soft bg, --theme-accent text, small caps
+------------------------------------------------+
|                                                |
|  REF          CLIENT          EVENT NAME       |
|  WA-016       Angel Delight   Pop-Up Activation|
|                                                |
|  GUESTS       DATE            VENUE            |
|  500          25–30 May 2026  Family-friendly  |
|  guests expected   3 days     London           |
|                                                |
+------------------------------------------------+
```

### Layout

- Three-column grid, two rows. Each cell: tiny `--theme-text` label (small caps, 10px, `--color-text-muted`), bold primary-text value below (14px), optional muted subline (11px, e.g. `guests expected`, `3 days`, `London`).
- The header strip uses `--theme-soft` background and `--theme-accent` text in small caps. Don't use a saturated `--theme-accent` fill — keep the calm system (p0002 rule: panel headers stay calm).
- Overflow menu (Lucide `more-horizontal`) on the right of the header — same pattern as elsewhere.
- Three columns at panel widths > 720px; collapses to one column on narrower viewports.

### Data fields

| Field | Source | Notes |
|---|---|---|
| REF | `projects.ref_code` or `projects.project_ref` | Project-level ref (e.g. `WA-016`). If the column doesn't exist yet, add it: `ALTER TABLE projects ADD COLUMN ref_code text` + a generator helper that mirrors the message `ref_code` pattern. |
| CLIENT | `projects.client_name` | Existing field. |
| EVENT NAME | `projects.name` | Existing field. |
| GUESTS | `projects.guest_count` | Existing or add. Subline: `guests expected`. |
| DATE | `projects.event_date_start` / `event_date_end` | Format range tightly: `25–30 May 2026`. Subline: `3 days` (computed). |
| VENUE | `projects.venue_name`, `projects.venue_city` | Subline is the city. |

Any field that's null renders the label + a muted `—`. Don't hide cells; the grid stays balanced.

### On the public `/brief/:token` page

Same card, same data, expanded by default. The supplier needs the context every time they open the brief; collapse-by-default makes more sense once they've seen it once, but it's the same component either way — the supplier just opens it on first visit.

## 3. Items section

No structural change from what p0011 §1 already specified (compact item cards, status pill, click-to-jump). Two refinements only:

- Wrap in the new collapsible section frame from §1.
- Section header badge counts active items: `3 ITEMS`. Don't count declined items.

## 4. Conversation as structured action events

This replaces p0008 §4.2 (chat stream).

### The principle

Every state change is a **structured event card in the stream**, sender-aligned, not a text bubble. Free-typed messages are the rare exception layer — most threads complete with zero hand-typed words.

### What renders in the stream

In chronological order, three kinds of entries:

1. **Brief sent** (the opening event) — items as a small cluster of grid cards (see *layout* below), aligned to the agent's lane. Optional caption underneath if the agent left a note (`hey bob, liam again, hope the kids are well ;)`).
2. **Action events** — when either party clicks Accept / Decline / Adjust / Think on an item card, the resulting state appears as that item's current grid card in the stream, sender-aligned, in the lane of whoever clicked it. Optional caption underneath if a note was attached (`can you inscribe Happy Birthday Aidan, thanks`).
3. **Free-typed messages** — short text bubble, sender-aligned, optionally tagged to an item with a small breadcrumb chip at the top of the bubble (`↳ Engraved Frame`). Tagging is set in the compose strip — see §5.

There are **no other entries**. No "Bob accepted the brief" system bubbles. No "Status changed to Quoted" announcements. The cards speak for themselves.

### Item card layout in the stream — GRID, not row

This is the one place item cards depart from p0011's row layout. **Items inside the chat stream use the marketplace GRID card** (image-on-top, vertical), not the row variant used in the Items section above.

Shape (mirrors `.bp-item-card` grid mode in `catalogue-grid.component.ts`):

```
+-----------------+
|                 |
|     image       |  ← clean image, no overlaid icons
|     [pill]      |  ← status pill overlaid bottom-left of image
+-----------------+
  Name (bold)
  £ Price  Unit
  [Action · Action · Action]   ← REPLACES the supplier-name eyebrow
```

Three deltas from the catalogue grid card:

1. **No `+ ♥ ✉` icons overlaid on the image.** Those belong to the catalogue's "add to project / wishlist / email" flow — irrelevant in conversation. The image is clean.
2. **Status pill overlaid bottom-left of the image** — small `--radius-pill`, using the semantic token (`--color-action / waiting / quoted / booked / danger`). Same overlay slot the icons occupied on the catalogue card.
3. **Action buttons replace the supplier-name eyebrow at the bottom of the card.** Where the catalogue grid card shows `Unique Venues of London`, the conversation card shows the state-aware action cluster from p0011 §2 (e.g. `Think · Decline · Adjust` or `Pay · Decline · Adjust`). When no actions apply (waiting on the other party, or terminal), the slot collapses cleanly — no placeholder, no eyebrow.

Card width in the stream: ~75% of the stream lane, sender-aligned. Multiple cards in a single "brief sent" cluster stack vertically (or in a 2-column grid if the panel is wide enough — `--bp-stream-lane-wide` breakpoint). Each card is independent — actions on one don't affect siblings.

The **Items section above the chat stream** stays as the row layout per p0011 §1 (image left / name + eyebrow / price + unit, no action slot, `compact=true`). That section is nav; the stream is conversation. Different jobs, different layouts, same component with a `layout: 'row' | 'grid'` prop.

### Column layout

The stream is two lanes:

- **Their side, left-aligned.** Supplier cards/bubbles/captions hug the left edge of the stream, max ~75% width.
- **Your side, right-aligned.** Agent cards/bubbles/captions hug the right edge, max ~75% width.

WhatsApp convention exactly. Each entry's lane is determined by who triggered it (the actor on a `message_item_events` row, the sender on a `message_replies` row). The opening brief lives in the agent's lane on the agent's view; in the supplier's view it lives in the agency's lane (left, since the supplier is "me").

### Date dividers

Same as today — small-caps muted text, hairline above and below, between consecutive entries on different calendar days.

### Visual rhythm

WhatsApp-feel:

- Cards and bubbles are sender-aligned: yours on the right, theirs on the left. Max width ~75% of the stream.
- Inline timestamp at the bottom-right of each card or bubble in muted text.
- Subtle background pattern using the same feTurbulence grain SVG as the Bold-mode hero, opacity ~0.04, fixed to the panel. Tokens stay ours.

### Click an item in the Items section

Per p0011 — smooth-scroll to that item's **most recent** appearance in the conversation stream, pulse-highlight ~1.2s. If the item only appears in the opening "brief sent" cluster (because nothing's happened to it yet), scroll to that.

## 5. Compose strip

Replaces p0008 §4.3.

### Default state (the common case — no message needed)

A flat strip at the foot of the conversation section. Left to right:

- **Quick-reply chips** — horizontally scrolling row of short canned replies, filtered by direction (agent vs supplier). Tapping a chip *immediately* sends the message (no intermediate text input). For chips with placeholders (`Got it in {colour}?`), tapping opens a tiny inline picker — placeholder gets focus, agent types the fill, hits Enter to send.
- **Item tag selector** (Lucide `paperclip`, but using an item-icon) — opens a tiny popover listing the items in this thread. Pick one → the next message you send (chip or free-typed) is tagged to that item with the `↳ {item.name}` breadcrumb.
- **Add note** button — Lucide `pencil`. Reveals a free-typed input (see below).
- **Clock** (Lucide `clock`) — opens the same calendar popover from p0011 §2. Sets `next_action_by` on whatever's being sent.

### Add-note expanded state

Clicking Add note reveals:

- A single-row textarea (grows to 4 lines max).
- A small **template hint** above the input: if this is the agent's first message in the thread AND they've never sent to this supplier before, prefill with the **cold template** (`hi {supplier_first} — {agent_first} from {agency}, putting together {project_name} and would love to include you. details attached.`). If they've sent before, prefill with the **warm template** (`hey {supplier_first}, {agent_first} again, details attached, let me know`). The agent can edit, blank out, or send as-is.
- A **Send** button (Lucide `send`) — `--theme-accent` filled. Enabled when the textarea has content OR a chip was tapped.

Closing the note input collapses back to the chip strip. The note auto-saves as draft so re-opening doesn't lose it.

### Implementation hooks

- Quick-reply chips are codelist-driven (`quick_reply_templates` from p0008 §1.5). Seed the codelist generously:
  - **Agent → supplier:** `Dates work?` · `Best price?` · `Available?` · `Lead time?` · `Got in {colour}?` · `Can you do {X}% less?` · `Thanks!` · `Can you inscribe {text}?`
  - **Supplier → agent:** `Dates work` · `Quote coming` · `Need more info` · `Can do {X}` · `Out of stock those dates` · `Available in {colour}` · `Thanks, received`
- Placeholder syntax: `{name}` triggers the inline picker.
- Item-tag selector writes to a per-thread `composeTaggedItemId` state; it clears after a message sends.

## 6. Email templates

Replaces p0008 §7.

### First email of a thread (outreach)

Structural reproduction. The supplier sees in HTML what they'd see in Ballpark:

```
[Agency logo + name]

──────────────────────────────
EVENT DETAILS
REF: WA-016 · CLIENT: Angel Delight · EVENT: Pop-Up Activation
GUESTS: 500 · DATE: 25–30 May 2026 · VENUE: Family-friendly venue, London
──────────────────────────────

3 ITEMS
[item card] Fire Marshal (Show Days) — £280 ref
[item card] Engraved Frame — £45 ref
[item card] Roses, 2 dozen — £40 ref

──────────────────────────────

{Agent's note if any}
"hey bob, liam again, hope the kids are well ;)"

[ View brief and reply ]   ← CTA, --theme-accent button → /brief/:token

──────────────────────────────
Powered by Ballpark · {agency_name}
```

Use inline CSS, max-width 600px, system font stack. The item "cards" in email render as compact HTML rows (image left, name + ref + price right) — same data, simplified markup. Don't try to faithfully reproduce the in-app card chrome; just convey the same content.

Plain-text fallback: same structure, dashes instead of cards.

### Reply emails (notification only)

Strip to a doorbell:

```
[Agency or supplier logo]

Bob replied.

[ Open thread ] ← /brief/:token

──────────────────────────────
Powered by Ballpark
```

No item summary, no event details, no action summary. The recipient clicks through to see the change.

### When each template fires

- **First email:** fired by `requestQuotes` when the brief is sent (already wired in p0008 §3 — just swap the template).
- **Reply email:** fired by the `/api/brief/:token/reply` and agent-side reply endpoints when any state change or message lands. Existing trigger; just swap the template.

If the agent sends a brief without filling in the note, the "Agent's note" block is omitted entirely from the email (no empty quote box).

## 7. Wiring + storage

- `messages.intro_note text` — new column. Stores the agent's optional intro on the first brief.
- `message_item_events.note text` — already exists per p0008 §2.2 — used for the optional caption attached to an action.
- Free-typed message bubbles need their own table or column: simplest is `message_replies` (id, message_id, sender_type, sender_id, body, tagged_item_id?, next_action_by?, created_at). Or extend an existing replies table if there is one — audit before adding.
- The stream renderer interleaves three sources by `created_at`:
  1. The opening "brief sent" event (`messages.created_at`)
  2. All `message_item_events` for items in this thread
  3. All `message_replies` for this thread
  Render order is strictly chronological.

## 8. What goes away

- The prose-heavy outreach compose modal (`outreach-compose.component.ts`) — replaced by a much smaller "Send brief" modal that just shows the event card + items preview + optional note input + Send. Most fields disappear.
- The `Brief:` subject prefix (already going via p0012).
- Any "system message" rendering code in the chat stream that produces "Bob accepted the X" or "Status changed to Y" lines.
- Long-form prose paragraphs in the HTML email body.

## Verify

- **Three sections:** Event details / Items / Conversation render as accordion sections in the conversation panel. Click headers to collapse/expand. Default: Event collapsed, Items expanded, Conversation always-on.
- **Event card:** matches the screenshot — 3×2 grid, calm `--theme-soft` header strip, fields populated from `projects.*`. Null fields show `—`.
- **Public brief surface:** same three sections, Event card expanded on first visit.
- **Brief send:** compose modal is much smaller — event details preview + items + optional note + Send. Note can be left blank.
- **Brief lands in stream as a "brief sent" event** — items shown as cards in the agent's lane, agent's note as a caption underneath if present. No prose bubble.
- **Action events:** Bob clicks Accept → an "Accepted" item card appears in his lane, no separate "Bob accepted" text bubble.
- **Optional caption on actions:** Bob clicks Adjust + types `can you inscribe Happy Birthday Aidan` → the adjusted item card lands in his lane + a small caption bubble underneath.
- **Free-typed messages tagged to items:** in compose, tap the item-tag picker → pick Engraved Frame → type `can you inscribe Happy Birthday Aidan` → send → bubble lands in the stream with `↳ Engraved Frame` breadcrumb at the top.
- **Quick-reply chips:** tap "Best price?" → sends immediately as a one-line message in the agent's lane. Tap "Got in {colour}?" → inline placeholder picker opens, agent types `green`, hits Enter → sends as "Got in green?"
- **Compose collapsed by default:** the only thing visible at the foot is the chip strip + item-tag picker + Add note button + clock. No text input until Add note is tapped.
- **Cold vs warm template:** first send to a never-used supplier prefills with the cold template; second send to the same supplier prefills with the warm template.
- **Email — first send:** HTML renders the event card + item cards + agent's note (if any) + CTA. Plain-text fallback parallel. Reply emails are notification-only with a single CTA.
- **Theme sweep:** Amber + Pink + Slate × Light + Bold — sections, event card header strip, item cards, bubbles all read cleanly.

When complete and verified, mark p0013 `Done` in `prompts/README.md`.
