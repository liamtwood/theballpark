# pV2-MEDIA-01d — org profile media (logo + cover + gallery) → supplier card

**Shipped:** 2026-06-20, chip `[Dev v2] v2.32g`
**Commit:** `<pending>`

Mounts the media picker + gallery on the **org Profile** (the org's own
edit surface) and wires the org cover to the **supplier card** image — the
simplified version Liam asked for ("just upload logo or cover like v1 + gallery",
no focal/attribution columns on orgs).

## What landed
- **Profile page** (`/settings/profile`) — new **Branding** card (Cover + Logo
  previews, each with an Edit drawer) + **Gallery** card. Edit affordances gate
  on `canEdit` (`org.manage_billing`, same as the rest of the profile); media
  saves immediately (not via the section pencils).
- **Supplier card uses the org cover for free** — `marketplace.js` already maps
  `coverUrl ← orgs.cover_image_url`, so a supplier setting their profile cover
  becomes their card image. No card changes needed.
- **Picker `focalStep` input** — logo/cover skip the focal-point step ("just
  upload"); the project cover keeps it (default true).
- **Gallery `editable` input** — view-only mode (no add tiles / hover actions /
  drag) for non-admins viewing a profile.
- **Schema:** one new column — `orgs.images JSONB`. `logo_url` /
  `cover_image_url` / `image_display` already existed.

## Files touched
| File | Notes |
|---|---|
| `server/src/db/migrate-schemas.js` | `orgs.images JSONB` (public/preview/master) |
| `server/src/schemas/organisation.schema.js` | `logoUrl` / `coverImageUrl` / `images` on the PUT schema |
| `server/src/routes/organisation.js` | SELECT + toProfile + PUT (images `$n::jsonb`) |
| `client-v2/src/app/core/organisation.service.ts` | `OrgProfile` media fields |
| `client-v2/src/app/shared/image-picker/image-picker.component.ts` | `focalStep` input |
| `client-v2/src/app/shared/image-gallery/image-gallery.component.ts` | `editable` input |
| `client-v2/src/app/pages/settings/profile/profile.component.ts` | Branding + Gallery cards, drawers, handlers |

## API audit — `PUT /api/organisation` (extended)
- ✓ Input validation — `logoUrl`/`coverImageUrl` ≤1000 nullable; `images` Zod array (max 20).
- ✓ Authorization — unchanged: `requireActiveMembership('org.manage_billing')`; org from `req.user.org_id`, never body.
- ✓ SQL — explicit column allowlist; `images` bound `$n::jsonb` (not concatenated).
- ✓ Response — `toProfile` returns `logoUrl`/`coverImageUrl`/`images` (`[]` when null).

## Verification (dev-login, real Profile tab)
- Branding (Cover + Logo + 2 Edit buttons via canEdit) + Gallery (5 "+" tiles) render; org loads with media; no error.
- `PUT /api/organisation` round-trip: **200**, cover/logo/images persisted + returned; reset to clean (no test data left).
- Supplier-card mapping confirmed in code (`marketplace.js:303`).

## Deploy prerequisite (when promoting)
`orgs.images` must be migrated to preview/prod first (`npm run db:migrate:schemas`). Local column added for QC.

## Concerns not in spec
### Branding edit gated on `org.manage_billing`
**Where:** profile PUT gate. Media edits ride the existing profile-PUT permission (org admins). If logo/cover should be editable by a broader role, that's a permission change — flagging, not changing.
**Severity:** LOW.

### Supplier *shopfront* (public supplier-detail) gallery display not included
**Where:** `supplier-detail.component.ts` Storefront tab.
**What:** This slice does the org's *editing* surface (profile) + the *card* image. Showing the org gallery read-only on the public supplier-detail page is a separate display task (future 01e display) — not requested here.
**Severity:** LOW (out of scope).

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in)
