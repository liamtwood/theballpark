# pV2-MEDIA-01e — supplier shopfront renders the profile media in view-mode

**Shipped:** 2026-06-22, chip `[Dev v2] v2.32h`
**Commit:** `<pending>`

The supplier shopfront (`/suppliers/:id` Storefront tab) now shows the org's
cover, logo, and portfolio gallery using the **same component** the owner edits
on `/settings/profile` — rendered read-only. Path (a) from the prompt: extract,
don't fork. View mode is a render flag; only edit affordances toggle.

## What landed
- **New `<app-org-media mode="edit|view">`** ([shared/org-media](../client-v2/src/app/shared/org-media/org-media.component.ts)) —
  a faithful extraction of profile's Branding (cover + logo) + Gallery markup.
  Fields passed individually (`name`/`coverUrl`/`logoUrl`/`images`) so either
  consumer's DTO shape feeds it. `edit` mode shows "No …" placeholders + Edit
  buttons (gated by `canEdit`) + an editable gallery; `view` mode renders only
  **populated** media (no placeholders, no buttons) with a read-only gallery.
- **Profile** now mounts `<app-org-media mode="edit">` in place of its inline
  Branding + Gallery blocks; the picker drawers + persistence stay local (wired
  via `editCover`/`editLogo`/`imagesChange`/`primarySet` outputs). Company
  Information + Financial defaults untouched.
- **Storefront panel** mounts `<app-org-media mode="view">` spanning both
  columns above the existing brand/contact/subcat content.
- **Server:** `GET /api/marketplace/suppliers/:id` now projects `images`
  (cover/logo were already projected; financial columns still NEVER are).
- **Type:** `SupplierDetail.images: GalleryImage[]` added.

## Files touched
| File | Notes |
|---|---|
| `client-v2/src/app/shared/org-media/org-media.component.ts` | NEW — shared edit/view media component |
| `client-v2/src/app/pages/settings/profile/profile.component.ts` | swap inline Branding+Gallery → `<app-org-media mode="edit">`; drop now-unused `ImageGalleryComponent` import |
| `client-v2/src/app/pages/suppliers/storefront-panel.component.ts` | mount `<app-org-media mode="view">` |
| `client-v2/src/app/shared/catalogue/catalogue.types.ts` | `SupplierDetail.images` + `GalleryImage` import |
| `server/src/routes/marketplace.js` | `images` in the `/suppliers/:id` SELECT + projection |
| `client-v2/src/environments/environment.ts` | chip → v2.32h |
| `docs/MEDIA.md` | version history brought current (01c/01d/01e) |

## Acceptance — 5 / 5 verified (dev-login, real pages)
- `/suppliers/:id` renders cover + logo + portfolio gallery via the profile layout — ✓ (6 imgs loaded: cover + logo + 4 gallery)
- View mode hides all edit affordances — ✓ (0 Edit buttons, 0 add tiles, 0 hover actions)
- Existing shopfront chrome intact (back, favourite, Storefront/Store toggle, categories, items) — ✓ (untouched; only added a section above the panel content)
- Profile edit mode still works — ✓ (Branding+Gallery render, Edit→picker drawer opens, gallery editable, Company Info + Financial defaults present)
- Build + typecheck green — ✓ (`ng build` clean, 10.7s)

## API audit checklist — `GET /api/marketplace/suppliers/:id` (modified: added `images`)
- ✓ HTTP method semantics — GET, read-only.
- ✓ Input validation — `z.uuid()` on `:id` (unchanged); 400 on invalid.
- ✓ Authorization — marketplace read surface (mounted behind the v2 authenticated router); no org-scoped data returned.
- ✓ Status codes — 400 invalid id / 404 not-a-supplier / 200 ok (unchanged).
- ✓ Response shape — additive: new `images` array; existing fields unchanged.
- ✓ Information disclosure — **financial columns still never selected**; `images` is public portfolio media the owner curated. No new leak.
- ✓ SQL — `images` added to an existing parameterised SELECT; no interpolation.
- ✓ Observability — `next(err)` unchanged.
- N/A Idempotency — read.
- ✓ Performance — same single-row fetch; `images` is one jsonb column, no extra round-trip.

## Concerns not in spec
### Logo appears twice on the storefront
**Where:** `storefront-panel.component.ts` — the `<app-org-media>` Logo card + the brand panel's initial-letter avatar.
**What:** In view mode the org-media Branding card shows the logo image, while the brand panel below still shows the first-initial avatar. Both render. Matches the prompt's "show the same fields as profile," but the logo is visually duplicated.
**Suggested fix:** Optionally collapse — have the brand panel use the logo image when present (initial as fallback), or drop the logo from the view-mode Branding card. Deferred — needs a visual call from Liam at QC.
**Severity:** LOW.

### Cover renders as a small preview box, not a hero banner
**Where:** `org-media.component.ts` — `.bp-media-preview`.
**What:** The shopfront cover uses the same small preview box as the profile editor (consistency by design). A public shopfront might want a wide banner treatment.
**Suggested fix:** A `coverVariant` input ('preview' | 'banner') if Liam wants the shopfront cover larger. Deferred — design call.
**Severity:** LOW.

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in)
