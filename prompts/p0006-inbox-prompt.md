# CC Prompt — p0006 — Inbox simplification

The Inbox is now reply-only. Email outreach launches from the **cart** in the Marketplace area; the Inbox is purely where supplier replies arrive. No launchpad, no pre-send cards.

Three jobs:

1. **Strip any "Ready to Send" / pre-outreach concept** from the Inbox if it exists. The Inbox is thread list + conversation panel + a calm empty state. That's it.
2. **Restyle the list-mode thread card** with the new shape (logo + supplier + subject + status + read/unread).
3. **Rebuild the empty state** so it points the user back to the cart.

Mockup: `p0006-inbox-mockup.html`. Tokens, icons (Lucide), elevation system — all per the established conventions.

## Files in scope

- `client-angular/src/app/shared/components/messages-inbox/messages-inbox.component.ts` — the inbox component (template + styles + empty state)
- `client-angular/src/styles.css` — only if shared list-row tokens need a touch-up

## Changes

### 1. List-mode thread card

Threads stay grouped per **(supplier × category)** — one thread per email sent — but each row visually leads with the supplier:

- **Leading:** supplier logo, 40px rounded square, `--radius-button`. Use the supplier's uploaded logo asset if present; fall back to initials in a themed-tint square only if no asset.
- **Top row:** supplier name (bold, primary text) on the left, time on the right (`1h`, `4h`, `1d`).
- **Subject line** (second row): the email subject from the thread — bold weight when unread, regular when read. This is the only read-state indicator on the text; no extra "unread" label needed.
- **Meta row:** semantic status badge (`Action` / `Waiting` / `Quoted` / `Booked`) + category name in muted text.
- **Trailing (unread only):** a small `--theme-accent` dot.

Card chrome: flat `0.5px` border, `--radius-button`, hover lifts to `--shadow-xs` and intensifies the border. Selected row: `--theme-soft` background + `--theme-accent` border. Unread rows carry a subtle `#faf6f7` tint background (or skip — bold subject alone may be enough; check both and pick the calmer one).

Drop the existing avatar-initials-only treatment, the preview snippet, and the duplicate "supplier name in meta" — the supplier name is now the top-row primary. Less metadata per row, more scannable per row.

### 2. Empty state

When `filteredThreads().length === 0` and there's no `searchTerm`, show a quiet empty state in the centre of the list panel:

- A `--theme-soft` filled circle, ~56px, with a `--theme-accent` inbox icon.
- Heading (serif, 18px): "No replies yet"
- Subline (13px, secondary text): "Emails you send from your cart will land here as supplier replies arrive."
- Primary CTA button: `Go to cart` — `--theme-accent` filled, opens the cart drawer (or navigates to the Marketplace tab if the cart drawer isn't accessible from the Inbox tab).

Keep the existing search-result empty state (`No threads match "{searchTerm}"`) — that's separate.

### 3. Card view + table view

The user-facing list mode is the priority. Apply the same logo-first, subject-bold-when-unread rule to the **card** and **table** views as well so the three views read consistently. Specifically:

- **Card view:** larger version of the same card — 48px logo, supplier name + time on top, subject below (bold when unread), meta row with badge + category. No preview snippet.
- **Table view:** columns become `Supplier · Subject · Status · Category · Time`. Subject text bold when unread. Drop the existing preview-text column.

### 4. Conversation panel

No changes to the conversation panel structure beyond what's already styled — it stays the right column when a thread is selected. Confirm it still works with the new card selection (`.selected` state on the thread card).

## What NOT to do

- Do not add a "Ready to send" section, launchpad cards, or any pre-outreach UI to the Inbox. Email-launching is the cart's job.
- Do not duplicate cart functionality (item lists, send-brief buttons, supplier groupings of unsent items) here.

## Verify

- Three list views render cleanly with the new card shape; subject is bold on unread rows; selected row state is obvious.
- Empty state appears when there are no threads; `Go to cart` CTA opens the cart drawer (or navigates to Marketplace).
- Status badges use the existing semantic tokens (`--color-action/waiting/quoted/booked`), unchanged.
- Theme switches Amber ↔ Pink ↔ Ocean — accents recolour, status badges stay put.

When complete, mark p0006 `Done` in `prompts/README.md`.
