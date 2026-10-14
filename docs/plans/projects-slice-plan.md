# Projects slice — build plan (PORT onto the rebuilt schema)

**Status:** DRAFT for Liam QC (2026-10-14). Chat authored, CC builds.
**Approach:** PORT the existing v2 app code onto the v2dev rebuilt schema — **not a rewrite** —
staged so Liam QCs after each stage. v2dev currently has **none** of the project tables
(greenfield on the DB; the app code already exists on dev).

**Source of truth for table shapes = `DATA-MODEL-REDESIGN.md §Projects` (LOCKED).** This doc
is the *staging + port mapping + QC checkpoints*, not the column spec — build each table from
the locked spec, column-by-column ([[project_rebuild_plan_is_ssot]] discipline).

---

## The key re-align — FREEZE + OVERLAY supersedes UNIFY-01

The biggest difference from the current dev code: the rebuild **re-splits** UNIFY-01's single
merged line-state table into a **freeze + overlay** model (DATA-MODEL-REDESIGN §Line cluster):

- **`project_items`** = a **FROZEN faithful clone** of the ask at add — immune to later
  catalogue edits; `item_id` is provenance only, never the source of truth for the ask.
- **`project_item_quotes`** = a **sparse OVERLAY** the supplier writes — every definitional
  field, held NULL unless they change it; the populated fields ARE the changelog.
- **Read** `COALESCE(quote, project_items)` for the current agreed form.
- **Price / status HISTORY** → `message_events` (append-only), not columns on the line.

So the estimate + inbox code that reads one unified line-state must move to
`COALESCE(frozen, overlay)` + events. **This is the spine of S2/S3 and the single biggest
rework in the port** — everywhere else is closer to a ref swap.

---

## The four stages (QC after each)

| Stage | Build (tables) | Port (app) | Liam QCs |
|---|---|---|---|
| **S1 Create** | `projects`, `project_settings`, `project_categories` | `projects-new.component` (brief→project), detail hero (FR-00240) | Create a project from a brief; see it |
| **S2 Estimate** | `project_items` (+ `project_item_quotes` table), line cluster | `project-estimate.component` (CART-01), line-pricing SSOT | "Show me included" — items + running ballpark total |
| **S3 Inbox** | `project_providers`, `messages`, `message_reads`, `message_relations`, `message_events` | `inbox-project.component`, `inbox.service`, `project-outreach.store` | Message suppliers, negotiate, accept/decline |
| **S4 SOW** | `project_documents` | SOW/quote document flow | Statement of Work from agreed items |

### S1 — Create → QC
- **Tables:** `projects` (base 66→~24, LOCKED), `project_settings` (null = inherit rates via
  `COALESCE` org default), `project_categories` (the structured brief — the AI parse writes it
  at create; it's *displayed* in S2).
- **Port:** the new-project flow (`projects-new.component`) + the detail hero (FR-00240:
  client eyebrow / project title / event-summary subtitle). `client_name` on `projects`.
- **Design call (Liam):** the create flow keeps brief→loading→project, but **drop the leftover
  "building your project" Figma section** (deck slide 3). Otherwise mostly settled.

### S2 — Estimate ("show me included") → QC
- **Tables:** `project_items` (FROZEN ask; recursive `parent_id`; `flat_total`) **+ build the
  `project_item_quotes` overlay table here** (same cluster — populated in S3, but don't leave
  it out). 
- **Port:** `project-estimate.component` (the CART-01 merged view) — its STRUCTURE ports, but
  its DATA source becomes `COALESCE(quote, project_items)`, not a unified line-state. The
  **line-pricing SSOT** reattaches as the module ([[project_line_pricing_ssot]]) with
  `lineTotalSql` re-pointed to the overlay — **keep the golden contract test green.**
- **Settled:** single project-level margin (`project_settings`, COALESCE org defaults); budget
  is **AGENCY-PRIVATE** ([[project_budget_agency_private]]); currency travels on the line
  (FR-00231). Recursive **buildup `parent_id` column present, UI DEFERRED** (shelved,
  [[project_buildup_shelved]]). "Price is a guide" ([[project_price_is_a_guide]]).

### S3 — Inbox (message, negotiate) → QC
- **Tables (the FULL messaging cluster — not just messages+reads):** `project_providers` (the
  engagement spine, one per supplier messaged), `messages` (party-anchored), `message_reads`,
  `message_relations` (what a message is about → the item), `message_events` (append-only
  journal: accept / decline / suggest + price/status history + **approvals FR-00228**), plus
  the **`project_item_quotes` overlay writes** (supplier changes land here).
- **Port (real re-align, not refs):** `inbox-project.component`, `inbox.service`,
  `project-outreach.store` move from the UNIFY-01 `message_items` model to the messaging
  cluster. Read-only-after-sent preserved.
- **Negotiation model (LOCKED; this IS deck slide 9):** per-item conversation
  (`message_relations`→item); accept/decline/suggest as `message_events`; a supplier change
  writes the quote overlay; **re-approval is DERIVED** — an accept is invalid if a *material*
  event post-dates it (FR-00228), so "both-approved" and "needs re-approval" are computed, not
  stored.
- **Design call (Liam):** the negotiation **UX** (the model is locked; the presentation isn't).

### S4 — SOW → QC
- **Tables:** `project_documents` (`quote_theme`/`footer`/`show_*`, `sow_timeline`/
  `payment_terms`/`special_terms`).
- **Flow (deck slide 9):** once every item for a supplier is agreed/rejected, consolidate the
  agreed items into a **Statement of Work** (scope, quantities, prices, delivery, payment
  terms; rejected items excluded, conversations kept). Both parties sign → **Stripe 50%
  deposit** → agreed items marked **Live** in Running budget.
- **Design calls (Liam):** the **signing mechanism** (real e-signature + audit trail vs
  "both click Accept"); the **payments model** — **Checkout vs Connect** (Stripe is un-tackled,
  not a blocker, rides this stage). Server-side PDF **deferred** ([[project_quote_pdf_arc]]).

---

## Deck (slides 8-9) folds into S3/S4 — built once

Liam's agency-changes deck is incorporated here rather than as a later pass:
- **Slide 8 "Live project / Running budget"** = a **projection** over `project_providers` +
  the quote overlay + payment status (per-supplier cards: selected items, agreed/to-agree,
  subtotal, paid/outstanding/next-due). Built in **S3/S4**, not a separate screen. The live
  project collapses to **3 tabs (Running budget · Inbox · Marketplace)** — a Liam design call
  on whether Overview/Reports drop for the live phase.
- **Slide 9 "Inbox → SOW → sign → pay → Live"** = the S3 negotiation model + the S4 SOW flow
  above. "Add item to a live supplier" = reopen the Inbox conversation → agree → revise+re-sign
  the SOW → pay the delta. Existing paid items untouched.

So the deck's substantive asks ARE S3/S4; the styling asks (slides 1-4) stay deferred polish.

---

## Dependencies & locked calls (don't re-litigate while building)

- `project_items` **LOCKED** = the FROZEN ask shape (NOT UNIFY-01's unified line). Don't drop
  `project_item_quotes` — it's half the line model.
- line-pricing SSOT: reattach + re-point to the overlay + keep the contract test.
- buildup `parent_id`: **column in S2, UI deferred.** Per-node margin = v2.
- `venue_address_id` → addresses (FR-00239 wires the project venue; ties to the addresses slice).
- **Deferred:** `project_media`, `project_links` (FR-00234), the standalone SOW PDF, Stripe
  until S4, per-node margin.

## Liam-QC checkpoints (the whole point of the staging)
S1 create a project · S2 see the ballpark with included items + total · S3 message + negotiate
· S4 produce a SOW. Four decisions to settle at their stage, flagged above: **create-flow tidy
(S1), negotiation UX (S3), signing mechanism + Checkout-vs-Connect (S4).**
