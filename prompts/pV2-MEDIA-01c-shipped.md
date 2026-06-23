# pV2-MEDIA-01c — `<app-image-gallery>` + project consumer

**Shipped:** 2026-06-20, chip `[Dev v2] v2.32a`
**Commit:** `<pending>`

Third MEDIA slice: a multi-image gallery primitive, mounted on the project
Details tab. Reuses the 01b picker; project is the proof-of-life consumer
(items deferred — no editor surface).

## What landed
- **`<app-image-gallery>`** (new shared primitive) — slot grid (default 5),
  empty "+" tiles open the existing `<app-image-picker>` (in `<app-drawer>`,
  `upload`/`find` tabs only — no icon), filled tiles show a thumbnail with a
  hover overlay: **drag handle / set-as-cover / remove**. Drag-reorder via
  `@angular/cdk` (new dep). Pure about persistence — emits `(imagesChange)`
  (new ordered array) + `(primarySet)`; consumer writes both.
- **Primary = the existing cover** (MEDIA.md §12, not position-0): "Set as
  cover" copies the chosen slot's `url`/focal/attribution into the 01b
  `cover_*` columns, so the project card keeps rendering from `cover_*`.
- **`projects.images JSONB`** column (`{ url, focalX, focalY, attribution? }[]`),
  Zod-validated (bounded 20), persisted via the existing `PUT /api/projects-v2/:id`.
- **Project Details tab** — new "Gallery" card under the cover "Image" card.

## Files touched
| File | Notes |
|---|---|
| `client-v2/src/app/shared/image-gallery/image-gallery.component.ts` | NEW — the primitive (template + scoped styles, OnPush, signals, CDK drag) |
| `client-v2/src/app/pages/projects/project-detail.component.ts` | Mount gallery + `saveImages`/`setPrimary` handlers; `saveMedia` gained a toast-summary arg |
| `client-v2/src/app/core/media/media.types.ts` | `GalleryImage` type |
| `client-v2/src/app/core/projects/project.types.ts` | `images` on `ProjectDetail` + `ProjectUpdate` |
| `client-v2/src/app/app.config.ts` | Lucide `GripVertical` + `Star` registered |
| `server/src/services/projects.service.js` | `toDetail` + `EDITABLE` images; jsonb-cast in `updateDetail` |
| `server/src/schemas/project-create.schema.js` | `images` array schema on `ProjectUpdateSchema` |
| `server/src/db/migrate-schemas.js` | `projects.images JSONB DEFAULT '[]'` (public/preview/master) |
| `client-v2/package.json` | `@angular/cdk@^21.2` (new dep, for drag-drop) |

## Decisions (greenlit by Liam's "yes please do 1c")
- **Drag-drop:** `@angular/cdk` (vs HTML5 / PrimeNG orderList) — standard, touch-capable, reusable.
- **`images` shape:** `{ url, focalX, focalY, attribution? }`; primary tracked via `cover_image_url` (reuses 01b columns) — keeps the card unchanged.

## API audit — `PUT /api/projects-v2/:id` (schema/service changed; route unchanged)
- ✓ Input validation — `images` is a Zod-validated array (url ≤1000, focal 0–100, attribution shape), **max 20**, unknown per-item keys stripped.
- ✓ Authorization — unchanged (gated v2 router; `org_id` from JWT, never body).
- ✓ SQL — images bound as `$n::jsonb` (`JSON.stringify`), not string-concatenated; field→column via the explicit `EDITABLE` allowlist (stray keys can't reach SQL).
- ✓ Response shape — `toDetail` returns `images: []` when null; jsonb → JS array out of pg.
- ✓ Info disclosure / observability — unchanged.

## Verification
- Client `ng` build: **clean** (project-detail chunk 158→178 kB, includes gallery + CDK).
- Server files `node --check`: clean.
- `images` column added to **local** `public.projects` (so local QC works).
- Runtime add/remove/reorder/set-cover: **needs Liam's QC** (a logged-in local app with a project — headless auth wasn't feasible).

## Deploy prerequisite (when promoting)
`projects.images` must be migrated to the preview/prod DB before the gallery
works there: `DATABASE_URL=<target> npm run db:migrate:schemas` (preview + prod
share one Supabase DB, so a single run covers both). Not run yet — local only.

## Concerns not in spec
### `@angular/cdk` is a new runtime dependency
**Where:** `client-v2/package.json`
**What:** Added for drag-drop reorder (MEDIA.md §13 specs drag-drop). Lockstep-versioned with Angular 21; small, tree-shaken (drag-drop module only).
**Severity:** LOW — flagged because it's the first new dep in a while.

### Reorder grid with empty "+" slots in one `cdkDropList`
**Where:** `image-gallery.component.ts` template
**What:** Filled (cdkDrag) tiles + static empty "+" tiles share one drop-list; reorder operates on the contiguous filled block (CDK ignores non-cdkDrag children). Verify drag still feels right with empties present (QC item).
**Severity:** LOW.

## QC notes
**Liam, 2026-06-20 — PASS ("ok as is").** Verified: add via Upload, via Unsplash
(Find), via Icon; adding multiple images. A few small cosmetic things noted but
accepted as-is (not blocking; to be listed for a later polish pass if pursued).

QC-driven fixes landed during the pass (post-ship iterations):
- `v2.32b` — gallery guards `undefined` images() (couldn't crash host view).
- `v2.32c` — Image + Gallery cards no longer clip on desktop (pre-existing 01b
  `.bp-card overflow:hidden` flex-min-height-0 bug; `shrink-0`).
- `v2.32d` — cover "Edit" button + buttons-below; picker Find seeded with the
  project name; Use-Icon search button (parity with Find).
- `v2.32e` — drawer portaled to `body` (gallery drawer flicker/focus/"dialog in
  the container"); Edit button de-gradiented.

## Chat audit
(chat fills this in)
