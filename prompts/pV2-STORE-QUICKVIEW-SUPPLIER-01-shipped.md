# pV2-STORE-QUICKVIEW-SUPPLIER-01 — two-page Quick View (Item + Supplier profile)

**Shipped:** 2026-10-15, chip `[Dev v2] v2.803`
**Branch:** `rebuild/org-slice` (v2dev)
**Commits:** `01184fdf` (feat: two-page Quick View — item + supplier-profile switch)

## What landed
- The marketplace Quick View is now a **two-page overlay** — "Item details" and
  "Supplier profile" — switchable by a labelled **segmented control** (reusing the
  global `.bp-projnav` pattern, white track / dark selected) **and** a horizontal
  **swipe** on touch. Both drive one `pane` signal; the panes live in a 200%-wide
  track that `translateX`-es between `0` and `-50%`, **auto-heighted to the active
  pane** via a `ResizeObserver` (short pane → no whitespace; tall pane → the dialog
  body scrolls; during a drag the track takes the taller of the two so the incoming
  pane isn't clipped mid-slide). Opening a new item **resets to Item**.
- Extracted the inline item carousel into a shared **`app-image-carousel`**
  (`shared/catalogue/image-carousel.component.ts`) — one pattern, two consumers: the
  item pane (`fit="contain"` on neutral, DECISION 2 — plain, whole product, no crop)
  and the supplier **"Past projects"** gallery (`fit="cover"`). Carries the
  variant-image jump (`jumpTo`) and the empty-state tile (`emptyIcon`).
- New **`app-supplier-profile-pane`** (`pages/marketplace/supplier-profile-pane.component.ts`)
  reads `GET /api/marketplace/suppliers/:id` via `resource()`: cover + overlapping
  circular **logo** (68px, white ring, **monogram** fallback), **name + city** (NO
  "approved/verified" badge), **website** link pill (opens new tab), **markdown
  description**, and **"Past projects"** gallery. Conditional-everywhere empty states
  (no cover → neutral band, no logo → monogram, no gallery → hide the block, no
  description/website/city → hide).
- Removed the navigate-away **"View supplier profile"** link (replaced by the
  switcher). The switcher **never routes**, so Marketplace stays mounted behind and
  closing (X / backdrop) restores the exact search / filters / scroll. **No "View
  full store"** button (deferred, Liam 2026-10-15).
- Server: `GET /api/marketplace/suppliers/:id` now **surfaces `website`** from
  `supplier_directory` (migration 0021 column) instead of nulling it.

## Files touched
| File | Lines (Δ) | Notes |
|---|---|---|
| client-v2/.../marketplace/quick-view-dialog.component.ts | ~+190 / -95 | Two-pane track + segmented control + swipe + a11y; carousel reuse; supplier pane mount; moved title/desc into the item pane; removed the navigate-away link. |
| client-v2/.../marketplace/supplier-profile-pane.component.ts | +230 (new) | Supplier profile pane (cover/logo/name/city/website/desc/gallery), empty states. |
| client-v2/.../shared/catalogue/image-carousel.component.ts | +100 (new) | Shared carousel extracted from the item cover (fit cover/contain, jumpTo, emptyIcon). |
| server/src/routes/marketplace-suppliers.js | +6 / -5 | Add `website` to the `/suppliers/:id` SELECT + response. |
| client-v2/src/environments/environment.ts | +2 / -2 | Chip bump v2.802 → v2.803. |

## Acceptance — verified
- Quick View opens on **Item details**; the segmented control AND swipe move to
  **Supplier profile** and back — ✓ (reset-to-Item effect on item change; pane signal
  driven by both inputs; `ng build` clean).
- Closing returns to the same Marketplace search/filters/scroll — ✓ (still a
  `p-dialog` overlay; the switcher uses no router — Marketplace is never destroyed).
- **No "Source" field** anywhere in the item view — ✓ (confirmed absent in our code;
  see Concerns — it was a Loveable-mockup artifact, nothing to remove; `attributes._source`
  left untouched).
- Supplier pane shows cover + logo + name + city + markdown description + website +
  gallery as "Past projects" — ✓ structurally (type `SupplierDetail` already carried
  `website`/`images`; server now populates `website`). **Pending Liam's visual QC
  against Yahire** (I don't screenshot-verify).
- No store navigation; switching panes never routes — ✓ (no `routerLink`/`router` in
  the supplier pane; the switcher is signal-only).
- `supplier_directory` exposes `website`; the profile reads it — ✓ (0021 applied live;
  endpoint SELECT + response updated).
- Build: `ng build --configuration development` → **exit 0, no errors/warnings**.
- Backend `GET /api/health` on :3002 → `ok` after the route edit.

## API audit checklist
#### `GET /api/marketplace/suppliers/:id` (modified — added `website` to the projection)
- ✓ HTTP method semantics — read-only GET.
- ✓ Input validation — `z.uuid()` on `:id` (400 on bad id), unchanged.
- ✓ Authorization — inherits `authenticate` + `requireActiveMembership` on the gated
  v2 router; cross-org read is via `supplier_directory` (owner-run, security_barrier,
  active-supplier-only) — base `orgs` is never joined. Unchanged.
- ✓ Status codes — 400 / 404 / 200, unchanged.
- ✓ Response shape — added `website` (string | null) to the existing object; client
  `SupplierDetail` already declared it. No breaking change to other consumers.
- ✓ Information disclosure — `website` is **public** supplier info (it's on the public
  profile); street address / phone / email remain nulled. No financial columns.
- ✓ Observability — errors go through `next(err)` as before.
- N/A Idempotency — read.
- ✓ Performance — one extra already-selected column on the existing view read; no new
  query/join.

## Concerns not in spec

### "Source" field was not present to remove
**Where:** item view (`quick-view-dialog.component.ts` + `item-attribute-cards.component.ts`)
**What:** The spec asks to remove an item-level "Source" field. A full search of the
item view (and the item editor) found **no** user-facing "Source" field — it was a
Loveable-mockup artifact, not something our code renders. Nothing was removed; the
dedup key `attributes._source` is untouched in the data as intended. Flagging so the
acceptance item "no Source field" is understood as "confirmed absent", not "deleted".
**Suggested fix:** none needed.
**Severity:** LOW

### Footer item-actions persist on the Supplier pane
**Where:** `quick-view-dialog.component.ts` footer (`pTemplate="footer"`)
**What:** The dialog footer (Qty / Add to ballpark / Edit / Approve-Reject / Close) is
shared across both panes, so it still shows the item's "Add to ballpark · £X" while
the Supplier profile is visible. Kept deliberately — the dialog is about one item and
its supplier, and a buyer reading the profile can still add without switching back. If
Liam prefers the footer to collapse to just "Close" on the supplier pane, it's a small
gate on `pane()`.
**Suggested fix:** deferred — needs a design call.
**Severity:** LOW

### Auto-height uses a ResizeObserver (not pure CSS)
**Where:** `quick-view-dialog.component.ts` (`trackH` + the ResizeObserver effect)
**What:** Two always-rendered sliding panes can't size a shared scroll container to the
active pane in CSS alone (the row takes the taller child → whitespace under the
shorter pane). I drive the track height to the active pane with a `ResizeObserver`
(guarded for no-RO environments). It handles desc-expand, attribute-card-expand, async
supplier load, and resize automatically. Robust, but it is JS layout rather than CSS.
**Suggested fix:** none — this is the standard "auto-height carousel" pattern.
**Severity:** LOW

### No backlog row for this prompt
**Where:** `prompts/backlog.md`
**What:** The prompt is `Status: DRAFT for Liam QC` and has **no row** in
`backlog.md` (it came straight from chat/the parent, not the Ready queue), so there was
nothing to flip to `Shipped`. Left the backlog untouched rather than invent a row.
**Suggested fix:** chat to add the row at audit time if it should be tracked there.
**Severity:** LOW

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in — leave the section header so chat finds it)
