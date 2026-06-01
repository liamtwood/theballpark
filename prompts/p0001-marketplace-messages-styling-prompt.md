# CC Prompt — Search panel + Messages styling pass

Two related styling changes. **Part 1** (search panel) is a cross-tab consistency change touching both the Marketplace and Messages. **Part 2** is the Messages-specific styling migration. A mockup of the finished Messages tab is attached — match it.

Bring everything onto the **v1.22 elevation system** already defined in `client-angular/src/styles.css`. Use existing tokens only — `--shadow-xs/sm/md`, `--border-hairline`, `--radius-card/button/pill/input`, `--theme-accent/bg/text/border/soft`, and the semantic `--color-action/waiting/quoted/booked` set. Do not add new tokens or hardcode shadows, radii, or hex colours.

**Icons — Lucide only.** Every icon is a Lucide icon via `lucide-angular`. Never Tabler or any other set. The attached mockup uses Lucide icons directly — use the exact names shown.

---

## Part 1 — Search becomes its own panel (Marketplace + Messages)

Search currently sits in different places on the two tabs (inside the Messages sidebar; bundled with controls on the Marketplace). Standardise it: **search gets its own dedicated contained panel** on both tabs.

**Files:**
- `client-angular/src/app/shared/components/catalogue-grid/catalogue-grid.component.ts` (Marketplace)
- `client-angular/src/app/shared/components/messages-inbox/messages-inbox.component.ts` (Messages)

**The panel.** A contained panel sitting directly **below the category-circles panel** and **above the three-column body**: `background: var(--color-surface)`, `border: var(--border-hairline)`, `border-radius: var(--radius-card)`, `box-shadow: var(--shadow-xs)`.

**Contents:** the search input only — full width of the panel.

The result count (`{n} items` / `{n} threads`) and the list / card / table view toggle **stay in the results/messages column header**, right-aligned next to the eyebrow label. Do not move them into the search panel.

**On Messages specifically:** the search input currently lives inside the left sidebar — remove it from there entirely. The sidebar becomes filter-only (see Part 2 §2).

**Placeholder copy stays scoped per tab:** Marketplace `Search 138 items…`; Messages `Search threads, suppliers, messages…`.

---

## Part 2 — Messages styling pass

Bring the Messages tab onto the elevation system and the Marketplace's layout pattern. End state: structurally identical to the Marketplace. Match the attached mockup.

**Files in scope:**
- `client-angular/src/app/shared/components/messages-inbox/messages-inbox.component.ts` — main work
- `client-angular/src/app/shared/components/cart-drawer/cart-drawer.component.ts` — source of the shared row card
- `client-angular/src/app/shared/components/category-circles/category-circles.component.ts` — confirm panel wrapping only
- `client-angular/src/styles.css` — global `bp-cat-body--detail` grid shell + tokens
- New shared component for the list-row card (see §3)

Messages currently uses **zero** elevation tokens — hardcoded `0 2px 6px` shadows and `10px / 20px / 6px` radii throughout — so this is a clean migration.

### 1. Layout — three stacked panels, then three columns

- **Category-circles panel** — existing `app-category-circles` row, wrapped in a contained panel.
- **Search panel** — per Part 1.
- **Three columns** via the global `bp-cat-body--detail` shell: Filter / Messages list / Conversation.

### 2. Panels — containment + sticky headers

Page ground behind the panels = `--theme-bg`. Every panel: `background: var(--color-surface)`, `border: var(--border-hairline)`, `border-radius: var(--radius-card)`, `box-shadow: var(--shadow-xs)`.

Each column panel is a **flex column** with a fixed header and an independently scrolling body:
- **Header strip** — small leading Lucide icon + eyebrow label in `--theme-text`, `flex-shrink: 0`, bottom `--border-hairline` divider. It must **not** scroll. Header icons: `list-filter` (Filter), `inbox` (Messages) / `package` (Marketplace Results), `clipboard-list` (Project Summary). The conversation panel keeps its category icon. Every panel header carries an icon — no bare-text headers.
- **Body** — `flex: 1; overflow-y: auto`. The scrollbar is confined to the body; it must not run under or move the header, and must not break the panel's top corner radius.

This is the same sticky-header / scroll-containment fix already requested for the Marketplace's FILTER / RESULTS / SUMMARY panels — apply the identical pattern here.

### 3. Shared list-row card — extract from the cart drawer

The cart drawer's `bp-cd-row` is the canonical list-row card: flat, `--border-hairline`, small radius, leading rounded-square visual + text block + trailing element + hover-revealed actions, hover background-shift, **no shadow**.

- Extract it into a shared primitive — `shared/components/list-row/` (`<app-list-row>` or a `bp-list-row` class set) — migrated onto tokens: `--border-hairline`, `--radius-button` (replacing the hardcoded `6px`), no shadow. Slots: leading visual, text block, trailing element, hover-action cluster.
- Refactor `cart-drawer.component.ts` to consume it — look and behaviour unchanged.
- The Messages **list-view thread rows** consume it too: leading rounded-square avatar (initials), text block (supplier name + time / preview line / status badge + category), trailing unread dot. Active or unread row = `--theme-soft` background.

### 4. Two-tier card rule — document it

Grids and galleries (Marketplace result cards, category circles) are **elevated** — `--shadow-xs` at rest, `--shadow-sm` on hover. List rows (cart drawer, Messages threads) are **flat** — border only, hover background-shift. Add a short comment in `styles.css` near the elevation tokens stating this rule so future pages don't re-litigate it.

### 5. Conversation panel

Calm header (supplier + category — no saturated colour bar). The message-stream area keeps its nested tint ground (`--color-thread-bg`) — the one intentional nested tint. Message bubbles stay flat on the existing semantic colours (`--color-msg-read/out`, unread accent left-border); migrate their hardcoded `10px` radii to `--radius-button`.

### 6. Theme vs semantic split

Brand accents (active states, eyebrows, send button, circle rings, active row tint) use `--theme-*` tokens so they recolour with the admin preset. Status pills/badges (Action / Waiting / Quoted / Booked) stay on the semantic `--color-action/waiting/quoted/booked` tokens — they encode meaning, not brand, and must **not** shift with the theme.

---

## Verify

- Build and check the Messages tab in both project-bound mode and global mode (`global-messages.component.ts`).
- Scroll each column — headers stay fixed, scrollbars confined to the bodies, panel corner radius intact.
- Switch the theme preset Amber ↔ Pink — accents recolour, status badges stay put.
- Confirm the cart drawer looks and behaves identically after the row-card extraction.
- Confirm the search panel (search field only) renders on both tabs, and the count + view toggle remain in the results/messages header.
- Confirm every panel header has its Lucide icon, and that all icons are Lucide (no Tabler or other sets introduced).
- Confirm no hardcoded shadow / radius / hex values remain in the touched component styles.

Styling and structural-layout only — do not change data flow, thread logic, or search behaviour. Ask if the row-card extraction surfaces anything unexpected in the cart drawer.
