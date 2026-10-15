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
- Supplier name + **"Approved Ballpark supplier"** badge (derive from being an active supplier — any org in
  `supplier_directory` qualifies) + **location** (city).
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

## Acceptance
- Quick View opens on **Item details**; switching to **Supplier profile** works by BOTH the labelled control
  and swipe; closing returns to the same Marketplace search/filters/scroll.
- No "Source" field anywhere in the item view.
- Supplier pane shows Yahire's cover + logo + name + "Approved Ballpark supplier" + Hornsey + the full
  markdown description + website link + the 4 gallery images as "Past projects".
- "View full store" is a button (optional), never automatic.
- `supplier_directory` exposes `website`; the profile reads it.

## Out of scope / deferred
- Per-image cover treatments (**FR-00243**).
- Real past-projects / engagement data (future; "Past projects" = gallery images for now, per Liam).
- The duplicate suspended Yahire org cleanup.

## Decisions for Liam (lock before build)
1. **Switcher:** labelled segmented tabs **+** swipe (recommended), or keep the mockup's pills/dots too?
2. **Quick-View item image:** plain (recommended) or blurred-fill?
