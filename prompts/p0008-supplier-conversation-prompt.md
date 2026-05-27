# CC Prompt — p0008 — Supplier consumer view + inbox conversation pattern

This closes the loop on the outreach flow. We've got the **cart** (where the agent sends a brief, one email per category, one thread per supplier) and the **inbox** (where replies land — p0006). What's missing is everything in between: the conversation pattern itself, the supplier's side of it, and the data + status spine that holds it together.

Mockup: `p0008-conversation-pattern-mockup.html` — clickable, with a view toggle so the same conversation renders from both the **agent** side (Sarah Mitchell) and the **supplier** side (James Chen). Items live as inline cards in the chat; a collapsible summary header at the top of the panel acts as nav (click an item row → scroll-and-highlight that item in the stream). Same component renders both views — the chrome around it changes.

Same rules as ever: existing v1.22 tokens only, Lucide icons only, theme-vs-semantic split, no hardcoded shadows / radii / hex. WhatsApp-feel chat (sender-aligned bubbles, date dividers, subtle background pattern), but tokens stay ours.

This is a large prompt with a wide blast radius. Treat each numbered section as an atomic deliverable — if you have to defer one, defer it cleanly with a `TODO(p0008-§N)` marker rather than leaving it half-done.

## Why this matters

Today, `taxonomy.service.js:requestQuotes` writes a single `messages` row per supplier with `msg_status='sent'`, optionally fires a text-only Resend email gated by `QUOTE_REQUEST_EMAILS_ENABLED` (default off), and there's no consumer surface for the supplier — they get an email and have to reply by typing one. There's no item-level status, no transition history, no public reply URL, no way for either side to commit to a next action. This prompt builds that spine.

## Files in scope

Server:
- `server/src/services/taxonomy.service.js` — `requestQuotes` (token mint, status init, item rows)
- `server/src/services/email.service.js` — add `html` param + template helper
- `server/src/services/codelist.service.js` — register the new codelists (or wherever existing codelists live; mirror the pattern)
- `server/src/routes/brief.js` — **new** public route module for `/api/brief/:token` (read) and `/api/brief/:token/reply` (write)
- `server/src/services/notification.service.js` (or wherever the existing notify helper lives) — HTML template for outreach + reply notifications
- `server/migrations/` — new migration for `message_items` table, `messages.next_action_by`, `messages.token`, and indexes
- `server/src/index.js` (or main app file) — mount the new public route

Client:
- `client-angular/src/app/shared/components/messages-inbox/messages-inbox.component.ts` — conversation panel (summary header + chat stream + compose) and thread-row inbox refinements
- `client-angular/src/app/shared/components/message-item-card/` — **new** standalone item card that owns the state-aware action slot
- `client-angular/src/app/features/brief-public/` — **new** standalone consumer route at `/brief/:token`
- `client-angular/src/app/app.routes.ts` — register the public route, no auth guard
- `client-angular/src/app/core/services/codelist.service.ts` — register the new codelist keys (mirror existing pattern)
- `client-angular/src/styles.css` — only if shared chat-pattern tokens need a touch-up

Env:
- Flip `QUOTE_REQUEST_EMAILS_ENABLED=true` in the dev `.env` (and document it for prod).

## 1. Codelists

Five new codelists, all admin-editable like the existing ones. Names below are the column-keys; labels are user-facing.

### 1.1 `message_item_status` — per-item state (9 codes)

| code | label | semantic token | meaning |
|---|---|---|---|
| `brief_sent` | Brief Sent | `--color-waiting` | Agent has sent the item to the supplier. Supplier hasn't acted yet. |
| `holding` | Holding | `--color-waiting` | Supplier acknowledged: "received, need time." Carries `next_action_by`. |
| `quoted` | Quoted | `--color-quoted` | Supplier replied with a price (may equal or differ from reference). Agent action: Accept / Decline / Adjust. |
| `adjusted_by_supplier` | Adjusted | `--color-quoted` | Supplier changed the item (price / quantity / spec) and sent back. Agent action: Accept / Decline / Adjust. |
| `adjusted_by_agent` | Adjusted | `--color-waiting` | Agent changed the item and sent back. Supplier action: Accept / Decline / Adjust. |
| `accepted` | Accepted | `--color-action` | Both parties have agreed the item as-is, but no money has moved. Agent action: Pay / Decline / Adjust. Supplier action: (Pay inert) / Decline / Adjust. |
| `booked` | Booked | `--color-booked` | Paid (or "booked" — payment integration is post-MVP; for now this is set when the agent confirms commitment). Final state for the happy path. |
| `declined_by_supplier` | Declined | `--color-danger` (semantic) | Terminal. Carries a `decline_reason` code. |
| `declined_by_agent` | Cancelled | `--color-danger` (semantic) | Terminal. Carries a `decline_reason` code. |

Note: `adjusted_by_supplier` vs `adjusted_by_agent` are different codes because they trigger different action sets on the two views. Both render the same label "Adjusted" — the action row tells you whose turn it is.

### 1.2 `message_status` — per-thread aggregate (drives inbox filter rail)

Computed, not stored — it's the most-actionable item status across all items in the thread, by this priority:

1. Any item in `quoted` / `adjusted_by_supplier` / `accepted` (when agent view) → **Action**
2. Any item in `brief_sent` / `holding` / `adjusted_by_agent` → **Waiting**
3. Any item in `quoted` (when no Action and supplier view) → **Quoted**
4. All items in `booked` / declined → **Booked** (if any booked) or **Closed**

The inbox filter rail (`All / Action / Waiting / Quoted / Booked`) maps directly to this.

### 1.3 `decline_reason_pre_agreement` — before Accepted

Codelist used when declining a `quoted` / `adjusted_*` item. Codes:

- `dates_unavailable` — Dates don't work
- `item_unavailable` — Item not available
- `price_too_high` — Price too high (agent only)
- `spec_mismatch` — Doesn't meet requirements (agent only)
- `out_of_scope` — Outside our service area (supplier only)
- `other` — Other (free-text required)

### 1.4 `decline_reason_post_agreement` — after Accepted

Tighter list, sadder phrasing:

- `event_cancelled` — Event cancelled
- `item_no_longer_available` — Item no longer available
- `price_changed` — Price has changed (regret reason)
- `client_changed_mind` — Plans changed (agent only)
- `other` — Other (free-text required)

### 1.5 `quick_reply_templates` — chips above compose

Direction-aware. Two sub-lists keyed by `direction='agent_to_supplier'` vs `direction='supplier_to_agent'`. Each entry: `code`, `label` (chip text), `body` (full reply text), `direction`.

Seed minimum:

**Agent → supplier:** "Thanks!", "Can you confirm?", "We'll review and come back", "We're going with another option, thanks"

**Supplier → agent:** "Thanks, received", "Working on it — back to you {next_action_by}", "Confirmed as-is", "Need a bit more detail"

The `{next_action_by}` token in the body interpolates with whatever the user picked in the clock popover; if no clock value is set when the chip is tapped, the token resolves to "shortly". (Future: nicer relative formatting — "by Friday", "in 2 hours".)

## 2. Data model

### 2.1 New table: `message_items`

```sql
CREATE TABLE message_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  item_id         uuid REFERENCES items(id),                  -- nullable: AI-proposed items have no catalogue row
  name            text NOT NULL,
  description     text,
  price_ref       numeric(12,2),                              -- reference price at send time
  price_current   numeric(12,2),                              -- latest quoted/adjusted price
  unit            text,                                        -- "per night", "each", etc.
  status          text NOT NULL DEFAULT 'brief_sent',         -- references message_item_status codelist
  adjusted_by     text,                                        -- 'supplier' | 'agent' | null
  decline_reason  text,                                        -- references decline_reason_* codelists
  decline_note    text,                                        -- free text when reason='other'
  next_action_by  timestamptz,                                 -- per-item override of the message-level clock
  metadata        jsonb DEFAULT '{}'::jsonb,                  -- spec changes, attachments, etc.
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_items_message_id_idx ON message_items(message_id);
CREATE INDEX message_items_status_idx ON message_items(status);
```

### 2.2 New table: `message_item_events`

Append-only history per item. Drives the conversation stream's inline state-change rendering (collapsed by default — items "speak for themselves" via their current card state; events are available if a debug toggle is added later).

```sql
CREATE TABLE message_item_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_item_id uuid NOT NULL REFERENCES message_items(id) ON DELETE CASCADE,
  from_status     text,
  to_status       text NOT NULL,
  actor_type      text NOT NULL,                              -- 'agent' | 'supplier' | 'system'
  actor_id        uuid,                                        -- nullable for supplier (no user row yet)
  reason_code     text,                                        -- decline_reason code if applicable
  note            text,
  price_before    numeric(12,2),
  price_after     numeric(12,2),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_item_events_item_idx ON message_item_events(message_item_id);
```

### 2.3 Columns on `messages`

```sql
ALTER TABLE messages
  ADD COLUMN token            text UNIQUE,                    -- public access token, minted at send
  ADD COLUMN next_action_by   timestamptz,                    -- thread-level clock
  ADD COLUMN contact_name     text,                            -- supplier contact name shown in inbox
  ADD COLUMN ref_code         text;                            -- e.g. "WA-001" — short ref shown in subject
```

The token is `gen_random_uuid()::text` stripped of dashes — long enough to be unguessable, short enough to fit comfortably in a URL.

### 2.4 Migration ordering

1. Create the two new tables.
2. Add the columns on `messages`.
3. Backfill `token` for any existing `messages` rows (UPDATE ... SET token = ... WHERE token IS NULL).
4. Backfill `message_items` from the existing `items` JSON blob on `messages` (if that's where they currently live), or from `project_categories.items` — wherever item lists are sourced today. Each existing message gets one `message_items` row per item with `status='brief_sent'`.

## 3. `taxonomy.service.js:requestQuotes` rewrite

The current implementation writes one `messages` row per supplier with `msg_status='sent'` and (if enabled) sends a text email. Rewrite to:

1. Generate a `ref_code` for the **request** — `{CategoryInitials}-{nextSeq}` (e.g. `WA-001` for Walk-Around, sequence per project). Stored on the lead message, shared across all supplier rows in this request.
2. For each supplier:
   - Insert `messages` row with `token`, `ref_code`, `contact_name`, `next_action_by = null`, `msg_status` unchanged (deprecated — `message_status` is now computed from items).
   - Insert one `message_items` row per requirement, `status='brief_sent'`, copying name / description / price_ref / unit from the requirement.
   - Insert a `message_item_events` row per item: `from_status=null, to_status='brief_sent', actor_type='agent'`.
   - Fire the HTML outreach email (§5) with the supplier's unique `/brief/:token` URL.

The `requestQuotes` return shape should expose the message IDs and tokens so the cart can show "Sent to 3 suppliers — open thread" affordances after.

## 4. Conversation panel

Reference the mockup. Two parts inside the right column of the inbox (and inside the supplier brief page — same component):

### 4.1 Summary header (top, collapsible)

- Default state: collapsed, showing `{itemCount} items · {action-needed count}` and a chevron.
- Expanded: a tight list of item rows — image / name / current price / status pill / `next_action_by` chip (if set). Click a row → smooth-scroll the chat stream below to that item's most recent appearance and pulse-highlight it for ~1.2s.
- The collapsed/expanded preference persists per-thread in component state (no need to store server-side).

This is **nav only** — no actions live in the summary. Actions live on the item cards in the stream.

### 4.2 Chat stream

- Date dividers (small caps, `--theme-text` muted, centered, hairline above and below).
- Text bubbles — sender-aligned (yours right, theirs left). Maximum width ~70%. `--radius-card` with the corner nearest the sender's column slightly tighter. Background: `--theme-soft` for yours, `#fff` with `0.5px` border for theirs. Inline timestamp at bottom-right of each bubble in muted text.
- **Item cards inline** — same `MessageItemCardComponent` as the summary, but full-width inside the bubble lane, sender-aligned. The card carries the state-aware action slot (§4.4).
- Subtle background pattern: the same feTurbulence grain SVG used in Bold-mode hero, opacity ~0.04, fixed to the panel. Tokens stay ours — no WhatsApp green anywhere.

System messages (e.g. "Item adjusted from $X to $Y") are **not** rendered as separate stream entries. The item card's current state speaks for itself; the `message_item_events` table is for audit, not UI.

### 4.3 Compose

A flat strip at the foot of the panel. Left to right:

- **Paperclip** (Lucide `paperclip`) — attachments (defer the actual upload flow to a stub for now; the icon ships).
- **Clock** (Lucide `clock`) — opens a popover with a calendar (today selected by default) + a quick row of common offsets ("In 1 hour", "Tomorrow 9am", "Friday", "Next week"). Sets `next_action_by` on the message being composed. Once set, the clock icon shows a small dot and the chosen date is shown as a chip next to it. Clear with an x on the chip.
- **Quick-reply chips** — horizontally scrolling above the input, populated from `quick_reply_templates` filtered by direction. Tap a chip → fills the input with the template body; `{next_action_by}` interpolates if a clock value is set.
- **Input** — single-row textarea, grows to 4 lines max.
- **Send** (Lucide `send`) — `--theme-accent` filled button, only enabled when input has content OR a quick-reply chip was tapped OR an attachment is present.

### 4.4 Item card with state-aware action slot

The `MessageItemCardComponent` is a standalone component used in three places: the inbox summary header, the inbox conversation stream, and the supplier brief page. Props: `item: MessageItem`, `viewer: 'agent' | 'supplier'`, `compact: boolean`. Emits action events; parent wires them to the reply endpoint.

Card chrome: image left (or themed-tint emoji block if no image), then a column with name (bold), description (one line, truncated), price row (was → now if changed), status pill. Below: the **action slot** — a tight row of buttons whose set depends on `(status, viewer)`:

| status | agent view | supplier view |
|---|---|---|
| `brief_sent` | (no actions — waiting on supplier) | Accept · Decline · Adjust |
| `holding` | (no actions — waiting on supplier) | Quote · Decline · Adjust |
| `quoted` | Accept · Decline · Adjust | (no actions — waiting on agent) |
| `adjusted_by_supplier` | Accept · Decline · Adjust | (no actions — waiting on agent) |
| `adjusted_by_agent` | (no actions — waiting on supplier) | Accept · Decline · Adjust |
| `accepted` | Pay · Decline · Adjust | Pay (disabled, tooltip "Awaiting payment from agent") · Decline · Adjust |
| `booked` | (no actions — done) | (no actions — done) |
| `declined_*` | (no actions — terminal) | (no actions — terminal) |

Clicking **Accept** flips status to `accepted` (or to `booked` if already `accepted` and the viewer is the agent clicking Pay — that's the same button visually after Accept).

Clicking **Decline** opens a popover with the right reason codelist (pre/post agreement) — required pick, optional note.

Clicking **Adjust** opens an inline form on the card: name / description / price / unit — pre-filled with current values. On save, flips to `adjusted_by_{viewer}` and emits a transition event. The new values become `price_current` etc.; the old values are captured in the `message_item_events` row (`price_before` / `price_after`).

Clicking **Pay** (agent, when `accepted`) flips status to `booked`. (Stub for now — no real payment integration; the button is real, the action is real, the money flow is deferred.)

The action button cluster uses `--radius-pill` outlined buttons, calm — no big primary fills. Accept can carry `--theme-accent` text colour to draw the eye; the rest are neutral.

## 5. Public consumer view at `/brief/:token`

A new standalone Angular route, no auth guard, no shell chrome. The supplier opens this from the email and lands here.

Layout:
- Light header strip with the **agent's** org logo and name on the left, a small "Brief from {AgencyName}" eyebrow, and a clock icon on the right showing `next_action_by` if set.
- The conversation panel component, full-width — same summary header + chat stream + compose as the inbox.
- Footer: tiny "Powered by Ballpark" link.

The view is the conversation panel rendered with `viewer='supplier'`. The token gates access — the API endpoints validate the token against `messages.token` and return only the data for that thread.

No login. No account creation. The supplier interacts entirely through the token URL. Repeat visits (e.g. agent replied → notification email → click → same URL) deep-link straight to the latest activity.

## 6. Routes

### 6.1 Public

- `GET  /api/brief/:token` — returns the thread, its `message_items`, and the agent-side summary (org name, logo). 404 on invalid token.
- `POST /api/brief/:token/reply` — accepts `{ text?, item_actions?, next_action_by?, attachments? }`. `item_actions` is an array of `{ message_item_id, action: 'accept'|'decline'|'adjust'|'quote'|'pay', reason_code?, note?, name?, description?, price?, unit? }`. Writes a new reply row, updates each touched `message_items` row, appends to `message_item_events`, and (if any item flipped) fires the agent-side notification email (§7).
- `POST /api/brief/:token/holding` — convenience wrapper: writes a reply with `text` from the codelist body and flips every `brief_sent` / `quoted` item to `holding` with the picked `next_action_by`. Used by the "Working on it — back to you {next_action_by}" quick-reply chip.

### 6.2 Authenticated (agent side)

Whatever the existing inbox uses for thread reads stays; the reply endpoint accepts the same `item_actions` payload as the public one, just behind auth, with `actor_type='agent'`.

Status transitions must run on **every** entry point — the cart's `requestQuotes`, the public reply endpoint, the agent reply endpoint — through a single helper (`transitionItem({ itemId, toStatus, actor, reason, note, priceBefore, priceAfter })`) that writes both the `message_items` update and the `message_item_events` row in one transaction. Don't duplicate the transition logic across endpoints.

## 7. Email templates

Two templates, both HTML, both fall through `email.service.js`. Extend the service to accept `{ to, subject, text, html }` — `html` optional, `text` stays as the fallback. Resend supports both in the same call.

### 7.1 Outreach (sent from `requestQuotes`)

Subject: `[{ref_code}] {category_name} — brief from {agency_name}`

Body (HTML):
- Agency logo + name at the top.
- One-line opener: "{Agency} is putting together {project_name} on {event_date} and would like to hear from you about {category_name}."
- An items table — name / description / reference price / quantity. Same columns as the cart preview.
- Single CTA button: "View brief & reply" → `/brief/:token`.
- Plain-text fallback (`text`) with the same content as a numbered list.

### 7.2 Reply notification (fired on any state change from the other side)

Subject: `[{ref_code}] {supplier_or_agency_name} replied`

Body:
- One-line summary: "{Name} {sent a message / quoted N items / accepted N items / declined N items}."
- Up to 3 line items showing the most material changes (item name + old → new state).
- Single CTA: "View thread" → `/brief/:token` (supplier side) or the inbox URL (agent side).
- Plain-text fallback.

Both templates use inline CSS only (no external stylesheets), max-width 600px, system font stack, no images beyond the agency / supplier logo (use `<img src="…" width="48" height="48">` with a fallback alt).

Interactive email responses (AMP for Email — accept / decline directly from the inbox) are **out of scope** for p0008. Tracked in backlog as a paid-tier feature.

## 8. Inbox refinements (in scope here)

Building on p0006's list-row work, add three things:

1. **Contact name** — second line under the supplier name, muted, prefixed with the small Lucide `user` icon. Falls back to the supplier's primary contact if `messages.contact_name` is null.
2. **Ref-prefixed subject** — `Ref {ref_code} {subject}` (e.g. `Ref WA-001 The Walk-Through Wow Entrance Tunnel`). Bold-when-unread per p0006.
3. **Precise date + time** — small text under the time-ago, e.g. `Mon 26 May · 14:32`. Hover the time-ago to reveal the precise stamp; on the table view it replaces the column.

These three are surface-level — the thread-row template gains three small spans. No data migration needed beyond `messages.contact_name` + `messages.ref_code` (already added in §2.3).

## 9. The clock primitive

One field, one icon, one rule.

- Field: `messages.next_action_by` (thread-level) and `message_items.next_action_by` (per-item override).
- Icon: Lucide `clock`, used wherever a commitment is being made — compose strip, "Pay" button hover, post-agreement adjust form. Click → popover with calendar (today preselected) + quick offsets.
- Rule: if `now() > next_action_by` and the item/thread isn't terminal, it's **overdue**. Surface that:
  - **Inbox row:** the status badge gets a red dot suffix (`--color-danger`).
  - **Summary header:** the item row's `next_action_by` chip turns red.
  - **Conversation stream:** the chat bubble that set the clock gets a thin red left-border.

Due/overdue is computed at render time — no scheduled job needed for the MVP.

## 10. Env + flags

- Flip `QUOTE_REQUEST_EMAILS_ENABLED=true` in `.env.example` and the dev `.env`. Document for prod that this should be `true` post-DNS verification.
- Add `EMAIL_FROM` documentation if not present (`server/src/services/email.service.js` already references it; just make sure the env-example covers it).

## What NOT to do

- **No payment integration.** Pay is a status flip to `booked`. Stub.
- **No supplier accounts.** Token URL only. Resist any urge to add a "sign up to manage all your briefs" flow — that's a separate prompt.
- **No AMP for Email.** Plain HTML emails with a CTA back to the brief page. AMP is backlog.
- **No system messages in the stream.** The item card's current state is the source of truth. Events table is for audit only.
- **No new tokens.** Use existing v1.22 elevation tokens, `--theme-*`, `--color-*` semantic. No new hex anywhere.
- **No Tabler / Heroicons / etc.** Lucide via `lucide-angular` only.
- **No regression on p0006 / p0007.** The inbox thread-row card from p0006 stays; this prompt adds three small fields to it (§8), not a rebuild.

## Verify

1. **Codelists** — all five seed cleanly via the codelist service; admin CRUD works.
2. **`requestQuotes`** sending to 3 suppliers writes 3 `messages`, 3 × N `message_items`, 3 × N `message_item_events` (all `brief_sent`), and 3 tokens. 3 HTML emails fire (or 0 if env flag off — but it should be on by now).
3. **Agent inbox** — opens, threads render with logo / supplier name / contact / `Ref XX-NNN` subject / precise date. Selecting a thread shows summary header (collapsed) + chat stream + compose.
4. **Summary header** — expand, click an item row, stream scrolls and pulses the target card.
5. **Item card actions** — Accept on a `quoted` item flips to `accepted`, action slot recomputes to Pay/Decline/Adjust. Pay flips to `booked`. Decline opens reason popover; submitting writes the event row.
6. **Compose** — quick-reply chip fills input; clock popover sets a date; sending writes the reply, fires the supplier-side notification email with a link.
7. **Public route** — paste `/brief/:token` from a fresh outreach into an incognito window. Brief loads with no auth. Supplier-view actions (Accept / Decline / Adjust / Holding quick-reply with clock) all round-trip. Reply triggers agent-side notification email.
8. **Overdue** — set a `next_action_by` in the past on a test thread; row shows red dot in inbox, item chip turns red in summary, bubble border turns red in stream.
9. **Theme sweep** — Amber + Pink + Slate × Light + Bold: chat bubbles, item cards, action buttons all render cleanly; status pills stay semantic.
10. **No regressions** — Marketplace cart still sends, p0006 inbox card still scans cleanly, p0007 marketplace finalizes are intact.

When complete and verified, mark p0008 `Done` in `prompts/README.md`.
