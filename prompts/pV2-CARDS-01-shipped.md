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

## QC notes
(Liam, 2026-06-12, relayed via CC) Marketplace item card matches the image-2 spec element-by-element (cover/name/chip/price/pin/CTA/heart all ✓). Asked for: preview-rail price parity (1), taller portrait cards (2), subcat in the chip (3) — all landed in v2.20c; storefront subcat-card grid (5) landed in v2.20d, regrouped per category + catch-all in v2.20e per the screenshot reference.

(Liam, 2026-06-12, post-v2.20c) Card height + subcat chip confirmed — **look great**.

## Chat audit
(chat fills this in — leave the section header so chat finds it)
