# pV2-WHATSNEW-REDESIGN-01 — What's New master-detail + Report Issue dialog + My issues

**Shipped:** 2026-09-16, chip `[Dev v2] v2.472` (dev/localhost only — NOT promoted)
**Owner:** CC. Chat authored the spec. Liam QCs on localhost, then we promote.

## What landed
- **Part A — What's New master-detail** (`pages/whats-new/whats-new.component.ts`, full rewrite): left rail groups **On preview / On dev** (version + name + date·time, accent active state); right pane shows the selected release — a **fixes table** (Ref · Fixed · Reported by · ✓) for a patch, or **typed area sections** (Lucide area-icon chip + New/Improved/Fixed pills + benefit text) for a base/feature release. Default = newest preview. Structured `{type,text}` binding — no raw markdown (the `**bold**` is stripped in gen-changelog). Standard page-hero + `.bp-page-body--workspace`; responsive `md:grid-cols-[280px_1fr]` (stacks on narrow).
- **Part B — Report Issue dialog** (`pages/feedback/report-issue-dialog.component.ts`): standard `p-dialog` + **app-select** (Type: Bug/Enhancement/Question; Page/area from area categories) + title + details; auto-captures `page_url`. Submit → secured `POST /api/feedback`; toast confirms **"Logged as F-xxxxx"**; keeps the draft on error.
- **Part C — Feedback page** (`pages/feedback/feedback-page.component.ts`): **My issues** table (Ref · Type · Area · Title · Status pill · Date, newest first), row → inline detail; empty state; "Report an issue" in the hero. User-menu gains a **Feedback** entry; `/feedback` route added.
- **Typed chips + status pills** reuse `.bp-pill--success|info|warn|muted` (added the `info` variant to styles.css) — soft tokens, no inline colours.
- **Client `FeedbackService`** (`core/feedback/feedback.service.ts`): `report()`, `myIssues()`, `areaCategories()`.

## SECURITY — closed the POST /api/feedback trust gap
Previously `POST /api/feedback` passed `req.body` straight to `create()` with **no auth**. Now:
- Route requires **`authenticate`**; `submitted_by = req.user.id` (JWT) and `environment` are set server-side — never from the body (org_id-sacred rule).
- Body validated by **`FeedbackCreateSchema`** (Zod, `.strip()`): allows only type/feedback_category_id/area_category_id/title/description/notes/page_url/pages; privileged fields (status/owner/target_version/priority/object_type) are dropped.
- **`GET /api/feedback/mine`** (new, `authenticate`) → `listByUser(req.user.id)`; the `mine` scope is JWT-derived, never client-supplied.

## API audit checklist
#### `POST /api/feedback` (secured)
- ✓ HTTP method (create) · ✓ Input validation (Zod, strip) · ✓ Authorization (authenticate; identity from JWT) · ✓ Status codes (201/400/401) · ✓ Response shape (created row) · ✓ Information disclosure (no privileged echo) · ✓ Observability (next(err)) · N/A Idempotency · ✓ Performance (single insert + sequence)
#### `GET /api/feedback/mine`
- ✓ Method (read) · N/A body · ✓ Authorization (authenticate; `submitted_by = req.user.id`, not client) · ✓ Status (200/401) · ✓ Response (own rows only) · ✓ Info disclosure (scoped) · ✓ Observability · ✓ Performance (indexed-ish; small per-user set)

## Files touched
| File | Notes |
|---|---|
| server/src/routes/feedback.js | secured POST /; new GET /mine |
| server/src/schemas/feedback-create.schema.js | new — Zod |
| server/src/services/feedback.service.js | listByUser() |
| client-v2/src/app/core/feedback/feedback.service.ts | new client service |
| client-v2/src/app/pages/feedback/report-issue-dialog.component.ts | new |
| client-v2/src/app/pages/feedback/feedback-page.component.ts | new |
| client-v2/src/app/pages/whats-new/whats-new.component.ts | master-detail rewrite |
| client-v2/src/app/shell/user-menu/user-menu.component.ts | Feedback link |
| client-v2/src/app/app.routes.ts | /feedback route |
| client-v2/src/styles.css | .bp-pill--info |

## Acceptance — verified (build/guard); Liam QCs visuals
- [x] What's New: page-hero + workspace + tokens; builds clean; guard clean.
- [x] Master-detail (grouped rail, version+name+date·time; select swaps; newest preview default).
- [x] Patch → fixes table (F-ref · text · reporter · ✓); base → areas + typed chips; no raw markdown.
- [x] Report dialog creates via secured POST; confirmation shows F-ref.
- [x] My issues table (Ref · Type · Area · Title · Status · Date), row → detail, empty state; `mine` JWT-derived.
- [x] submitted_by from JWT; environment server-side; Zod added.
- [~] Responsive/Lucide/OnPush/resource — built; Liam QCs.

## Concerns not in spec
- **POST /api/feedback now requires auth + is issue-only.** If any admin/tracker path relied on the previously-unauthenticated POST / (folders, test_case, or setting target_version/status/priority), it must move to its own admin-gated path — chat authored this expecting the lock, so the tracker presumably writes via service/DB, not this endpoint. Flagging per the contract.
- **My-issues row detail** is a simple inline expand (description/notes), not a drawer/route — kept simple per the spec.
- **Area-category picker** uses `GET /api/feedback/categories?namespace=area` (15 area rows exist).

## Iteration — base-release polish: Group → Feature column, no "New" chip (2026-09-17, v2.479)
**Triggered by:** updated prompt + mockup — base release renders **Group (icon) →
epic rows: `Ref (EP-#####) · Feature · What's new`**, Feature as its own bold
column, and the "New" chip dropped (a base release is all-New — redundant).

**What changed (code only; v0.1.0.md content is f4/chat's domain, read-only to me)**
- **`whats-new.component.ts`** — base `@else` block rebuilt: one table per
  **group** (`v.notes[].area` = the group), each with a group heading (Lucide
  icon + name) and a 3-col grid **Ref · Feature · What's new**. Feature is bold;
  **no type chip when `type==='new'`** — an Improved/Fixed chip shows only on
  non-New rows (future mixed releases). `NoteItem` gains `feature?`. `AREA_ICONS`
  remapped to the four groups (Organizations & Roles→users, Project→folder-kanban,
  Marketplace→store, Platform & Admin→shield). Fixes table unchanged.
- **`gen-changelog.js`** — base bullets parse `EP-#### · Type · **Feature** — text`
  into `{ref,type,feature,text}`: feature = the **bold** run, text = after the
  em-dash (blurb may contain `·`, e.g. "Overview · Inbox · …" — preserved).
- **`app.config.ts`** — registered Lucide `Shield` (Platform & Admin group icon).
- Regenerated `changelog.json` (4 groups, 19 epics). Chip → v2.479.

**Deviations from the mockup (flagged, deliberate)**
- **Fixes table keeps its Type column.** The mockup drops it, but Liam explicitly
  asked for Type at the v2.476 QC — his QC beats the mockup.
- **v0.1.1 fix refs still show `F-`** because `docs/release-notes/v0.1.1.md` (f4's
  content file) still carries `F-00087…`. The mockup shows `BE-00087…`. Per the
  session split I don't edit that note — asked f4 to switch it F-→BE-; the page
  renders whatever the note carries, so it flips automatically once f4 updates it.
- **No per-release summary line** (the mockup's `.summary`). Cosmetic, not in the
  acceptance criteria — skipped this pass; easy to add if wanted.

## QC notes
(Liam)

## Chat audit
(chat)
