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
