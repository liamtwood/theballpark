# pV2-STORE-QUICKVIEW-SUPPLIER-01 — two-page Quick View (Item + Supplier profile)

**Status:** DRAFT for Liam QC (2026-10-15). Catalogue-slice enhancement — NOT a new rebuild slice.
**Direction:** a Loveable mockup set the concept/flow (see below). Use it as **direction, NOT a copy** —
build it in Ballpark's own design system (our tokens, pill/segmented/card styles, the existing Quick View
chrome), not a replica of the Loveable look or wording.

## Objective
Let a buyer explore an item **and** get to know its supplier **without leaving Marketplace**. The Marketplace
Quick View becomes a **two-page** overlay — **Item details** and **Supplier profile** — that you switch
between (tabs + swipe), with Marketplace preserved behind it.

## Requirements (from product)
1. Item page: clear images, description, pricing, relevant specifications, **Add to ballpark**.
2. **Remove the "Source" field** from the item view (included by mistake).
3. **Supplier profile page** in the SAME Quick View: company info, location, images, "past projects".
   Switchable via **swipe** AND clearly-labelled click control.
4. **Marketplace stays open behind** — closing returns to the same search / filters / scroll position.
5. The supplier's full **store is an optional next step** (a button), never automatic navigation.

---

## Build

### Switcher (DECISION 1 — recommended, confirm)
A 2-option switch at the top of the dialog: **"Item details" · "Supplier profile"**, plus a **horizontal
swipe** between the two panes on touch. Both set the same active-pane signal. The two panes live in a
200%-wide track that `translateX`es between `0` and `-50%`.
- **Recommendation:** labelled segmented control (reuse the `.bp-projnav` segmented pattern we just shipped
  — white track / dark selected) **+** swipe. This satisfies BOTH the written "Item details / Supplier
  profile tabs" ask and the mockup's swipe. Drop the mockup's dot-pager (the segmented control shows
  position). → *Liam: confirm "tabs + swipe", or do you want the dot-pager/pills kept too?*
- Keyboard: the two options are real `<button role="tab">`; left/right arrows move between panes.
- On open (new item): reset to the **Item** pane.

### Page 1 — Item details
Refine the existing `quick-view-dialog`:
- Eyebrow "Quick view" → title → description (markdown pipe) → **image carousel** (existing) → supplier +
  location line → indicative price → variant picker (existing) → **specifications / attribute groups**
  (existing) → **Add to ballpark** (existing, emits `add`).
- **Remove** the item-level **"Source"** field (find where it renders in the item view and delete it; the
  supplier *website* on the Supplier page is separate and stays).
- **Remove** the current "View supplier profile" navigate-away link (replaced by the switcher).
- Image treatment (DECISION 2 — recommended, confirm): **plain** (object-contain on neutral surface), to
  match the card default now that cover treatments are opt-in (FR-00243). When FR-00243 lands, the Quick
  View honours the per-image treatment too. → *Liam: plain, or the blurred-fill from the mockup here?*

### Page 2 — Supplier profile
New pane (inline or a small `app-supplier-profile-pane`), data from `GET /api/marketplace/suppliers/:id`:
- Eyebrow "Quick view" → **supplier name** → optional "Supplier profile for X" subtitle.
- **Cover image** (full-width, our card radius) with the **circular logo** overlapping bottom-left.
- Supplier name + **location** (city). NO "approved/verified" badge — every marketplace supplier is
  approved by default, so it conveys nothing (Liam, 2026-10-15; was a mockup artifact).
- **Description** rendered via the markdown pipe (bold + bullets). It can be LONG (the Yahire profile is a
  full multi-section write-up) — the dialog body already scrolls; make sure the long body reads cleanly.
- **Website** link pill → opens the supplier's site in a new tab (external link; the supplier's own stated
  URL).
- **"Past projects"** = the supplier's **gallery images** in a carousel (reuse the item image-carousel
  pattern). Label it per our copy; it's not engagement data (real project history is future / S3).
- **"View full store"** button → navigates to `/suppliers/:id` (the full item grid). The ONLY navigation,
  user-initiated, and it closes the dialog.

### Marketplace-behind + close-restores
Keep it a dialog overlay (no routing while switching panes), so the Marketplace component is never
destroyed — closing (X / backdrop) returns to the exact search / filters / scroll. Verify the switcher
never routes.

---

## Data / API
- **Add `website` to the `supplier_directory` view** (new rebuild migration, e.g. `0021_supplier_directory_website.sql`
  — drop+recreate the view adding `o.website`; keep it active-supplier/owner-run; re-grant `web_app_user`).
  Everything else the profile needs (name, description, logo_url, cover_image_url, images, city/country) is
  already in the view.
- `GET /api/marketplace/suppliers/:id` (storefront projection) — ensure it returns description + website +
  logo + cover + images + city for the profile pane (it reads `supplier_directory`).
- No new tables. No client state beyond the active-pane signal.

## Reference content (real, in v2dev)
Supplier **Yahire Funiture** (`c5ad93e1-f391-4caa-8e22-dc985a5ead51`, active, Hornsey): full markdown
description, website `https://www.yahire.com`, logo, cover, 4 gallery images. Design + QC against it.
(Note: a *suspended* duplicate org "Yahire" exists — ignore it; cull separately.)

## Standards
v2 component standards (docs/CLAUDE.md): standalone / OnPush / signals / `@if`-`@for` / `input()`-`output()`
/ `inject()`; tokens-only colours (no raw hex / Tailwind colour utils); lucide via `.pick`. Extract-before-
duplicate (reuse the image-carousel + segmented-control patterns rather than re-building them).

## Chat design review (2026-10-15) — refinements + calls

**Decision 1 (switcher) — ENDORSE: segmented control (`.bp-projnav`) + swipe, NO dots.** Labelled
tabs are a *product requirement* (the deck says "clearly-labelled Item details / Supplier profile
tabs so people can also click between them"), so a dot-pager alone fails the ask. A segmented
control already shows position → dots are redundant (drop them, don't double up). Reusing
`.bp-projnav` = consistency + extract-before-duplicate. For a binary "two views of one thing," a
segmented track reads better than separate pills. (Still Liam's to confirm.)

**Decision 2 (item image) — ENDORSE: plain object-contain on neutral.** Match the card the user
just clicked (continuity — a plain card shouldn't open to a blurred QV); show the WHOLE product
without an arty crop (honesty — a buyer needs to see the item); and FR-00243 is the per-image
opt-in path for cover/blur later, so don't bake a QV-wide one-off. (Still Liam's to confirm.)

**Decision 3 (NEW — surface to Liam): "View full store" target.** The spec navigates to
`/suppliers/:id` (LEAVES Marketplace). The deck's stated preference (slide 7) was to *"filter
Marketplace to that supplier's full range, keeping the running ballpark total visible"* — i.e.
stay in Marketplace. Tension: nav-to-store (spec; simple, route exists) vs an **in-place supplier
filter** (deck's ideal; keeps the running total + the "never auto-leave Marketplace" ethos). My
lean = the in-place filter if Marketplace supports a supplier filter, else nav-to-store as the
fallback. Liam to decide.

**Empty states (conditional-everywhere — QC a SPARSE supplier, not just Yahire):** no cover → a
neutral token placeholder band (the logo still needs something to overlap); no logo → a monogram/
initial avatar in the circular slot; no gallery → **hide "Past projects" entirely** (no empty
carousel); no description → hide the block; no website → hide the pill; no city → hide the line.
Never render an empty label or placeholder.

**Cover + logo overlap:** circular logo ~64–72px with a white ring (so it reads on any cover),
overlapping the cover's bottom-left at a fixed offset; the content below starts clear of the logo
overflow; on the no-cover placeholder the logo sits on the band. Don't let the overlap clip on
short/mobile viewports.

**Swipe mechanics:** touch-only (desktop uses the control + arrow keys — no mouse-drag);
**axis-lock on gesture start** so a horizontal pane-swipe doesn't fight the dialog body's vertical
scroll; commit on ~40–50% width OR a velocity flick, else snap back; `transition` on the
`translateX`, disabled during the active drag (follow the finger) and re-enabled on release;
respect `prefers-reduced-motion` (reduce/disable the slide).

**Mobile vs desktop:** desktop = segmented control primary, swipe optional, bounded `bp-modal`;
mobile = swipe primary + the control at the top (thumb-reachable) — reuse the dialog's existing
responsive/full-bleed behaviour; cover + carousels scale to width.

**Long description:** the Yahire write-up is long — **clamp it with a show-more** (reuse the
item-view show-more) so the website pill + "Past projects" gallery aren't buried under a wall of
text. Keep name/location/website ABOVE the description.

**Supplier pane order (recommended):** cover+logo → name + location → website
pill → description (clamped) → "Past projects" gallery → "View full store" (bottom).

**Accessibility:** proper tablist semantics (`role="tablist"/"tab"/"tabpanel"`, `aria-selected`,
`aria-controls`); focus the dialog on open + manage focus on pane switch; reduced-motion honoured.

**No "approved/verified" badge** (Liam, 2026-10-15): every marketplace supplier is approved by
default, so a badge announcing it is noise — dropped. (It was a Loveable-mockup artifact, not an ask.)

**"Source" removal is DISPLAY-only:** delete it from the item VIEW, but KEEP `attributes._source`
in the data — it's the extract dedup/identity key, not a user field.

## Acceptance
- Quick View opens on **Item details**; switching to **Supplier profile** works by BOTH the labelled control
  and swipe; closing returns to the same Marketplace search/filters/scroll.
- No "Source" field anywhere in the item view.
- Supplier pane shows Yahire's cover + logo + name + Hornsey + the full
  markdown description + website link + the 4 gallery images as "Past projects".
- "View full store" is a button (optional), never automatic.
- `supplier_directory` exposes `website`; the profile reads it.

## Out of scope / deferred
- Per-image cover treatments (**FR-00243**).
- Real past-projects / engagement data (future; "Past projects" = gallery images for now, per Liam).
- The duplicate suspended Yahire org cleanup.

## Decisions for Liam (lock before build)
1. **Switcher:** labelled segmented tabs **+** swipe (recommended + chat-endorsed), or keep the mockup's pills/dots too?
2. **Quick-View item image:** plain (recommended + chat-endorsed) or blurred-fill?
3. **"View full store":** navigate to `/suppliers/:id` (spec), or filter Marketplace to that supplier in-place (deck slide-7 preference, keeps the running ballpark total)? (chat flag)
