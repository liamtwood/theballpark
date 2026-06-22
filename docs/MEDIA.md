# Branding & Media — image/icon decoration + gallery + completeness

One-pager. Covers the shared media management feature set — single
cover/icon, multi-image gallery, and per-entity completeness — that
mounts on every entity in the platform that has a "face" (project, item,
supplier shopfront, profile, and future consumers).

Reference designs: `screenshots/Screenshot 2026-06-15 084417.png`
(Branding card + completeness on profile),
`screenshots/Screenshot 2026-06-15 084713.png` (Hero Gallery — multi-image).

## What it is

A three-component primitive family that consolidates how any entity gets
"decorated" with imagery:

1. **`<app-drawer>`** — generic right-side slide-in panel (not media-specific, but the surface treatment the picker mounts in)
2. **`<app-image-picker>`** — single image/icon chooser with three sources (My File / Unsplash / Lucide icon), mounted inside the drawer
3. **`<app-image-gallery>`** — multi-image grid that uses the picker to add slots, supports reorder + primary selection

Plus a separate-but-related component:

4. **`<app-completeness-card>`** — per-entity weighted "% complete" indicator with suggested-action deep-links into the picker / gallery / editors

All four are shared primitives. One definition each, N consumers, no
per-entity duplication. This is the same primitive-consolidation pattern
locked across catalogue-layout (3 consumers), status-pill (everywhere),
quote-view (2 consumers).

## Why we needed it

Every entity in the platform has a "face" — projects have cover photos,
items have images, suppliers have shopfronts, profiles have avatars. v1
solved each surface ad-hoc: project cover via modal, item image via
inline upload, supplier logo via separate flow, profile avatar yet
another path. Result: four divergent UXs, four duplicate code paths,
inconsistent UX.

v2 consolidates: one picker, one gallery, one completeness pattern, all
parameterised by `entityType`. Adding the picker to a fifth surface
later (categories, clients, team avatars, dashboards) becomes a single
mount — not a new feature build.

It also closes three known v1 limitations worth lifting:

- **Unsplash had a fixed pool, no search "more"** — v2 paginates the
  existing `/api/unsplash/search` proxy. Search any term, browse any
  result.
- **Lucide icons were a curated subset** — v2 lazy-loads the full
  library in a separate chunk; main bundle stays lean, picker has all
  ~1500 icons searchable on demand.
- **Cover images cropped without user control** — v2 adds a
  click-to-set focal-point picker. Image still uses `object-fit:
  cover` (no full cropping UI) but the crop anchors where the user
  clicked, not always center. Solves the "important content cropped
  out" problem at one-extra-click cost.

## Who can use it

Anyone with edit rights on the consuming entity. The picker itself has
no permissions; the consumer enforces (e.g. project edit requires
`project.edit`, item edit requires `item.edit`). Read consumers (anyone
viewing the entity) see the rendered cover/icon/gallery but no picker
controls.

## The components

### `<app-drawer>` (generic primitive)

```
host: right-anchored panel
  desktop: 480–600px wide
  mobile (<md): full-screen
  slide-in animation (200ms ease-out)
  backdrop dim (clickable-to-dismiss, configurable)
  ESC dismiss
  focus trap (a11y)
  scroll lock on body when open
```

Slots: `[header]`, default (body), `[footer]`. Header gets a close
button by default; consumer can override.

NOT media-specific — first consumer is the image picker, but future
consumers include filter drawers, settings panels, advanced search.
Lives in shared primitives, not under media.

### `<app-image-picker>` (3-tab single-image chooser)

Mounts inside `<app-drawer>`. Three tabs:

| Tab | What it does | Source |
|---|---|---|
| **My File** | Drag-drop OR file-select uploader, max 10MB, image formats only | `POST /api/storage/upload` → Supabase URL |
| **Find** (Unsplash) | Search input + paginated result grid (12-24 per page, "Load more") | `GET /api/unsplash/search?query=&page=` (existing proxy) |
| **Use Icon** (Lucide) | Search input + categorised icon grid + colour swatch row (8-12 soft-pastel options) | Lazy-loaded full Lucide library |

**Configuration via inputs:**

```typescript
<app-image-picker
  [entityType]="'project'"            // for analytics/labels only — no behavior coupling
  [currentValue]="project.cover_image_url"
  [enabledTabs]="['upload', 'find', 'icon']"  // most consumers enable all 3
  [previewAspect]="'4/3'"             // matches consuming card's aspect (cards locked 4:3)
  [iconPalette]="defaultIconColors"   // overridable per consumer
  (chosen)="handlePick($event)"       // emits PickerResult discriminated union
  (cancelled)="closeDrawer()"
/>
```

**Output shape (discriminated union):**

```typescript
type PickerResult =
  | { type: 'image';
      url: string;
      source: 'upload' | 'unsplash';
      focalX: number;        // 0-100 percent; default 50 (center)
      focalY: number;        // 0-100 percent; default 50 (center)
      attribution?: { photographerName: string; photoUrl: string; }; }
  | { type: 'icon';
      name: string;          // Lucide icon name
      color: string;          // hex or token reference
    };
```

Consumer handles persistence — picker is pure, doesn't know which
entity it feeds.

**Focal-point step (image results only).**

After Upload or Unsplash selection (not Lucide — icons don't crop),
the picker shows a preview at the consuming card's aspect
(`previewAspect` input). User clicks the spot they want kept in
frame; the picker stores that as percent coordinates and adds
`focalX` / `focalY` to the result. Defaults to center (50/50) if
the user doesn't interact. Card renders with `object-fit: cover` +
`object-position: {focalX}% {focalY}%`.

### `<app-image-gallery>` (multi-image grid)

Multi-image hero gallery. Configurable slot count per consumer.

```typescript
<app-image-gallery
  [entityType]="'item'"
  [images]="item.images"             // JSONB array
  [maxSlots]="5"                      // default 5; per-entity overridable
  [primaryUrl]="item.cover_image_url" // optional — gallery can mark one slot as primary
  (added)="handleAdd($event)"         // opens picker drawer
  (removed)="handleRemove($event)"
  (reordered)="handleReorder($event)" // drag-drop
  (primarySet)="handlePrimary($event)"
/>
```

**Gallery behavior:**

- Empty slots show a "+" placeholder; clicking opens the picker drawer
- Filled slots show thumbnail; hover reveals remove + reorder handles
- Drag-drop reorders (primary = position 0 by default, OR explicit
  "Set as primary" affordance — locked decision pending, see Open decisions)
- "Set as primary" optionally writes the chosen URL to `cover_image_url`
  (entity-dependent; see Locked architectural decisions)

### `<app-completeness-card>` (per-entity progress)

Separate primitive. Computes "% complete" client-side from a
per-entity weighted field config; renders progress bar + suggested
actions that deep-link into the picker / gallery / other editors.

```typescript
<app-completeness-card
  [entityType]="'profile'"
  [entity]="profile"                  // full entity object
  [config]="profileCompletenessConfig" // weighted field list
  (actionClicked)="handleActionLink($event)"
/>
```

**Per-entity config example:**

```typescript
const profileCompletenessConfig: CompletenessConfig = [
  { field: 'cover_image_url', weight: 20, label: 'Upload cover photo', action: 'openPicker:cover' },
  { field: 'avatar_url', weight: 15, label: 'Add profile avatar', action: 'openPicker:avatar' },
  { field: 'images', weight: 25, label: 'Add gallery photos (5)', action: 'openGallery', threshold: 5 },
  { field: 'bio', weight: 10, label: 'Write a short bio', action: 'editField:bio' },
  // ...
];
```

Compute = `(filled fields' weights summed) / (total weight)`. Suggested
actions = list of unfilled fields. Configurable rendering (compact bar
vs full card with action list).

No schema. Pure client-side computation from existing entity data.

## Consumer matrix

| Entity | Cover | Icon fallback | Logo | Gallery | Completeness | Schema delta needed |
|---|---|---|---|---|---|---|
| **Project** | ✓ (`cover_image_url`) | ✓ (`icon_name` + `icon_color`) | — | ✓ (`images` JSONB — new) | optional | + `icon_name`, `icon_color`, `cover_focal_x`, `cover_focal_y`, `unsplash_photographer_name`, `unsplash_photo_url`, `images` |
| **Item** ⚠️ deferred | ✓ (`cover_image_url` existing) | — | — | ✓ (`images` JSONB — already exists) | ✓ | + `cover_focal_x`, `cover_focal_y`, `unsplash_photographer_name`, `unsplash_photo_url` — **but no v2 item editor surface to mount the picker on; blocked on `/store` arc. See Deferred table.** |
| **Supplier shopfront** | ✓ (`cover_image_url` existing) | — | ✓ (`logo_url` existing) | ✓ (`images` JSONB — new on orgs) | ✓ | + `cover_focal_x`, `cover_focal_y`, `unsplash_photographer_name`, `unsplash_photo_url`, `images` on orgs |
| **Profile** (user / org) | ✓ | — | ✓ | ✓ | ✓ | depends on existing org/user schema; same focal/attribution columns where covers exist |
| **Future: category** | ✓ (existing) | ✓ (existing) | — | likely no | — | + focal/attribution if not already present |
| **Future: client** | — | — | ✓ | likely no | — | + `logo_url` on clients |

## Surface treatment — drawer, not modal or page

Decision locked: the picker mounts in a **right-side drawer**, not a
modal dialog (v1's pattern) and not a separate page (the add-project
pattern). Reasoning:

| Surface | Verdict | Why |
|---|---|---|
| Dialog (v1) | Rejected | Unsplash search results + icon grid need real estate; modal cramps them |
| Page | Rejected | Overkill for a single image swap; disorienting when used inside a gallery |
| Inline edit-section | Rejected | v2's edit-section pattern is for label-value pairs; picker blows out the page layout |
| **Drawer** | **Locked** | Keeps page context; plenty of room for tabs + grids; mobile becomes full-screen naturally |

Same picker drawer works identically in all consumers (project cover
swap, gallery slot fill, item cover swap, profile avatar swap) —
consistent UX everywhere.

## Locked architectural decisions

1. **One picker, N consumers** — never duplicate. Entity passed
   explicitly via input; no route inference (RP-06 closed by
   construction).
2. **Output is a discriminated union** — picker emits image OR icon
   result; consumer handles persistence with its own update endpoint.
   Picker is pure.
3. **Drawer is generic, not media-coupled** — lives in shared
   primitives; future drawer consumers (filter, settings) reuse the
   same primitive.
4. **Unsplash attribution is mandatory** — when an image comes from
   Unsplash, `attribution.photographerName` + `attribution.photoUrl`
   are stored on the entity AND surfaced where the image displays
   (small caption: "Photo by X on Unsplash"). Compliance requirement,
   not optional.
5. **Lucide icons lazy-loaded** — full library lives in a separate
   chunk; main app bundle stays lean. ~50-100kb gzipped on first
   picker open is acceptable for "every icon searchable."
6. **Gallery `images` is JSONB array** — ordered. Position 0 = default
   primary unless `cover_image_url` is set explicitly.
7. **Completeness is client-computed** — no schema; per-entity
   weighted config; suggested actions are deep-link targets, not
   stored todos.
8. **Picker preview aspect = consuming card aspect** — passed via
   input (`previewAspect`). Prevents "looked good in picker, cropped
   on card" surprise. Card primitives already lock 4:3 (item /
   project / supplier all uniform per Liam's card-uniformity ship).
9. **Mobile-first responsive** — drawer goes full-screen below `md`.
10. **Focal-point picker is the fill-vs-crop solution.** Click the
    spot on the image you want kept in frame; we store that point as
    percent coordinates and CSS anchors the crop there — defaults to
    center if you don't bother. Entity stores `cover_focal_x` /
    `cover_focal_y` (SMALLINT DEFAULT 50). Card renders `object-fit:
    cover` + `object-position: {focal_x}% {focal_y}%`. Full in-app
    cropping (zoom/rotate/crop handles) stays deferred — focal-point
    gives ~90% of the UX win at ~10% of the cost.
11. **Image removal via trash-on-hover** on the consuming card/cover —
    quickest UX, matches the gallery hover-reveal pattern. No
    confirmation modal for cover removal (it's recoverable by picking
    again); confirmation reserved for gallery bulk operations later.
12. **Gallery primary semantics: explicit "Set as primary" writes
    `cover_image_url`** — not position-0-wins. User control over
    which image fronts the card; gallery order is purely visual.
13. **Gallery reorder: drag-drop** — modern UX standard. Up/down
    arrows only as a mobile fallback if drag-drop proves janky on
    touch.
14. **Per-entity gallery slot count is configurable via input prop**
    — default 5; consumer overrides (e.g. items might want 10,
    profile stays at 5).
15. **`<app-drawer>` first-ship scope is minimum viable** — just
    enough for the picker (header/body/footer slots, ESC dismiss,
    backdrop click, focus trap, mobile full-screen). Future drawer
    consumers extend (configurable widths, multiple drawers, nested,
    etc.) when their use cases land.

## Open decisions

All resolved at epic open (2026-06-15, Liam) — see Locked architectural
decisions §10-15. No remaining open decisions blocking pV2-MEDIA-01.

New open decisions surfaced during build go here; resolved decisions
move to the Locked section.

## Risk patterns

- **RP-06 rider applies** — the picker is a 4+ consumer component;
  same state-coupling risk as `<MarketplaceStore>`. Each consumer
  passes entity explicitly via input; no inference from route. Lesson
  banked from v2.25e (marketplace store positional-route bug).
- **RP-11 candidate** — image upload without attribution capture. If
  the picker is mounted somewhere and the Unsplash tab is enabled but
  attribution isn't surfaced on the consuming surface, we're in
  compliance violation. Lint guard candidate: any entity with
  `attribution.*` fields populated MUST render attribution where the
  image renders. Catch at build time, not runtime.
- **RP-12 candidate** — completeness config drift. Per-entity configs
  are easy to forget when fields are added/removed. Pattern:
  completeness configs live next to the entity's edit form, and any
  field added to the form should consider whether to add to the
  config. Linter: warn if entity edit-section adds a field that's not
  in the completeness config (false positives expected; warning, not
  error).

## Build order (recommended)

1. **`<app-drawer>` primitive** — generic, ship first. Tiny scope.
2. **`<app-image-picker>` + project cover consumer** — first picker
   ship. Project has cover already; add `icon_name`/`icon_color`
   columns. Validates the picker on a single-image consumer.
3. **`<app-image-gallery>` + project consumer** — pulls
   `projects.images JSONB` forward; project's Details tab is the
   first gallery host. *(Updated 2026-06-15: originally items, but
   items has no v2 editor surface to mount on — see Deferred table.
   Project becomes the gallery's proof-of-life consumer.)*
4. **Picker mounts on remaining consumers** — supplier shopfront
   cover, profile avatar (each a small ship). Item cover deferred.
5. **Gallery mounts on remaining consumers** — supplier
   gallery, profile gallery (each adds `images` column to its entity).
   Item gallery deferred.
6. **`<app-completeness-card>`** — lands last; depends on having all
   editors to deep-link into.

**Out of pV2-MEDIA-01 scope (gated on `/store`):** item cover picker
+ item gallery. Surfaces don't exist; data columns are ready. Lands
in pV2-MEDIA-01-items (post-STORE-01 follow-up).

## Audit reference

See `docs/AUDIT_LEDGER.md` for the per-file audit state. Empty until
pV2-MEDIA-01 first slice ships.

## Version history

### Summary — skimmable status

| Version | Date | What changed (1-line) | Ship | QC Done? | Audit Done? |
|---|---|---|---|---|---|
| v2.29a | 2026-06-15 | **pV2-MEDIA-01a** — `<app-drawer>` generic primitive (wraps PrimeNG p-drawer; header/body/footer slots, ESC/backdrop/focus-trap/scroll-lock, mobile full-screen) | `007b1742` | — | — |
| v2.29b | 2026-06-15 | **pV2-MEDIA-01b** — `<app-image-picker>` (My File / Unsplash paginated / lazy Lucide + focal-point) + project cover/icon consumer (Details "Image" section in a drawer). Gated `/api/media/upload`; project media migration (icon_name/color, cover_focal_x/y, unsplash attribution); focal + icon-fallback + attribution rendered on the project card. Lucide full set lazy-loaded (separate 134kB chunk — lock §5 verified). | `d4fe0d0a` | — | — |
| v2.32a–c | 2026-06-19 | **pV2-MEDIA-01c** — `<app-image-gallery>` (CDK drag-reorder, set-cover, remove) + project Details consumer (pulls `projects.images` forward; items deferred — no editor surface) | `8e2573d6` | — | — |
| v2.32d–g | 2026-06-20 | **pV2-MEDIA-01d** — picker + gallery on org **profile** (logo/cover/gallery editing); org `cover_image_url` → supplier **card** image; `orgs.images JSONB` added; picker `focalStep` + gallery `editable` inputs | `400f1ea9` | — | — |
| v2.32h | 2026-06-22 | **pV2-MEDIA-01e** — supplier shopfront renders the profile media in **view mode**: extracted `<app-org-media mode="edit\|view">` (cover + logo + gallery), mounted on profile (edit) + storefront (view); `images` added to the `GET /suppliers/:id` projection | — | — | — |
| target | post-STORE-01 | **pV2-MEDIA-01-items** — Picker + gallery mounted on item edit surface (deferred from MEDIA-01; gated on `/store`) | — | — | — |
| target | TBD | **pV2-MEDIA-01f** — `<app-completeness-card>` + first consumer (profile likely) | — | — | — |

### Detail — QC + Audit findings per version

(Empty — nothing shipped yet)

### Deferred — items pushed to a later prompt / arc

| Item | Deferred from | Why | Lands in |
|---|---|---|---|
| In-app image cropping (full crop tool — zoom, rotate, crop handles) | pV2-MEDIA-01 | Focal-point picker (Locked §10) solves 90% of the fill-vs-crop UX problem. Full cropping waits until a real use case demands the additional UI complexity | future |
| AI image generation tab in picker | pV2-MEDIA-01 | Out of scope for v1 of media; requires LLM image provider decision | future |
| Image alt-text / accessibility metadata | pV2-MEDIA-01b | Worth doing; defer to a small follow-up so picker ships clean | future MEDIA polish |
| Bulk image actions (multi-select remove, reorder multiple) | pV2-MEDIA-01c | Gallery v1 ships single-item actions; bulk is nice-to-have | future MEDIA polish |
| **Item cover picker + item gallery** | pV2-MEDIA-01 (surfaced 2026-06-15 mid-build) | Data columns ready (`images JSONB` exists on items; focal/attribution to be added with /store ship), but v2 has no item editor surface to mount the picker on — `/store` is a `coming-soon` stub. Building the editor just to host the picker is scope creep into a different arc. | pV2-MEDIA-01-items (post-STORE-01) |
| Completeness gamification (badges, streaks) | pV2-MEDIA-01f | Out of scope; completeness v1 is informational only | future |

## When to update this doc

- New entity becomes a consumer → add row to Consumer matrix
- New tab added to picker → update `<app-image-picker>` section
- Schema change on any consumer → update Consumer matrix's "Schema delta needed"
- Drawer primitive grows new features → document under `<app-drawer>` section
- Risk pattern surfaces → log under Risk patterns
- Open decision resolves → move to Locked architectural decisions

## Pairs with

- `docs/CARDS.md` — card aspect (4:3) drives picker `previewAspect`; cover
  image / icon are card primitive consumers
- `docs/PROJECTS.md` — project cover + icon mount the picker; project gallery
  mounts the gallery
- `docs/CODELISTS.md` — categories use icons; this is a future picker consumer
- `docs/DIALOGS.md` — `<app-drawer>` is a sibling primitive (drawer for
  multi-section content, dialog for confirmations / single-step
  prompts); same lifecycle rules (ESC dismiss, backdrop click,
  focus trap)
- `docs/PILLS.md` — `.bp-icon-block` (the soft-pastel icon container)
  is the visual treatment Lucide icons render in when chosen as
  fallback for missing covers
- `docs/PAGE_SETTINGS.md` — per-org branding configuration could
  drive default icon palettes / Unsplash search preferences in
  future
- `docs/AUDIT_LEDGER.md` — RP-06 rider (state-coupling on shared
  primitives); RP-11/12 candidates land here
