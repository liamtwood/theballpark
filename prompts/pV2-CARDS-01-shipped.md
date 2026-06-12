# pV2-CARDS-01 — `.bp-card` chrome extraction + item/supplier card restyle + RP-07 guard

**Shipped:** 2026-06-12, chips `[Dev v2] v2.20a` (server data) + `v2.20b` (chrome + restyles)
**Commits:** `38bc493` (items payload supplierCity + categoryName), `5ad3292` (cards extraction + restyles + guard)

## What landed

- **styles.css §Cards (new)**: `.bp-card` foundation per the CARDS.md locked spec (surface/hairline/radius-card/shadow-xs, hover lift −2px→shadow-md, focus ring, `--selected` accent ring) + `--zoom` (0.4s image scale 1.04) + **`--lifted`** (md-rest/lg-hover — preserves the launcher tile's locked pV2-04b2 Figma look as a modifier instead of component-local chrome). One addition over the doc spec: `position: relative` on the base, so overlays (`.bp-fav-btn`, future badges) anchor without per-component CSS.
- **Sub-primitives**: `.bp-tag-chip` (per PILLS.md spec), `.bp-price-large` (2xl, gradient `background-clip: text`), `.bp-ref-eyebrow`, `.bp-icon-block` (promoted from launcher-tile's inline definition; size is layout — consumers set w/h).
- **`.bp-btn-grad--added`** (BUTTONS.md two-state twin): muted grey body, white text, no glow. Written as LONGHANDS — `background: var(--x)` over the gradient base computes invalid-at-computed-value time and resets every background longhand to transparent (found in preview; probe-verified fix).
- **Item card per image 2**: name (semibold), category `.bp-tag-chip`, `From £N` gradient price (+ muted `/ unit`; "Price on request" when null), pin + city row (falls back to supplier name when city missing), full-width foot CTA `Add to favourites ↔ Added to favourites` (Plus↔Check icons; stopPropagation so the host click still selects). Chrome moved OFF `:host` styles onto `bp-card bp-card--zoom` host classes — the file that motivated RP-07 is its first compliance.
- **Supplier card per image 3**: brand hero, name, pin + city + item-count row, full-width gradient `View supplier` CTA rendered as a span inside the existing card-link (one tab stop preserved), heart overlay unchanged. Logo-letter dropped from the CARD (the hero is the brand); `.bp-supplier-card__logo` stays global — supplier-grid / storefront-panel / category-summary list rows still consume it.
- **Launcher tile**: host now `bp-card bp-card--lifted`; icon block consumes global `.bp-icon-block h-16 w-16`. Its inline chrome + icon-block CSS deleted — only layout (link column, paddings, type-display) remains.
- **RP-07 style guard**: any component declaring `border-radius: var(--radius-card)` or `box-shadow: var(--shadow-*)` in its styles fails the build. No allowlist needed — zero violations after the refactors. Plant-fail-revert drilled.
- **Icons**: Plus + ArrowRight registered.
- **409 nit from the prompt**: already shipped in v2.19b (predated the relay) — no-op.

## Files touched

| File | Lines (Δ) | SHA | Notes |
|---|---|---|---|
| server/src/routes/marketplace.js | +4 / -2 | 38bc493 | LEFT JOIN categories; supplier_city + category_name on items |
| client-v2/.../catalogue.types.ts | +4 | 38bc493 | supplierCity + categoryName on CatalogueItem |
| client-v2/src/styles.css | +110 / -32 | 5ad3292 | §Cards foundation + sub-primitives + --added; supplier-card chrome deleted (now .bp-card) |
| client-v2/.../item-card.component.ts | +35 / -30 | 5ad3292 | image-2 restyle; :host chrome deleted |
| client-v2/.../supplier-card.component.ts | +12 / -10 | 5ad3292 | image-3 restyle; logo-letter off the card |
| client-v2/.../launcher-tile.component.ts | +6 / -35 | 5ad3292 | .bp-card--lifted + .bp-icon-block |
| client-v2/scripts/check-style-guards.js | +12 | 5ad3292 | RP-07 check |
| client-v2/src/app/app.config.ts | +3 | 5ad3292 | Plus, ArrowRight |

## Acceptance

- One-definition rule — ✓ zero card-chrome declarations left in component styles (RP-07 guard green; drill verified it catches a planted violation and passes clean after revert)
- Item card per image 2 — ✓ preview: chip "Graphics & Signage", "From £320" gradient price, pin row, full-width CTA; two-state verified (click → "Added to favourites" + muted class + heart overlay syncs; click again reverts). Muted bg color probe-verified `#9ca3af` (the live click-path read shows transparent ONLY because hidden preview tabs freeze CSS transitions at their start value — known environment limit, renders correctly in a real browser).
- Supplier card per image 3 — ✓ preview: name, pin+city+count, "View supplier" CTA, heart, logo-letter gone
- Launcher tile — ✓ preview: `bp-card--lifted` host, md rest shadow, 64px icon block with the `--theme-soft` gradient wash (computed live)
- Greens — ✓ build / lint / style-guard (incl. new RP-07) / 67/67 client tests; server untouched by tests (4-line query change), 48/48 still green

## API audit checklist (Rule 10)

#### `GET /api/marketplace/items` (modified — projection only)
- ✓ Same gated route, same Zod-validated filters, same pagination envelope / ✓ LEFT JOIN categories adds no round trip and can't drop rows / ✓ supplier_city from the EXISTING orgs join / ✓ no new input surface / ✓ camelCase mapping extended

## Concerns not in spec

### Two favourite affordances on the item card
**Where:** item-card — heart overlay + the foot CTA both toggle favourites.
**What:** Interim by design (prompt: CTA wires to favourites until 06f's quote CTA). Until then the card carries two controls doing the same thing with different labels ("Add favourite" aria vs "Add to favourites" CTA).
**Suggested fix:** none now — 06f repurposes the CTA to Add-to-Quote and the duplication dissolves.
**Severity:** LOW

### `/ unit` and "Price on request" are CC additions over image 2
**Where:** item-card price row.
**What:** Image 2 shows only "From £2,000". I kept the muted `/ unit` suffix (data utility — a £320 "per head" vs "per event" price is meaningless without it) and added a "Price on request" fallback for null prices (the old card just showed nothing). Flagging because visual decisions belong to the spec — easy to strip at QC if unwanted.
**Severity:** LOW

### Supplier-card CTA is a non-interactive span inside the card link
**Where:** supplier-card template.
**What:** The whole card was already the link (v1 parity, one tab stop). Making the CTA a real nested link/button would create nested-interactive a11y problems. The span renders the button visual; the link carries navigation + aria-label.
**Severity:** LOW (deliberate)

### `--theme-soft` is a gradient, not a color
**Where:** styles.css `.bp-icon-block` / anywhere `background: var(--theme-soft)` appears.
**What:** Works as background shorthand (lands on background-image) but would silently fail as `background-color`. Same class of trap as the `--added` shorthand bug fixed this ship. Worth a one-line comment at the token definition during the styling pass.
**Severity:** LOW

### Marketplace tier filter still hardcoded
Carried from CODELISTS-02 (RP-04 closed row notes it): `items.tier` enum gets an `item_tier` codelist when the /store arc touches items. No change this ship.

## Iteration — v2.20c (2026-06-12)
**Triggered by QC:** items 1–3 of Liam's five-point pass (item-card itself ✓ against the image-2 element table)
**Commit:** `fc61dd0`
- **QC 1** — item-preview rail mirrors the card's price treatment (`From` + `.bp-price-large` gradient + `/ unit`; "Price on request" fallback). One template edit, same primitive.
- **QC 2** — portrait card: `.bp-item-card__img` fixed 132px → `aspect-ratio: 4/3` (hero scales with column width). At desktop: card 273×399 (1.46 h/w), hero 51% of card — image-2 proportions.
- **QC 3** — chip shows the SUBCATEGORY: items query joins `categories sc` on `subcategory_id` → `subcategoryName` in the payload; the chip binds `subcategoryName ?? categoryName` (defensive fallback). Preview: "Print & Stationery" / "Branded Merchandise".
- **QC 4** — home unchanged ✓ (no action).

## Iteration — v2.20d (2026-06-12)
**Triggered by QC:** item 5 — storefront subcat-card grid. The reference image already existed: CARDS.md maps "Storefront cell" to **image 7 (Bar Service)** in bp-cards.docx — no need to wait.
**Commit:** chip v2.20d
- **Server**: `GET /api/marketplace/suppliers/:id/subcategories` → `{ id, name, parentId, count, coverUrl }` — one row per subcat the supplier has live items in; `coverUrl` = the first non-null `image_url` for that supplier+subcat (correlated subquery, same active/approved filters as the browse). `parentId` lets the client drill cat+sub in one navigation.
- **`<app-subcat-card>`** (new, shared/catalogue): `.bp-card .bp-card--zoom` + cover (or soft empty block) + name + "N items" per image 7. Emits; the shell owns navigation.
- **Storefront panel**: the generic category chip-list REPLACED by the grid (2/3/4-up responsive, spans both panel columns under brand+contact). Old `categorySelected` output retired.
- **Shell**: `subcats` resource (session-cached service read) + `openStoreSubcat()` → `?tab=store&cat=<parent>&sub=<id>` — the URL-is-state store picks both up.
- Verified in preview: 7 cards for Construct & Co. (covers where images exist), click drills to the Store tab pre-filtered (`sub` param set). Build/lint/guard green, 67/67.

## Iteration — v2.20e (2026-06-12)
**Triggered by QC:** corrected storefront spec + screenshot reference (`screenshots/Screenshot 2026-06-12 151027.png`) — the flat grid was wrong; v1 shows subcat cards GROUPED per category. Cards themselves accepted as-built.
**Commit:** chip v2.20e
- **Grouping**: one group per category the supplier sells in — folder icon + uppercase accent header (`.bp-ref-eyebrow`) + right-aligned "N categories" counter, mini-card grid beneath. Only cats/subcats with live items (supplier.categories was already items-only; groups with zero cards filtered).
- **Catch-all card**: the screenshot's "Catering / 3 items" card is the supplier's items WITH a category but NO subcat — the endpoint now UNIONs a per-category catch-all row (`isCatchAll`, carries the category's own name/id + first-item cover). Drills cat-only (`sub=null`); real subcat cards drill cat+sub.
- Verified live: Rocket Food returns the screenshot's exact data — Catering group, 8 rows incl. "Catering (3)" catch-all; Construct & Co. renders the grouped header + 7 cards.
- For chat: per your note, this archetype REPLACES "Storefront cell" in CARDS.md with the screenshot as canonical reference — leaving that doc edit to you at the styling-pass fold-in.

## Iteration — v2.20g (2026-06-12)
**Triggered by QC:** laptop screenshot (`Screenshot 2026-06-12 152623.png`) — cards clipped at the viewport edge, no column scroll, right rail squeezing the grid, cat rail running past the fold. Chat's intent spec: "page never scrolls; columns do; rails responsive."
**Commit:** chip v2.20g
- **`.bp-vpfit`** (styles.css, md+ only): the page fills the viewport exactly (`100dvh` minus the shell's 8rem chrome) — hero + filter band stay anchored; `.bp-page-body` becomes the flex column that hands remaining height to the layout. Mobile keeps natural page scroll.
- **catalogue-layout** (one definition, both consumers): each region wraps in its own `min-h-0 overflow-y-auto` scroller — left rail, middle grid, right rail scroll independently. Responsive: mobile (<md) single column with NO rails (full marketplace becomes a list); right rail 260px at xl (laptop), 300px at 2xl (wide).
- **Consumers**: /marketplace is always viewport-fit; supplier-detail applies it ONLY on the Store tab (the Storefront's grouped grids scroll naturally — RP-06 both-surfaces rule held with one class binding).
- Verified live at 1280×800 (page never scrolls; strip + middle columns scroll internally; rail 260px), 375×812 (single column, rails hidden, natural scroll, vpfit off), 1536×864 (store tab vpfit on / storefront tab natural).
- The "small fixes ride the same ship" note: price prefix / card height / subcat chip had already landed in v2.20c.

## Iteration — v2.20h (2026-06-12)
**Triggered by QC:** v2.20g better but still "a huge amount of white space" (`Screenshot 2026-06-12 154233.png`) — the vertical chrome (shell paddings + standard hero + body paddings) ate ~half a laptop screen before content.
**Commit:** chip v2.20h
- Compression SCOPED to `.bp-vpfit` pages — settings/profile keep the standard rhythm: hero padding 28/24 → 12/12 + tighter row gap (type ranks untouched); page-body padding 32 → 16/24/20; search row mb-5 → mb-4.
- Shell bottom padding pb-12 → pb-6 (all pages; the vpfit height calc updated to 6.5rem) — reclaims the dead bottom band.
- Measured at 1280×800: middle column 389 → 479px (+90), hero 170 → 125px, first card row fully visible, page still never scrolls.

## Iteration — v2.20i (2026-06-12)
**Triggered by QC:** the supplier Store tab is missing the search bar + filters. Not a regression — the band was only ever built inline on marketplace-page (the textbook RP-06 shape: store-fed UI on one consumer).
**Commit:** chip v2.20i
- **`<app-catalogue-filter-band>` extracted** (shared/catalogue): search + price/tier selects + clear + view toggle, injecting the page's route-scoped MarketplaceStore. Mounted by BOTH consumers per the standing RP-06 rule — marketplace with `[showSupplier]="true"`, the pinned Store tab without (a supplier filter is meaningless when pinned).
- marketplace-page sheds the inline band + three option arrays; the Store tab's lone view-toggle row retired (the band carries it).
- Verified live: Store tab search filters the pinned store (`q=bar` → 1 item, URL param set), 2 selects + toggle; marketplace unchanged (search + 3 selects + toggle, 48 cards).

## Iteration — v2.20j (2026-06-12)
**Triggered by:** chat's three card-foot tweaks.
**Commit:** chip v2.20j
- Item-card CTA labelled **"Add to Quote" ↔ "Added to Quote"** — TRANSITIONAL comment in the template: the wire stays favourites until pV2-06f lands the quote flow (the heart overlay remains the explicit favourites affordance).
- `.bp-cta-foot` modifier (styles.css): card-foot brand CTA drops to `--text-sm` (12px) + 8/16 padding; icon 14.
- `.bp-tag-chip` → `--text-sm` (12px) globally. Convergence comments on BOTH rules: the 12px rank is deliberate (proportional weight against `.bp-price-large`) — keep the two in step.
- Verified live: label, 12px/8-16 CTA, 12px chip.

## Iteration — v2.20k (2026-06-12)
**Triggered by QC:** dropdown rounding off vs the search bar on both pages.
**Commit:** chip v2.20k
- New **`--radius-field`** token, aliased to `--radius-pill` (chat's lean: anchor to the search bar — the most prominent control on /marketplace). One token, three consumers: the search box, `.bp-fld`, and the p-select/p-inputnumber triggers all ride it — the value changes in ONE place if the family ever moves off pill.
- `.bp-fld` horizontal padding 10 → 12px so text clears the pill curve (view + edit share the class — the zero-shift law holds, both states moved identically).
- Verified live: search + select triggers both compute 999px.
- FIELDS.md doc capture queued (chat's, post-freeze): name search + .bp-fld + p-select as one family with the shared radius/padding/focus-ring contract.

## Iteration — v2.20l (2026-06-12)
**Triggered by:** Liam's idea — in card view the cards ARE the preview; the right rail only earns its width over list/table rows.
**Commit:** chip v2.20l
- catalogue-layout now injects the page's route-scoped MarketplaceStore and drops the rail region entirely when `viewMode() === 'card'` — the grid template loses the third column so the middle takes the freed width. List + table keep the rail. Both consumers inherit (shared shell — no per-page wiring).
- Verified live at desktop: card view rail gone, middle 666 → 950px; list view rail returns; toggling back hides it again.
- Note: card-view clicks still SELECT (ring shows; state kept in the URL) — switching to list/table after selecting shows that item in the rail. Felt right to keep selection state consistent across view modes.

## Iteration — v2.20m (2026-06-12)
**Triggered by:** Liam — user-resizable left strip ("increasing the width may help (oddly); a nice feature anyway"). Also noted for 06f: in card view a card click will open the DETAIL view (the rail stays a list/table affordance).
**Commit:** chip v2.20m
- Drag handle on the strip's right edge: 160–400px clamp, double-click resets to 210, width persisted per browser (localStorage; falls back to session-local when storage is unavailable). The grid columns ride a `--bp-strip-w` CSS var so all breakpoint variants follow the drag.
- Shared shell — marketplace + supplier Store tab both resizable, one persisted width across them.
- Verified live: drag +80 → 210→290, persisted, double-click reset → 210.

## Iteration — v2.20n (2026-06-12)
**Triggered by QC:** the fold pass — "whole item card above the fold at laptop" (screenshots 172644/172732: CTA cut off at 1280×800; subcat rows reading too heavy next to a widened rail).
**Commit:** chip v2.20n
- **Subcat rows denser**: 4px vertical padding (26px rows vs 34px parents), already 12px — visually subordinate + more rail rows unscrolled.
- **Hero + search rhythm**: vpfit hero 12→10 padding + gap 6→4; vpfit body top 16→12 / bottom 20→16; band margin mb-4→mb-3; search box 38→34px (matches the band's selects — one control rhythm).
- **2xl goes 4-up** in the card grid — the rail is hidden in card view, so the wide middle would otherwise stretch cards past the fold. (At xl the 3-up + rhythm savings suffice.)
- **FOLD GOAL MET**, measured at 1280×800 card view: whole card (image → name → chip → price → Add to Quote) above the fold with 104px to spare (card 408px in a 497px column). Both engine consumers inherit everything (shared shell/band/grid — RP-06).

## Iteration — v2.20o (2026-06-12)
**Triggered by:** Liam — retire the floating version footer; show the chip in the user menu above Sign out.
**Commit:** chip v2.20o
- `<app-version-chip>` (fixed bottom-right) DELETED; the chip now renders as a quiet `bp-meta` line in the user-menu popover, directly above Sign out. The footer was also fighting the viewport-fit pages for the bottom edge.
- TRADE-OFF noted: the chip no longer shows on full-bleed pages (login/callback) — it lived at root precisely for those. If build identity on login matters for QC screenshots, say so and it can return there only.
- Verified live: footer gone, "[Dev v2] v2.20n" above Sign out in the menu.

## Iteration — v2.20p (2026-06-12)
**Triggered by QC:** "the version is gone but there is still a footer" (`Screenshot 2026-06-12 174223.png`) — the remaining bottom band was the padding stack: shell pb-6 (24px) + vpfit body bottom 16px = 40px reading as a footer.
**Commit:** chip v2.20p
- Shell bottom padding pb-6 → pb-2; vpfit body bottom 16 → 8; height calc updated to 5.5rem. Bottom band 44 → 16px (breathing room, not a footer); columns +24px (497 → 521 at 1280×800); page still never scrolls.

## QC notes
(Liam, 2026-06-12, relayed via CC) Marketplace item card matches the image-2 spec element-by-element (cover/name/chip/price/pin/CTA/heart all ✓). Asked for: preview-rail price parity (1), taller portrait cards (2), subcat in the chip (3) — all landed in v2.20c; storefront subcat-card grid (5) landed in v2.20d, regrouped per category + catch-all in v2.20e per the screenshot reference.

(Liam, 2026-06-12, post-v2.20c) Card height + subcat chip confirmed — **look great**.

(Liam, 2026-06-12, post-v2.20e) Grouped storefront "brilliant"; the click-through to the right subcat in the Store was a nice surprise (v1 didn't do that). One issue: Back from the Store went to /marketplace instead of the Storefront. → fixed v2.20f.

(Liam, 2026-06-12, post-v2.20f) Back confirmed — Storefront → Store (subcat) → back to Storefront works well. v2.20g laptop layout pass QC in progress.

## Iteration — v2.20f (2026-06-12)
**Triggered by QC:** Back from the Store tab skipped the Storefront.
**Commit:** chip v2.20f
- Hero back is now computed — it walks the drill in reverse: Store → "Storefront" (same route; the hero's plain routerLink clears the tab/cat/sub params) → "Marketplace". Verified live end-to-end: labels flip per tab, back from Store lands on the Storefront tab.

## Chat audit
(chat fills this in — leave the section header so chat finds it)
