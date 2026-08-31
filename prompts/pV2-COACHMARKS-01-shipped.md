# pV2-COACHMARKS-01 — admin-editable help bubbles ("coachmarks")

**Shipped:** 2026-08-30, chip `[Dev v2] v2.173`

A reusable pink help-bubble ("coachmark") whose content is **admin-managed data**,
not hardcoded. Coachmarks live in code (a `page`/`name` key + a default text);
they **auto-register** into a table the first time they render, and ballpark
admins **tweak the description / toggle active** from a new Coachmarks settings
tab. Adding brand-new coachmarks stays a dev task for now.

## Data
- New table **`coachmarks`** (`id, page, name, description, tail, is_active,
  sort_order, created_at, updated_at`, unique `(page, name)`) — created on dev via
  `server/scripts/create-coachmarks-table.js` and added to `migrate-schemas.js`
  (a per-schema loop, all of public/preview/master) for promote.

## Server (gated v2 router → `/api/coachmarks`)
- `POST /resolve` (member): register-if-missing with the code default, return the
  (possibly admin-edited) row — `coachmark.service.resolve` (SELECT, else INSERT …
  ON CONFLICT DO NOTHING-ish, never overwrites an edited row).
- `GET /` + `PATCH /:id` (**ballpark admin**, `admin.cross_org_view`): list + edit
  description / active / tail. No delete surface.
- `routes/coachmarks.js`, `schemas/coachmark.schema.js`, mounted in `index.js`.

## Client
- **`CoachmarkService`** (core) — resolve / list / update (maps `is_active` →
  `isActive`).
- **`<app-coachmark page name defaultText>`** primitive — the pink bubble to
  spec (white card, `--theme-accent` border/glow/ring, rotated-square tail,
  `text-sm` body, **Okay**, **Don't show again**). Resolves on init; hidden if the
  admin set it inactive or the viewer chose "Don't show again" (localStorage per
  browser, keyed `bp-coachmark:<page>:<name>`). API-down → still shows the code
  default (help never just vanishes).
- **First instance:** the **Ballpark Cost** tab — `page=ballpark-cost name=intro`,
  rendered **above the tab band, tail DOWN** at the "Ballpark cost" tab (x-offset
  aligns it to the 2nd of the even-width tabs), default *"Here is your ballpark
  cost. Feel free to remove anything and add elements from the marketplace."*
  Shows each time you open the tab until dismissed. `tail` is a usage-site prop.
- **Admin tab:** `settings/coachmarks` (ballparkAdminGuard) + a link in the
  account menu (with Page settings / Early access). Lists registered coachmarks;
  edit description + Active toggle + Save.

## Iteration — v2.188: opt-in bubble points at the Base row
- The opt-in ("want me to show you?") now anchors to the **Base row** (inline in
  that row, tail down at it) instead of the top of the builder — the tail points
  at row 1. The running steps stay as the top bubble + field glow. (Inline
  content, not a template ref, so it renders inside the `@for`.)

## Iteration — v2.187: "Show me around" toggle to re-trigger the demo
- Added a **"Show me around"** (circle-help) button in the Customize header —
  `replayDemo()` clears the "No thanks" suppression flag and re-shows the opt-in.
  (The coach was hidden because `bp-coachmark:customize:demo` had been set;
  no more console-poking needed to re-run it.)

## Iteration — v2.186: revert moving bubble → reliable top bubble + field glow
- The per-cell anchoring (v2.184) used an `#ngTemplateOutlet` ref across the
  `@for` cards; the ref didn't resolve inside the loop, so EVERY anchored bubble
  (incl. the ask) rendered empty → "no coach". Reverted to **one bubble at the
  top of the builder** (parent view, always resolves) with the active field
  **glowing** (`.bp-demo-hl`), which moves per step. The moving-triangle idea
  needs a non-ref anchoring approach (deferred).

## Iteration — v2.185: fix — demo bubble was clipped by the card
- v2.184 regression: anchoring the bubble inside the category card (which was
  `overflow-hidden`) clipped it → "coaching doesn't appear". Card is now
  `overflow-visible`.

## Iteration — v2.184: demo bubble anchors to each field (tail points at it)
- The demo bubble now **moves to the field it's talking about**, tail down at it:
  ASK → the base Item name; Name/Cost/Unit/Inc/× steps → that cell of the
  insurance row (relative wrappers + an absolute `coachTip` template anchored
  `bottom-full` over the cell). Save/final steps (no single field) stay top-centre.
- NOTE (QC): narrow far-right cells (Inc, ×) may push the 288px bubble past the
  edge — alignment likely needs a nudge on the real screen.

## Iteration — v2.182: richer demo narration
- Reworded the demo steps: **Qty** flexibility (wine per head / 100 invitation
  cards / hire for 3 weeks), **Include** = offer + quickly exclude without
  deleting, and **Save draft vs Send new cost** (highlights both buttons on that
  step).

## Iteration — v2.181: Customize demo wizard (opt-in "want me to show you?")
- Replaced the static customize base-intro bubble with an **opt-in demo**: an
  "…Adding extras is easy — want me to show you?" bubble ([Show me] / [No thanks]).
- **Show me** runs a self-driving example: adds an **Insurance** line and fills it
  (Name → Cost £200 → Unit 'job'/Qty 1), then shows **Include**'s effect (Revised
  ticks up), narrates **Save**, **unticks Include** (Revised drops), points at the
  **×** remove, and finishes by **removing the demo line** — zero side effects,
  nothing persisted. One narrating bubble (own overlay layer) + a **highlight**
  (`.bp-demo-hl`) on the active field/button; **Next** steps through.
- "No thanks" suppresses (localStorage); finishing does NOT — the opt-in returns
  next open. Coachmark bubble styles moved to global `styles.css` so the wizard
  reuses them.

## Iteration — v2.180: Customize coachmark → own layer + insurance example
- Customize coachmark now renders as an **absolute overlay** (own layer, `z-40`,
  container `pointer-events-none`) so it no longer pushes the builder content
  down / shifts the screen.
- Example uses **insurance** (always relevant): *"…To add an extra like
  insurance, add a line: type 'Insurance', pick 'job' as the unit, keep Qty at 1,
  then enter its Cost…"* (code default + DB row updated).
- TODO (discussed): a **step-by-step guided tour** that seeds the insurance line
  and highlights each field in turn — deferred; this is the single-bubble version.

## Iteration — v2.179: generic Customize coachmark example (item-agnostic)
- The example was catering-specific ("gourmet menu +£20") — nonsense for a Stage.
  New generic wording: *"…To tailor it, add a line for any upgrade or extra the
  client wants — its cost adds on top and the total updates live."* Updated both
  the code default and the existing DB row (`scripts/reset-customize-coachmark.js`).

## Iteration — v2.178: Customize teaching coachmark + `{vars}` + hide Extras
- Coachmark gains a **`vars` input** → `{key}` placeholders in the text are filled
  from context, so a coachmark can reference specifics while the admin still owns
  the sentence. (`displayText` computed.)
- New **`page=customize name=base-intro`** coachmark at the top of the Customize
  builder (tail down at the first card): *"The Base row is your {item} — {rate}
  per {unit} × {qty} = {total}. Now imagine the client wants to upgrade — add a
  line … and the total updates live."* — vars come from the actual item
  (`coachVars`).
- **Extras/margin card hidden for now** in Customize (`cardGroups` filters
  `isExtras`); margin still applies at its default.

## Iteration — v2.176: Okay button = solid brand rose (not the gradient)
- The coachmark **Okay** button was using `bp-btn-grad` (pink→green gradient);
  switched to the solid **primary** look per spec — `--theme-accent` fill,
  near-white text (`--theme-accent-contrast`), hover → 90% opacity.

## Iteration — v2.175: coachmarks overlay in their own layer
- Coachmarks now render in an **absolute overlay above the tab band**
  (`absolute bottom-full left-1/2 -translate-x-1/2 z-40`, container
  `pointer-events-none`), so showing/dismissing one **doesn't shift the layout** —
  they float over the app. Tail still points down at the target tab.

## Iteration — v2.174: Marketplace coachmark
- Added `page=marketplace name=intro` above the tab band on the Marketplace tab
  (centre tab → no x-offset), tail down: *"Here is the marketplace. Keep track of
  your running estimate by going back to the Ballpark tab."*

## Deferred
- Admin **add/delete** of coachmarks (dev-defined for now).
- Precise anchoring of the bubble to a specific element (currently top-centre of
  the tab content, tail up).
