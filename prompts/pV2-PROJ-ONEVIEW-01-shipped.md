# pV2-PROJ-ONEVIEW-01 — Project Ballpark: one view across Draft ⇄ Active

**Date:** 2026-11-12 · **Branch:** `rebuild/org-slice` · **Files:**
`client-v2/src/app/pages/projects/project-estimate.component.ts`,
`client-v2/src/app/pages/projects/project-detail.component.ts`

## Problem

Clicking **Send all** on Ballpark hopped the user to the Details tab, and the
Ballpark view itself **restructured** on send — the whole body was gated on
`isDraftProject()`, so sending swapped the hero, re-styled the supplier cards,
changed the add control, and surfaced Assumptions/Risks. It read as a different
page. Goal: **one view** — the body looks the same before and after send; state
only *reveals* extra surfaces, it never rebuilds the layout.

## Decision log (walked with Liam, 2026-11-12)

1. **No jump after send.** The forced `router.navigate(tab: 'details')` in
   `onSendBriefs` is removed; the `detailsSaved` emit stays (it flips Draft →
   Active server-side and unlocks the Inbox/Documents tabs in place).
2. **Body = the draft layout, in both states.** Active no longer has its own
   render path. The supplier-grouped editable grid is used throughout.
   - Rows self-manage: `app-estimate-item-row` disables qty/remove via
     `editable(line)` and shows the per-line status pill when `isFinal` — so sent
     lines come out **read-only with status inline**, no read-only-after-sent fight.
3. **Appears on send** (layered on the same structure, no status branch):
   - **Per-supplier status pill** — now `@if (g.summaryCode)` only; `summaryCode`
     is empty in draft and set on send, so it self-reveals. (Liam: pointless in
     draft, but relevant the moment you send — keep it.)
   - **Summary-status tiles** stay **connected to the hero** (not extracted).
4. **Appears on cost-accept** (`bothAccepted`): the per-supplier **payment status**
   (Paid / Outstanding / Final due) — unchanged, still `@if (g.hasAgreed)`.
5. **Removed from the view:** the active-only lifted supplier cards, the
   number+glyph, `text-xl` names, the "Add item → message the thread" button
   (use draft's add control), and the **Assumptions / Risks** "Coming soon" blocks.
6. **Totals = state-specific (option a), but send is reachable in both:**
   - Draft keeps the per-section grey total box with **"Message suppliers —
     sending makes this project live."**
   - Active keeps the **Project Total** rollup card, now with its own **Message
     suppliers** button (no "makes this live" caption — it already is).
7. **One hero across Draft ⇄ Active (Liam 2026-11-12, final call).** The overview
   hero (cover + name + the four negotiation tiles) renders in **every** mode — no
   image branch, no status branch. (Superseded an interim "image-driven" rule:
   `hasCover` picked the draft page-hero when there was no cover photo. Dropped to
   keep it simple — one hero, always.) The tiles' numbers self-reveal once the
   project is live (`overview` still only fetches when `!isDraft()`, so they read
   0/— in draft).

8. **"Edit details" on the hero (Liam 2026-11-12).** The overview hero's cover
   actions gain an **Edit details** button (pencil, beside Change image — the
   "Build cover from your items" stub was removed in the same pass). It opens the
   **same project-details dialog from the create flow** —
   the shared `app-project-details-fields` form (name / client / event type /
   date / venue / guests / budget) — now reused for two entries off one
   `welcomeOpen` dialog, branched by a `detailsMode` signal:
   - `welcome` — the create-flow confirm (forced, flies into the Details tab on
     save). Unchanged.
   - `edit` — closable (Cancel + "Save details"); on save it PATCHes the project,
     reloads the detail + estimate (guests / event type feed line pricing) and
     closes — no fly, no `?welcome`. Shows on every tab (the hero is global now).

9. **Budget thousands separators (Liam 2026-11-12).** The shared
   `project-details-fields` Budget field (create page + welcome + edit dialog) now
   groups with thousands separators (`45,000`) — switched `type=number` → grouped
   `type=text inputmode=numeric`; the model stays **digit-only** (`budgetDisplay`
   formats, `onBudgetInput` strips) so `Number(budget())` still works on every
   consumer. Brings the dialog in line with the Details-tab budget, which already
   grouped on blur.

10. **Details tab hidden (Liam 2026-11-12).** Removed `details` from `projNav`, so
    the tab no longer shows. The `@case ('details')` content + the route stay (the
    welcome-flow landing and deep links still resolve). Project details are edited
    via the hero's "Edit details" dialog now.

11. **Financials folded into the Edit-details dialog (Liam 2026-11-12).** Since the
    Details tab is hidden, the dialog gains **Currency / Margin % / Contingency % /
    VAT %** (a `showFinancials` input on `project-details-fields`, true only in edit
    mode — the create/welcome flow stays lean). **Layout (final, Liam 2026-11-12):** one
    field per row (name / client / event type / date / location), with **Guests +
    Budget side by side**; Financials is a **show/hide region** below — collapsed by
    default, a "Financials" toggle with a chevron, **two columns** when open
    (Currency / Margin, Contingency / VAT). Shared by the add-project card + both
    dialogs. Dialog stays 560px. (Dropped an interim details-left / financials-right
    split — Liam didn't like it.) These are REAL, not cosmetic:
    `estimate.js` applies **margin + contingency** to the working ballpark;
    **VAT** drives the quote VAT-note (ballpark is ex-VAT); **currency** formats
    everywhere. They map form → `defaultMarginPct`/`defaultContingencyPct`/
    `defaultVatPct` + `currency` → the `default_*_pct` columns the cascade reads;
    blank clears to null (inherit org default). Budget label now shows the chosen
    currency symbol. **SOW is intentionally NOT in the dialog** — not needed for the
    agent persona (Liam). The hidden Details tab's SOW/logistics editors are the
    only surfaces now dropped from the UI; raise them again only if a need appears.

12. **Dialog chrome standardised (Liam 2026-11-12).** Two bespoke `fixed inset-0`
    overlays on the project page were converted to the canonical `bp-modal`
    `p-dialog` shell (standard header + X, hairline header/content/footer dividers,
    right-aligned footer with `bp-btn-outline` Cancel + `bp-btn-grad` primary) to
    match the Edit-details dialog: **Add outside supplier** (invite-supplier) and
    **Add Line Item** (custom-line). Content/logic unchanged; only the shell +
    buttons. **Still bespoke (follow-up):** `message-suppliers-dialog` (quick, same
    pattern) and `customize-dialog` (heavy — full-screen + 3 nested overlays).

## Consequences to QC

- **Every** project — draft or active, photo or not — now shows the overview hero.
  A fresh draft shows the cover/name block with the tiles reading 0/— (expected;
  they fill in once sent). The compact page-hero is no longer used on this page.
- `summaryCode` / `hasAgreed` are **category-level** rollups (a category can hold
  more than one supplier banner); reads naturally when category ≈ one supplier.

## Cleanup

Removed the now-dead `openSupplierInbox`, `activeStatusCode`, `activeStatusLabel`,
`lineCostOf` (only the deleted active grid used them) and their orphaned imports
(`acceptanceCode`, `LineDisplayCode`). With the hero collapsed to one path, also
removed `hasCover`, `projectTokens`, `projectHero`, `ballparkTotalStr`,
`ballparkItemCount` and the `PageHeroComponent` import (only the dropped draft
page-hero used them).

## Status

Compiles clean on dev2 (:4202). Awaiting Liam's QC on localhost before commit.
