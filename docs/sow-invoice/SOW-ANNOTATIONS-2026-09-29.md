# SOW annotations — extracted 2026-09-29

Source: `BALLPARK SOW .docx` (Liam's annotated draft). Annotations were **highlighted
text** in the doc (23 highlights + 6 tracked insertions; no Word comments). This is the
spec for turning the SOW into an **AI-assembled, auto-populated** document rather than a
hand-filled template.

Current build = `client-v2/src/app/pages/projects/sow-document.component.ts`
(pV2-BUILDUP-04). It already renders: agency header + meta table, Parties (auto from
project/org incl. company number + address), title banner, Services & Goods (scope seeded
from the quote, grouped by category), Timeline, Project Total gradient banner, Payment
Terms, Special Terms, signatures, and the Annex A T&C PDF merge (`org.termsPdfUrl`).
So ~half the annotations are already satisfied; the notes below mark **DONE / GAP** per item.

Tracked as **FR-00226** (Complete SOW & Quote) + a sibling FR for the item render fields.

| # | Where | Annotation (verbatim) | Meaning | Status |
|---|-------|-----------------------|---------|--------|
| 1 | Role-of-Ballpark intro | "ALL OF THIS SHOULD BE AVAILABLE THROUGH THE PROJECT AND ALREADY ON BALLPARK." | Header / parties / reference / effective date populate from project data, not manual `[brackets]`. | **Mostly DONE** — parties, company no., address, project ref, created date all auto-bind. Confirm effective-date + Ballpark reference/quote-ID surfacing. |
| 2 | §1 heading | "THIS IS WHERE IT OUTLINES THE ORIGINAL DESIGN. EG STEP AND REPEAT" | §1 = the original marketplace concept for each item. | **GAP** — current "Services & Goods" is a category-grouped bullet list, not a per-item concept block. |
| 3 | Concept reference | "STEP AND REPEAT 2M X 2M." | Example concept-reference value (listing / design ref + base spec). | GAP (part of #2). |
| 4 | Branding updates required | "CHANGE IN SIZE. 3M X 2M AND AGENCY BRANDING." | The delta from the standard listing (spec/branding change). | GAP (part of #2). |
| 5 | Approved by Agency on | "DATE THAT THEY BOTH APPROVED THE FINAL COST FOR THE ITEM." | Approval date = the agreement/approval **event** timestamp, not a typed date. | **GAP** — needs the per-line approval event surfaced. |
| 6 | §2 Bespoke Render | "EACH BALLPARK NEEDS TO SAY WHETHER THIS INCLUDES A BESPOKE RENDER AFTER PAYMENT AND IF SO HOW MANY ROUNDS OF AMENDMENTS — AND IT WILL BE RESTATED HERE." | Two new per-item fields: **render included (Y/N)** + **amendment-rounds count**, restated into the SOW. | **GAP** — data-model add (sibling FR). |
| 7 | §3 Production/Pricing | "HERE EACH ITEM… WILL HAVE PRICE NOTES… SENT VIA THE AI FROM THE CONVERSATION. EG STEP & REPEAT'S ORIGINAL PRICE AND HOW THE SIZING CHANGED THE FINAL COST." | The **Price Notes column is AI-generated from the negotiation thread** (original → change → final). | **GAP** — the biggest build; reuse inbox `ai.service`. |
| 8 | §3 Price-Matched | "IT WILL ALSO HAVE THE ITEMS WHICH HAVE BEEN PRICE MATCHED OR SLIGHTLY ADJUSTED… RATIONALE LISTED IN PRICE NOTES." | Price-matched rows tagged by **Source** + rationale. | **GAP** — surface price-parity/price-match source + reason in the items table. |
| 9 | §5 Staffing | "THIS MAY BE SPOKEN ABOUT IN CHAT OR INCLUDED IN THE BALLPARK. IF NOT IT WILL CLEARLY SAY NA." | Staffing pulled from chat/ballpark; else render "NA". | **GAP** — section not present yet. |
| 10 | §6 Logistics & Other | (same as #9) | Logistics pulled from chat/ballpark; else "NA". | **GAP** — section not present yet. |
| 11 | Annex A — T&Cs | "WE WILL NEED TO GO THROUGH THIS WITH A LAWYER." | Legal review of the Annex A terms content. | **External dependency** (non-eng); logged on FR-00226. |

## The items table (§3) — target columns

`Item | Spec | Qty | Source | Price Notes / History | Total`

- **Source** — "This Supplier — own design" vs "Price-matched from [Other Ballpark Supplier]".
- **Price Notes / History** — AI-written from the negotiation thread, e.g.
  *"Initially quoted at £5,500 for 2m×2m. Following [Agency]'s request to increase to
  3m×2m, revised to £6,500."* For price-matched rows: "Matched exactly" or
  "Adjusted: reason".
- **Total** per row + **Total (exc. VAT)** footer = the current single quote for the project.

## Build notes (reuse — "similar to what we already built")

- Extend `sow-document.component.ts`; keep the Quote's visual language (`.sow-bar` /
  `.sow-fee` / `.quote-doc__paper`, gradient banners) already in place.
- Items table can reuse the quote-line data (`project.service.quoteItems`) + the
  line-pricing SSOT for totals; add Source + Price-Notes columns.
- Price Notes = new AI call over the negotiation/message thread (inbox `ai.service`,
  Haiku), producing the original→change→final narrative per line. Store the generated
  note so the SOW is reproducible (don't regenerate on every open).
- Approval date (#5) = the per-line agreement/approval event already captured in the
  inbox negotiation flow.
- Staffing / Logistics (#9/#10) = new SOW sections with a chat/ballpark source and an
  explicit "NA" fallback.
- Render fields (#6) = additive item columns (sibling FR) — see below.

## Change list (merge-model view)

Model: a **per-org (supplier/agent) PDF template** whose merge fields fill from **project +
org data, the items/categories (quote lines), the collected attributes, and the negotiation
thread**. The template stays static; these are data / merge-field changes, not new chrome.

**New merge inputs to collect**
- Per item: `render_included` (Y/N) + `render_amendment_rounds` — new item attributes (FR-00227) → §2 Bespoke Render.
- Per line: AI **Price Notes** merged from the negotiation thread (original → change reason → final); stored so the merge is reproducible.
- Per line: **Source** tag — "own design" vs "price-matched from [Supplier]" + rationale (from price-parity data).
- Per line: **approval-event date** (both parties approved final cost) — replaces a typed date.
- Per item (§1): concept reference (listing/design ref + base spec) + branding/spec **delta**.
- Staffing / Logistics: from chat/ballpark, else literal "NA".

**Template sections that change**
- §1 Concept & Design Sign-off — new structured per-item block (concept + delta + approval date). Today: flat category bullet list.
- §2 Bespoke Render — new section, restates the two new item fields.
- §3 Items table — add **Source** + **Price Notes / History** columns to the `Item · Spec · Qty · … · Total` table.
- §5 Staffing / §6 Logistics — new sections with chat-or-"NA" fallback.
- Annex A (T&C) — no structural change (org terms PDF already merges); content needs lawyer review.

**Already merging (no change)**
- Header / logo / Parties (company no. + address) / project ref / created date — auto from project + org.
- Effective date + Ballpark quote/reference ID — confirm surfacing.
- Fee / totals — line-pricing SSOT; gradient Fee banner in place.
- Annex A T&C PDF merge — org terms PDF appends.

The one real build = §3 items table + the AI Price-Notes generator. §2 = small additive columns. §1/§5/§6 = new merge blocks. Server-side Puppeteer PDF still deferred.

## Use case — generate & issue an SOW from a resolved Ballpark project

**Actors:** Agent (buyer/agency), Supplier, Ballpark platform + AI, the Inbox.

**Preconditions:** Supplier has catalogue items (attributes + render fields + concept/design ref + price). Agent has a project with items added to the ballpark (quote).

**Who fills what, when, where**

| Actor | Fills | Where | When |
|-------|-------|-------|------|
| Supplier | Item core + 5 attribute groups + `render_included`/`amendment_rounds` + concept/design ref + base price/variants | Item editor (`store/item-edit`) | Catalogue setup / onboarding |
| Agent | Project header (event name, dates, venue) + Parties (client name, company no., address) | Project settings / SOW section | Project creation |
| Agent | Adds items to the ballpark, sets quantities; staffing & logistics notes (or leaves blank → "NA") | Marketplace → project quote; SOW section | Planning |
| Both | Per-line negotiation: price / spec / qty / price-match, and per-line approval of the final cost | Inbox conversation | Negotiation phase |
| System / AI | Price-note narrative, approval dates, Source tags, SOW version | Generated at build time | On "Generate SOW" |
| Supplier | **Approves the generated SOW** | Inbox | After generate |
| Agent | Receives issued SOW → signs; 50% deposit via Stripe | SOW doc / Stripe | After supplier approves + send |

**Main flow**
1. **Capture** — supplier + agent fill their data (table above).
2. **Negotiate (Inbox)** — per line, price/spec/qty resolved; price-matched items tagged; the AI logs each change into the line's Price-Note narrative; each line's final cost is **approved by both parties** (approval event = the §1 date).
3. **Resolution gate** — when **every line is resolved + approved** (nothing open / negotiating / unresolved-declined), the project is "quote-agreed" and **Generate SOW** enables.
4. **Generate** — the per-org template merges project/org + items/categories + attributes + AI price notes → **SOW V1** (concept §1, render §2, items table §3 with Source + Price Notes, staffing/logistics, fee, terms, Annex A). Stored + versioned.
5. **Surface in Inbox** — the generated SOW appears in the inbox for the **Supplier to review + Approve** (it is their delivery contract).
6. **Send** — on supplier approval the SOW is **issued/sent to the Agency for signature**; signature + 50% deposit via Stripe then triggers the bespoke-render / production flow (§2).

**Alternate — post-issue change:** an approved change request updates the relevant items-table row and **auto-increments the SOW version** (V1 → V2 …); re-approve / re-send as needed.

**Dependencies:** per-line approval events (inbox negotiation), price-parity/price-match source, inbox `ai.service` for Price Notes, Stripe (payments roadmap) for the deposit step, `FR-00227` for the render fields.

## Collection mechanism — AI assistant + SOW-readiness checklist

- The **AI assistant is the primary collector**: it extracts merge fields from the brief +
  negotiation thread and drafts the soft/narrative fields (Price Notes, spec/branding
  deltas, staffing/logistics, render prompts). Estimated ~80% of the SOW is collectable
  conversationally; the rest is pre-filled/prompted.
- It maintains a **per-project SOW-readiness checklist**: tracks which merge fields are
  known vs missing and proactively asks in-thread for the gaps ("I still need the venue
  address and whether the plinth includes a render"). The **Generate gate** opens when the
  checklist is complete **and** every line is resolved + approved. (Reuses the
  completeness-card idea from the media epic.)
- **Structured boundary — AI drafts, does NOT decide:**
  - **Price** = the resolved line state (line-pricing SSOT), never a number parsed from
    prose. AI writes the *note*; the *figure* is the line.
  - **Approvals** = an explicit action / state transition, never AI-inferred sentiment —
    a contract must not generate off a misread "sounds good."
  - **Legal-entity facts** (company numbers, registered addresses) persist on the
    org/project record; AI prompts for them once, then they're stored.
  - The SOW merges **AI-drafted narrative + structured binding facts**.

## Direction — message-as-input (Liam, 2026-09-29)

We may migrate the UX so the **chat message is the primary input surface** (conversational
input), replacing structured form-fills as the default entry point.

- **Model:** message carries intent → AI parses → **proposes** a structured change
  (price / spec / qty / field / approval) → human **confirms with a tap**. The message is
  the input; confirmation stays explicit for the binding bits (price, approval), so this is
  consistent with the structured boundary above.
- **Implication:** forms become secondary/derived; the **negotiation thread becomes the
  system of record for intent**, structured state the system of record for binding facts.
- Not committed — logged as the intended trajectory so the SOW/collection build is designed
  message-first (AI parse + propose-then-confirm), not form-first.

## Inbox action model — Add + SOW-displaces-Approve (Liam, 2026-09-29)

- **Add** — a new inbox action supporting two things: (a) **adding components** (build-up
  sub-items on a line) and (b) **adding / attaching the SOW** to the conversation.
- **SOW displaces Approve** — once a line/thread is **approved** (both parties agreed the
  final cost), the **Approve** action is replaced in that same slot by **SOW**. So the
  per-line button progression is `…negotiate → Approve → SOW`.
- **Thread level:** when *every* line is approved, the SOW action **generates + surfaces**
  the SOW for the **supplier to approve → send** (matches the use-case gate above).
- **Note / open scope:** "add components" touches the recursive build-up model
  (composition UI was shelved at v2.66, code kept — see `project_buildup_shelved`). Confirm
  whether Add revives that composition surface or is a lighter "attach a sub-item" action.

## Spitball — unified AI interaction model + phasing (NOT committed, 2026-09-29)

Thinking-out-loud direction, logged as an option, not a decision:

- **Action buttons (Change / Add / SOW) each open an AI-guided dialog.** Mostly wiring
  existing parts together — the AI-guided pattern already exists in
  `projects-new.component.ts` (brief parse), `website-import-panel.component.ts`
  (analyse→guide), the `customize-dialog.component.ts` shell (the shelved build-up dialog,
  exactly where "Add components" would live), over `core/ai/ai.service.ts`.
- **Message input has AI forced always-on (not invite).** Every message is parsed →
  propose-then-confirm, so nothing slips past uncaptured and the readiness checklist fills
  itself; the thread *is* the input feed. Keep **graceful pass-through** (a plain "sounds
  good" just sends) and a **confidence threshold** (propose only when confident) for
  cost/latency. This unifies the button + message input paths under one AI.

**Phasing (Liam):** may split into pieces — **start with the SOW** (generate → surface →
supplier approve → send), **then do Add** (components). SOW first, Add second.
