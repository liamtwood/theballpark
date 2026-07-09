# Inbox (`/inbox`) — supplier conversations organised by project

One-pager. The messaging surface where agencies + suppliers exchange
messages, quotes, and decisions in the context of a specific project.
**Navigate-then-inline pattern:** project picker is the entry; clicking
a project lands on a scoped 2-column inbox with role-conditional item
navigation in the left rail and thread pane on the right. Structured
workflows (cost negotiation, item decisions) layered on top of chat.
No AI dependency — regex intent parsing + context-aware quick-reply
chips.

Reference designs:
- `screenshots/Screenshot 2026-06-24 150021.png` (early agent mockup — superseded by current navigate-then-inline pattern)
- `screenshots/Screenshot 2026-06-24 152859.png` (canonical scoped inbox — supplier project-scoped view with structured cost negotiation + chips)
- `screenshots/Screenshot 2026-06-24 153437.png` (canonical project picker — agent's entry surface)
- `prompts/inbox-v2-plan.md` (v1-era planning doc)
- `client-angular/src/app/features/messages/inbox-v2.schematic.md` (v1 schematic)

Pairs with: `PROJECTS.md` (every thread anchors to a project), `STORE.md`
(items + decisions referenced inline), `CODELISTS.md` (status pill +
chip presets driven by codelist meta), `MEDIA.md` (attachment uploads
via shared storage endpoint), `BALLPARK_ADMIN.md` (admin moderation view
deferred), `SHARED_SERVICES.md` (messaging endpoints + tables).

## What it is

**The async communication channel** between agencies and suppliers,
structured per-project per-item. Replaces email-thread chaos with
threaded conversations that surface project context inline + capture
structured workflow state (cost negotiation, decisions, status
transitions).

**Two-layer flow** (both roles, NO top-level `/inbox` route):

```
EXISTING ENTRY SURFACE  →  /inbox/:projectId  →  SCOPED 2-COLUMN INBOX:
                                                   Left:   project context card (counterparty inline) + items navigation (role-conditional)
                                                   Right:  thread pane (header + cost negotiation + messages + chips + compose)

Agent's entry surface:    project page → "Inbox" tab (existing v1 pattern, no new top-level)
Supplier's entry surface: Quoting page card click (existing supplier project list; add unread badge)
```

Both roles use the SAME scoped inbox. Differences are role-conditional data
scoping + tree-depth inside the scoped inbox (agent: Supplier → Item;
supplier: flat Items list).

## Why we needed it

- **v1 has email-thread chaos** — agencies + suppliers exchange decisions over email; no system record; no quote-context inline
- **Quote-building requires structured conversation** — pricing back-and-forth, scope clarifications, approval workflows
- **Items need decision audit trails** — `message_item_decisions` table exists; inbox is its UI consumer
- **Project context matters per message** — project budget, status, related items help both sides communicate efficiently
- **Future: 06f checkout** needs structured comms — inbox becomes the natural handoff surface

## Who can use it

| Role | Sees in inbox |
|---|---|
| Agency admin/member | Project picker shows projects their org owns. Scoped inbox shows all suppliers' items in that project |
| Supplier admin/member | Project picker shows agency projects they're in. Scoped inbox shows ONLY their own items in that project |
| `ballpark_admin` | **No cross-org admin view at all.** Inbox is participant-scoped by architectural decision (privacy + simplicity). Ballpark admin sees only conversations on projects their own org owns/participates in, same as any other user. For rare support cases requiring cross-org visibility, use Supabase dashboard with proper audit trail. |

## Entry surfaces (no new top-level inbox route)

**Both roles enter via EXISTING project context — no new `/inbox` top-level surface.**

| Role | Entry path | Existing v1 pattern? |
|---|---|---|
| Agent | Project detail page → "Inbox" tab → navigates to `/inbox/:projectId` | ✓ tab pattern exists in v1; carries forward |
| Supplier | Quoting page → click project card → navigates to `/inbox/:projectId` | ✓ Quoting page exists; add unread badge on cards |

**Per-card unread indicator** (supplier Quoting page enhancement):
- Add unread count badge to project cards on Quoting page when inbox has unread messages for that project
- Click anywhere on card navigates to `/inbox/:projectId`

**Why no standalone `/inbox` top-level:**
- Both roles already have natural project-context entry points
- Avoids building a new picker surface that duplicates existing patterns
- Project is the meaningful boundary — entering inbox without a project doesn't match the workflow
- Future inbox-global view (e.g. unified "all my unread") can be considered later if real demand surfaces

Reference: original mockup `screenshots/Screenshot 2026-06-24 153437.png` shows a project-picker card pattern; current decision is to embed that pattern in the EXISTING surfaces (agent project tab; supplier Quoting page) rather than building a new top-level route.

## Layout — scoped inbox (`/inbox/:projectId`)

**Same 2-column layout for both roles.** Role-conditional data scoping + tree depth in left column.

```
┌─────────────────────────┬────────────────────────────────────────┐
│ ← Back                  │ Retail Pop-Up Structure                │
│                         │ Original Cost £25,000  Revised £25,750 │
│ Retail Pop-Up Launch    │                                        │
│ 📅 15 Jun 2026          │ ⚠ Revision Reason:                     │
│ 📍 London, UK           │   Reduced transport costs as requested │
│ Creative Agency Ltd     │                                        │
│ (counterparty changes   │ ┌────────────────────────┐            │
│  per item — see below)  │ │ Can you deliver this   │            │
│                         │ │ for £25,000?           │            │
│ PROJECT ITEMS           │ │ 2 days ago             │            │
│                         │ └────────────────────────┘            │
│ ▶ Studio Build Co (3)   │                                        │
│   Retail Pop-Up Struct  │            ┌────────────────────────┐ │
│     [Negotiating Costs] │            │ We can achieve £26,500 │ │
│     ← selected          │            │ due to install reqs.   │ │
│   Branded Arch          │            │ 2 days ago             │ │
│     [Signed]            │            └────────────────────────┘ │
│ ▶ AV Solutions (1)      │                                        │
│   Sound System Package  │ ┌────────────────────────┐            │
│     [Payment Proc.]     │ │ Can you reduce         │            │
│                         │ │ transport costs?       │            │
│ (agent: 2-level tree)   │ │ 1 day ago              │            │
│ (supplier: 1-level list)│ └────────────────────────┘            │
│                         │                                        │
│                         │            ┌────────────────────────┐ │
│                         │            │ Updated quote £25,750. │ │
│                         │            │ 1 day ago              │ │
│                         │            └────────────────────────┘ │
│                         │                                        │
│                         │ [Accept Cost][Suggest Cost][Request Info]│
│                         │                                        │
│                         │ 📎 Type your message...      [→ Send] │
└─────────────────────────┴────────────────────────────────────────┘
```

### Left column — project context + supplier cards

**Project context card (top):**
- Back link to entry surface (project page for agent, Quoting page for supplier)
- Project name (large)
- Project metadata: date, location, attendees

**Supplier cards (below context card):**

- **Agent view:** 1 card per supplier in the project. Each card = a thread. Card shows: supplier name, items count, status summary (aggregate or most-pressing), unread badge, latest message preview
- **Supplier view:** 1 card showing the agency (the supplier sees one counterparty per project). Same card pattern

**Click supplier card → opens THAT supplier's thread in the right column.** Single thread per (project, supplier) pair (Model F).

**Selection state** persists per-browser via localStorage (last-viewed thread).

### Right column — thread pane (with items panel)

**Same for both roles.** Single chronological thread + items panel for item-scoped actions.

**Top of thread pane:**
- Supplier name (large, primary) — or agency name for supplier view
- Project name (subtitle)
- Status pill (could be aggregate — most-pressing status across this supplier's items in the project; OR omit and rely on per-item pills in items panel)

**Items panel (within thread context — sub-section of right column or sidebar):**
- List of items from this supplier in this project
- Each item: name + status pill + (in INBOX-03) action chips (Accept Cost, Suggest New Cost, etc.)
- Click item → SELECTS it as context for next action (does NOT open a new thread)
- Selected item highlighted

**Thread (chronological):**
- Free-form messages from agent + supplier
- System events from item actions: "Agent accepted cost for Light 3 (£500)", "Supplier updated quote for Platform to £1,100"
- Messages may be tagged to a specific item or category (optional metadata)
- All in ONE stream chronologically (decisions interleave naturally with conversation)

**Compose (sticky at bottom — INBOX-02):**
- 📎 attachment + text input + send button
- Selected item context appears as a chip near input (e.g. "Replying about: Podium") — can be cleared for general message

### Right column — thread pane

**Same for both roles.** Structured workflow + chat in one surface.

**Thread header** (top):
- Item name (large, primary)
- **Structured cost panel** (when item is in negotiation):
  - "Original Cost £X" + "Revised Cost £Y" (when revision in progress)
  - Side-by-side or stacked depending on width
- **Revision reason banner** (yellow/warm tint, when applicable):
  - "Revision Reason: [reason text]"
- Status pill (top-right)

**Message thread** (chronological, scrollable):
- **Outgoing** (current user): right-aligned, gradient bubble (pink → green Ballpark signature)
- **Incoming** (other party): left-aligned, soft pastel/white bubble
- Sender label + timestamp inline
- **Merged with `message_item_decisions`** chronologically — system events (e.g. "Supplier updated quote to £25,750", "Agency approved item") render as compact event lines distinct from chat bubbles

**Context-aware quick-reply chips** (above compose):
- Chip set CHANGES based on item's current workflow state
- Example for `Negotiating Costs` state:
  - "Accept Cost" (green) — moves item toward Signed
  - "Suggest New Cost" (yellow) — keeps in negotiation, prompts cost-edit dialog
  - "Request Information" (neutral) — neutral chip; sends a templated info request
- Example for `Signed` state:
  - "Confirm Payment Schedule" / "Schedule Delivery" / etc.
- Click chip → either auto-sends a templated message OR opens structured action (cost-edit, schedule dialog)
- **NOT auto-detected from typed text** — chips are explicit user actions tied to item state

**Compose** (sticky at bottom):
- 📎 Attachment icon — file upload via shared `/api/storage/upload` (same as MEDIA picker)
- Multi-line text input (auto-grow)
- Send button (right, gradient pill with "Send" label) — disabled when input empty

## Data model — reused, NO schema changes

| Table | What it stores | Already exists? |
|---|---|---|
| `messages` | Message body, sender, timestamp, conversation context | ✓ |
| `message_items` | Junction: which message references which item | ✓ |
| `message_item_decisions` | Audit trail of decisions (cost revisions, approvals, signatures, payment transitions) | ✓ |
| `users`, `orgs`, `items`, `projects` | Identity + entity references | ✓ |

**No new tables, no new columns.** Inbox is purely UI + service composition over existing data.

Structured cost negotiation uses existing `message_item_decisions` rows — each cost revision creates a decision entry with the new amount + reason. Thread header renders the current state by querying the latest unresolved decision.

## Status pill values (locked to mockups)

Driven by `message_status` codelist (or new `item_workflow_status` codelist if cleaner separation needed):

| Status | Colour | Meaning |
|---|---|---|
| `negotiating_costs` | warm/amber | Cost negotiation in progress; not yet agreed |
| `signed` | green | Cost agreed; SOW signed; ready for delivery |
| `payment_processing` | purple | Invoice raised; awaiting payment |
| `live` | green (different shade) | Delivered; live in project |
| (other values per actual workflow) | per codelist meta | |

These map to + extend the original v1-era Negotiating / SOW / Payment / Live framing.

**Transitions** are captured as `message_item_decisions` entries. Chip clicks trigger transition + chat message + decision entry atomically.

## Locked architectural decisions

1. **Navigate-then-inline pattern.** Project entry = navigate (`/inbox` → `/inbox/:projectId`). Items within project = inline tree. Big context shifts navigate; in-scope navigation inline.
2. **Unified 2-column scoped inbox for both roles.** Same shell, same components; role-conditional data scoping + tree depth (agent: 2-level Supplier → Item; supplier: 1-level flat Items list).
3. **Project picker as entry** (`/inbox`) — card list with unread badges + previews; click navigates.
4. **Threads per (project, supplier, category) — items tagged within a thread** (Liam QC 2026-06-24, refined during INBOX-04). Threading unit is (project, supplier, category) — matches v1's stored shape exactly, no schema change. When a supplier covers only one category in a project, the single-category collapse rule (see §Layout) hides the category level from the rail and the header — the user experiences it as one supplier-scoped thread. When the supplier covers 2+ categories, each category is its own thread. Within a thread, messages can be **untagged** (general — visible when no item is selected) or **tagged to a specific item** via `message_items` rows (see decision #10 — no schema change). Selecting an item filters the thread to that item's messages + untagged broadcasts, and arms the item-specific action chips (Accept / Suggest / Decline). Item-tagged action messages carry the format locked in decision #15.
5. **Counterparty derived from item context.** Agent's project card shows supplier name (changes per selected item); supplier's card shows agency name (constant).
6. **Reuse `<app-catalogue-layout>` shell** — 4th consumer of the proven 3-region primitive (left + main + optional right). RP-06 rider applies — entity passed explicitly via input, no route-positional inference.
7. **Status pill via codelist meta.** Values drive from codelist; colour/icon from meta; no hardcoded enums.
8. **No AI in v1.** Regex/template-based quick-reply chips. Chip set CONTEXT-AWARE (driven by item's current status), not LLM-detected.
9. **Structured cost negotiation = first-class pattern in thread.** Cost fields + revision reason render in thread header when item is in negotiation; chat captures human discussion around the structured state.
10. **No schema changes.** Existing `messages` / `message_items` / `message_item_decisions` tables sufficient. Cost revisions, signatures, payment transitions all logged as `message_item_decisions` rows.
    - **UNIFY-01 addendum (2026-07-08 — exception to #10).** The "no schema change" bet held through INBOX-04 but broke at CART-01: the same conceptual line lived in `project_items` (cart: qty/install/base_price) AND `message_items` (brief: price_ref/current/status), read by two different formulas → the inbox rendered £/head where the Final Quote rendered £/head × qty + install (£105 vs £17,325). Two tables for one line always drift. `pV2-UNIFY-01` merges them: **`project_items` is now the single line-state table** — it gained `status` / `price_ref` / `price_current` / `decline_reason`; **`message_items` is demoted to a stripped tag join** (`message_id + project_item_id`, plus the trigger-stamped audit columns) meaning "this message references these lines"; `message_item_events` + `message_item_decisions` repoint their FK from `message_item_id` → `project_item_id`. The inbox reader sources qty/install/price from `project_items` via the ONE shared formula (`services/line-total.util.js`), so the four surfaces (Cart / Project Quote / Final Quote / Inbox) can't drift. Dev-mode merge — negotiation graph wiped, no backfill. The per-item tag/filter behaviour of §4 is unchanged; only the reader source flipped.
11. **Optimistic UI on send** — message appears immediately; revert + toast on failure (matches MEDIA cart pattern).
12. **Tree state persists per-browser** (expanded suppliers, last-viewed item) via localStorage.
13. **Attachments via shared `/api/storage/upload`** — same bucket + auth as MEDIA picker.
14. **Inbox is participant-scoped — no admin override.** Even `ballpark_admin` only sees conversations on projects their org participates in. Privacy + simplicity decision. Support cases needing cross-org visibility use Supabase dashboard with audit trail, NOT a UI surface.
15. **Decisions are messages — the thread is the audit trail (LOCKED, Liam QC 2026-06-29, pV2-INBOX-01 ship).** Every Accept / Suggest New Cost / Decline action writes an attributed chat bubble into the thread, not a silent status change and not a side-bar Activity log. Format: `{item} {original £} {action} {new £ if applicable} by {actor name}` (e.g. `DJ Booth LARGE £5,000 New Cost Suggested £5,001 by Hugh Seller`). Two non-negotiables:
    - **Attribution is to the human actor, not the org.** Hugh Seller, not Studio Build Co. Once a counterparty has multiple staff (account managers, producers, sales reps tag-teaming a thread), the *person* is the audit fact. Org-only attribution loses the dispute-resolution evidence.
    - **The visibility IS the point.** Do not optimise into silent status changes or move into a separate Activity tab — the decision living next to the human conversation that produced it is what makes the thread auditable without anyone opening a log. If a future prompt proposes "let's clean this up and just show a status indicator", refer here and push back.

    Mechanism: chip handler writes the chat bubble + the `message_item_decisions` row in the same transaction. The bubble's sender label carries the actor (rendered chrome), and the bubble TEXT also embeds the actor name + values so the audit fact survives any future rendering changes.

## Risk patterns

- **RP-INB1 — message ownership leakage.** Server must scope every query: agency sees messages for projects their org owns; supplier sees messages for their items only. Never trust client-supplied filters.
- **RP-INB2 — attachment URL exposure.** Uploaded attachments use shared bucket; URLs must be access-controlled (signed URLs OR scoped by membership) so a leaked URL doesn't grant cross-org file access.
- **RP-INB3 — chip-triggered actions need confirmation gates.** "Accept Cost" / "Sign SOW" / payment-related chips affect real workflow state. Must NOT execute on accidental tap; require explicit confirmation (toast + undo OR modal) per RP-08-equivalent rule.
- **RP-INB4 — tree-rail performance at scale.** Lots of items per project could render slowly. Lazy-load tree branches on expand; paginate after N items per supplier. Defer if Ballpark scale stays modest.
- **RP-INB5 — RP-06 rider applies.** `<app-catalogue-layout>` 4th consumer; tree state must not infer from positional route params. Pass entity explicitly via input (lesson from v2.25e marketplace store fix).
- **RP-INB6 — cost negotiation state stale.** ~~Thread header reads latest `message_item_decisions` row to determine cost state. If two suppliers edit simultaneously OR async race conditions, state could mislead.~~ **CLOSED by pV2-UNIFY-01 (2026-07-08).** The dual-table drift that made this a live risk is gone — negotiation state (`status` / `price_current`) lives on the single `project_items` line, read by one formula. There is no second representation to fall out of sync. (A same-line concurrent-edit race is now a plain optimistic-lock question on one row, not a cross-table staleness class.)
- **RP-04 open — hardcoded status enums in `inbox-project.component.ts`.** `TERMINAL_STATUSES` (line 568) + `STATUS_VIEW` (line 572) are inline constants. Move to codelist meta lookup (matches how status pills already resolve). Not blocking but flagged by 2026-06-29 audit.
- **RP-05 open — component-local `.bp-*` classes.** 9 `.bp-*` classes defined in `inbox-project.component.ts` styles (lines 212–339): `.bp-item--selected`, `.bp-act*`, `.bp-bubble*`, `.bp-spill*`, `.bp-send-btn`. Should move to `styles.css` (or `inbox-shared.css` if scope-worthy). `check-style-guards.js` was allowlisted for this file but the classes need extraction on next touch per RP-05 shrink-only rule.
- **Behemoth ALARM** — `inbox-project.component.ts` shipped at 600 lines (threshold 400). Extract on next touch: thread pane, action-chip bar, and compose form are natural children. Flagged 2026-06-29.

## Build order — 4 phased ships

| # | Ship | Scope |
|---|---|---|
| 1 | **pV2-INBOX-01 — foundation (read-only display)** | Project picker (`/inbox`); scoped 2-column inbox (`/inbox/:projectId`); project context card + items navigation (role-conditional); thread pane with header + cost negotiation display + messages + decisions audit; status pills via codelist. **NO compose, NO chips yet** — read-only confirms display + data scoping work |
| 2 | **pV2-INBOX-02 — compose + send + attachments** | Compose form; send endpoint; attachments via shared upload; optimistic UI; read receipts; tree unread badge updates on read |
| 3 | **pV2-INBOX-03 — context-aware chips + structured workflow actions** | Chip primitives + chip-set driven by item state; chip click triggers templated message OR opens structured-action dialog (cost edit, schedule, sign, etc.); decision audit entries written on transitions; confirmation gates per RP-INB3 |
| 4 | **pV2-INBOX-04 — polish** | Resize splitter (left-column width); advanced filters (status, supplier, item); search across messages; deep-link enhancements; mobile responsive refinements |

## Open questions before INBOX-01 spec locks

1. **Status pill value set** — locked to Negotiating Costs / Signed / Payment Processing per mockup. Add: Draft, Live, possibly Cancelled? Codelist seed call.
2. **Project picker also accessible from project detail page?** — e.g. project page has "Open Inbox" button that navigates to `/inbox/:projectId` directly. Probably yes (good UX), no extra work
3. **Cost negotiation UI in INBOX-01 vs INBOX-03?** — display (read-only) in 01, edit/transitions in 03. My lean: yes split, lets 01 ship faster
4. **Attachment file types** — image-only OR broader (PDFs, docs)? Quotes often PDFs. Lean: broader
5. **Empty states** — empty project picker, empty thread, no items yet. Standard v2 empty-state pattern
6. **Cross-org ballpark_admin view** — DEFERRED to future inbox-admin arc; v1 ships per-org only

## Audit reference

Empty until pV2-INBOX-01 first slice ships.

## Version history

### Summary — skimmable status

| Version | Date | What changed (1-line) | Ship | QC Done? | Audit Done? |
|---|---|---|---|---|---|
| v1-era | 2026-Q1 | v1 inbox-v2 strangler-fig planning (p0037/p0038); superseded by fresh v2 build | v1-era | — | — |
| target | TBD | **pV2-INBOX-01** — foundation (project picker + scoped 2-col inbox, read-only) | — | — | — |
| target | TBD | **pV2-INBOX-02** — compose + send + attachments | — | — | — |
| target | TBD | **pV2-INBOX-03** — context-aware chips + structured workflow actions | — | — | — |
| target | TBD | **pV2-INBOX-04** — polish (resize, filters, search) | — | — | — |
| target | future | **pV2-INBOX-ADMIN** — cross-org ballpark_admin moderation view | — | — | — |

### Deferred — items pushed to later ships

| Item | Why | Lands in |
|---|---|---|
| ~~Cross-org ballpark_admin view~~ | **Explicit decision (Liam 2026-06-24): inbox is participant-scoped; no admin override. Not a deferral — an architectural call. Future support cases use Supabase dashboard with audit trail.** | not building |
| AI-suggested responses (vs regex chips) | Out of scope; LLM dependency adds cost + complexity | future v2 of intent system |
| Real-time updates (websockets/SSE) | Polling sufficient for v1 | future |
| In-app notifications (beyond email) | Email-first for v1 | future |
| Mentions (@user, @item) | Add when team conversations grow | future |
| Reactions / emoji | Not currently needed for B2B context | future |
| Thread archive / mute | Volume-driven; defer until users ask | future |
| Inline expand at project picker level | Picker stays navigate-only; defer if users complain about page-nav friction | future polish if requested |

## When to update this doc

- New layout layer added → update Layout sections
- New status workflow state added → update Status pill values + cross-ref CODELISTS.md
- New structured workflow pattern (beyond cost negotiation) → update Thread pane section + Locked decisions
- Schema changes → update Data model
- New risk pattern surfaces → log under Risk patterns
- Build slice ships → update Version history

## Pairs with

- `docs/PROJECTS.md` — every thread anchors to a project; project context surfaces in left-column card
- `docs/STORE.md` — items referenced as conversation atoms; decisions logged in `message_item_decisions`
- `docs/CODELISTS.md` — status pill + chip presets driven by codelist data
- `docs/MEDIA.md` — attachments use shared `/api/storage/upload`; same bucket/auth pattern
- `docs/BALLPARK_ADMIN.md` — admin view deferred; would mirror admin moderation pattern when ready
- `docs/SHARED_SERVICES.md` — messaging endpoints + tables in shared-services inventory
- `docs/MARKETPLACE.md` — `<app-catalogue-layout>` shell reused as 4th consumer (RP-06 rider applies)
- v1 references: `client-angular/src/app/features/messages/inbox-v2.component.ts`, `prompts/inbox-v2-plan.md`
