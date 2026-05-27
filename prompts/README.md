# prompts/

Design and styling prompts for Claude Code, with their visual references.

## How this works

Each piece of design work lives here as an indexed **pair**:

- `pNNNN-<slug>-prompt.md` — the written spec: what to change, which files, which tokens, how to verify.
- `pNNNN-<slug>-mockup.html` — a standalone visual reference. Self-contained; opens in any browser.

The `pNNNN` prefix (zero-padded, e.g. `p0001`) gives each task a stable ID and keeps the folder sorted in order. Both files in a pair share the same prefix and slug.

When picking up a task, read the `-prompt.md` and open the matching `-mockup.html` so you have both the spec and the picture.

## Conventions

- Prompts reference real file paths and the v1.22 elevation tokens in `client-angular/src/styles.css`. Use existing tokens — never hardcode shadows, radii, or hex colours, never invent new tokens.
- Prompts are styling/layout scoped unless they say otherwise — don't change data flow or business logic.
- Theme colours (`--theme-*`) recolour with the admin preset; semantic colours (`--color-action/waiting/quoted/booked`, success/danger) do not.
- Icons are Lucide only, via `lucide-angular` — never Tabler or any other set.
- **Never edit a prompt once written.** To change or fix something, create a new numbered prompt that supersedes it. A prompt always means one fixed thing.
- A prompt usually pairs with its own `-mockup.html`, but a follow-up/fix prompt may instead reference an earlier mockup as its target (note that in the prompt and the Index row).

## Index

| ID | Status | Work |
|----|--------|------|
| p0001 | Done | Search-panel standardisation across Marketplace + Messages, and the Messages styling pass (panel containment, sticky headers, shared list-row card, elevation-token migration). |
| p0002 | Done | Styling fixes after p0001's first pass — white search panel, stray container removed, panel-header divider alignment, header icons de-circled, active category circle. Prompt only; uses the p0001 mockup as its target. |
| p0003 | Done | Bold hero mode + real tabs — new `[data-mode="bold"]` (themed accent hero with code-generated orbs + grain), project tabs restyled as real folder tabs with a light contrast-colour active tab, new `--theme-contrast` token per preset. |
| p0004 | Done | Marketplace round-3 fixes — kill the apparent pink wrapper around the cat + search panels (browse-strip horizontal inset / gutter issue), and remove the ghost hairline at the bottom of the category-circles panel. Prompt only; uses the p0001 mockup as its target. |
| p0005 | Done | Remove the Plan tab without regression — AI matching and per-category brief editing are already wired through the Marketplace, so this is navigation cleanup only: remove the tabs entry, redirect `/plan` + `/brief` to `/marketplace`, repoint the Overview BRIEF card, delete `tabs/brief/`. Prompt only. |
| p0006 | Done | Inbox simplification — reply-only surface (email-launching belongs to the cart). New list-mode thread card (logo + supplier + bold-when-unread subject + status badge + read dot), same treatment for card and table views, calm empty state pointing back to the cart. |
| p0007 | Ready | Marketplace finalize — drop the ✉ envelope from item cards (email lives in the cart now), confirm panel headers stay calm (no bold-fill experiment shipped), verify per-category brief editing in the marketplace context panel post-Plan-removal, sweep all five theme presets in Light + Bold for contrast issues, ensure inbox category circles + quick actions match the marketplace. Prompt only. |
| p0008 | Done | Supplier consumer view + inbox conversation pattern — chat-style conversation panel (items inline as cards + summary index at top + chat bubbles below + compose at foot), per-item action buttons (Accept / Decline / Adjust → Pay / Decline / Adjust post-agreement), 9-status codelist with transition table (incl. Holding), decline-reason codelists (pre + post), quick-reply chips, universal clock primitive for `next_action_by` (drives due/overdue), public `/brief/:token` route, HTML notification email template, light-structured reply endpoint, inbox refinements (contact name, ref-subject, date/time), enable outreach emails. Polish TODOs in-code: §4.1 collapsible summary header, §4.3 quick-reply chips + clock popover + paperclip, §4.2 chat-bubble alignment polish + grain pattern. |

Statuses: **Draft** (still being written) · **Ready** (ready to implement) · **Done** (implemented).

## "Do the next one"

When asked to do the next prompt:

1. Open this README and find the **lowest-numbered entry not marked `Done`**.
2. Read its `pNNNN-<slug>-prompt.md` and open the matching `pNNNN-<slug>-mockup.html`.
3. Implement it.
4. Change that entry's status to **`Done`** in the table above.

This is how the queue stays correct across sessions — the README is the single source of truth for what's done, not memory.

## Going forward

New design work follows the same pattern: take the next `pNNNN` index, drop a `pNNNN-<slug>-prompt.md` and its `pNNNN-<slug>-mockup.html` in here as a pair, and add a row to the **Index** table with status `Ready`.
