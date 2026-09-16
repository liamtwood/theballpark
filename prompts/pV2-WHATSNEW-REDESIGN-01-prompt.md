# pV2-WHATSNEW-REDESIGN-01 — What's New master-detail page + Report Issue dialog

**Type:** client-v2 UI · the v2 feedback surface (read + write)
**Owner:** CC implements + commits. Chat authored this. Mockup pair:
`prompts/pV2-WHATSNEW-REDESIGN-01-mockup.html` (shows **intent** — layout,
hierarchy, typed labels, fixes table; **not** the literal CSS).
**Depends on:** `pV2-RELEASE-VERSIONING-01` (the changelog `name`/`type`/
`datetime`/`fixes` schema this page renders).

**Standard-first (non-negotiable):** use Ballpark's **standard page layout,
fonts, tokens, and components** — NOT the mockup's raw CSS/hex. Per
`docs/DESIGN.md` + `feedback_pattern_reuse`, open the real components and reuse:
- Page shell: `app-page-hero` (align="block", title "What's new", Back to home,
  `history:true`) + `.bp-page-body--workspace` + `.bp-workspace-grid` tokens
  (see `project_workspace_layout_reference`).
- Cards: `.bp-card`; typography: the `bp-*` classes; colours: tokens only
  (no hex, no raw Tailwind colours — v2 build fails on them).
- Dropdowns: the shared **app-select** (`.bp-select-*`), never native `<select>`.
- Dialog: the standard v2 dialog pattern (see `pV2-DIALOGS` / `docs/DESIGN.md`).
- Icons: Lucide via `LucideAngularModule.pick({})`.
- v2 standards: standalone, OnPush, signals, `@if`/`@for`, `input()`/`output()`,
  `httpResource()`/`resource()` — no raw `.subscribe()`.

---

## Part A — What's New: master-detail redesign

Replace the current single-column wall-of-bullets (`pages/whats-new`) with a
**master-detail** layout (see mockup):

- **Left rail (hierarchy):** grouped **On preview** / **On dev — not yet
  promoted**; each release row shows **version + name + date · time**. Selecting
  a row loads its detail. Keep the existing dev/preview split semantics. Default
  selection = newest preview release. Left rail is a `.bp-card` list; selected
  row uses an accent-token active state.
- **Right detail (one release):** header = **version + release `name`**, right-
  aligned **date + time** + a **Preview/Dev** env pill, and "built from vX.NNN"
  muted. Then the body, by release kind:
  - **Patch release** (has `fixes`) → a **fixes table**: `Ref · Fixed · Reported
    by · ✓`. `Ref` = the `F-#####` chip; reporter from the issue; ✓ where done.
  - **Base / feature release** (has `notes` by area) → **area sections**: each
    area = a Lucide icon chip + area name, then entries each led by a **typed
    chip** — **New / Improved / Fixed** — + benefit-led text.
- **Typed chips** = new small pill variants built from **soft tokens**
  (New = success/green, Improved = info/blue, Fixed = warn/amber — align to the
  soft-fill family in `feedback_action_button_colors`). Add as reusable classes,
  don't inline.
- **Render structured content, not markdown** — bind `{type,text}` fields; the
  current raw `**bold**` leakage must be gone.
- Responsive: the two panes stack to one column on narrow (rail on top).

## Part B — Report Issue dialog

A user-facing "Report an issue" dialog that writes to the feedback subsystem
(`shared.feedback`) — the v2 realisation of `project_feedback_page_roadmap`.

- **Trigger:** an entry in the user menu ("Report an issue") — and, if trivial,
  the What's New page can carry a "Report an issue" button too. (No floating
  global button in this pass unless cheap.)
- **Fields (standard form kit + app-select):**
  - **Type** — Bug / Enhancement / Question (maps to the `feedback_category`
    issue types; app-select or a segmented control).
  - **Page / area** — pick from the **area categories** (Projects, Marketplace,
    Inbox, Suppliers, AI Agent, …) via app-select. Prefill with the page the
    user came from when derivable. ("pick a page — inbox etc.")
  - **Title** — short.
  - **Details** — description textarea.
  - Auto-capture the current `page_url` (into `pages`), like the legacy floating
    button did.
- **Submit → `POST /api/feedback`** (exists → `FeedbackService.create`).
  Confirmation shows the new **`F-#####`** ref ("Logged as F-000xx — thanks").
- On success, clear + close; on error, keep the draft and show a message.

## Part C — "My issues" table (view your own submitted issues)

The read companion to Part B — the v2 realisation of the "view feedback" half of
`project_feedback_page_roadmap`. Group B + C as a **Feedback** page (user-menu
entry "Feedback"): the **My issues** table with a **"Report an issue"** button
(opens the Part B dialog) in the page hero.

- **Simple table**, standard layout/tokens: columns **Ref (`F-#####`) · Type
  (Bug/Enh/Q) · Area · Title · Status · Date**. Status = a standard soft status
  pill (open / in_progress / done → grey / blue / green per
  `feedback_action_button_colors`). Newest first.
- **Row → detail** (title, description/notes, status) — a drawer or a
  `/feedback/:ref` view; keep it simple.
- **Scope to the signed-in user.** Add a `mine` filter to
  `feedback.service.list` / `GET /api/feedback?mine=1` that filters
  `submitted_by = req.user.id` — **derived server-side from the JWT, never a
  client-supplied user id** (same rule as `org_id`). Empty state: "No issues yet
  — spotted something? Report an issue."
- The `F-#####` ref shows once `pV2-FEEDBACK-REF-01` has backfilled; until then
  fall back to a short id.

### SECURITY — must fix on the create path
`POST /api/feedback` currently passes `req.body` straight to `create()`. The
dialog's submission MUST NOT let the client set identity/trust fields:
- **`submitted_by` is derived from `req.user` (JWT), never the body** — same
  rule as `org_id` (hygiene Rule 4 / "org_id is sacred"). Set it server-side.
- `environment` set server-side (from `APP_SCHEMA`/config), not the body.
- Validate the body with a Zod schema (allow only: type, feedback_category_id,
  area_category_id, title, notes/description, page_url/pages). Reject unknown/
  privileged fields (status, owner, target_version, priority — server defaults).
- Include the API audit checklist (ENGINEERING.md Rule 10) for this endpoint in
  the ship report.

---

## Acceptance
- [ ] What's New uses `app-page-hero` + workspace layout + tokens (no hex/raw
      Tailwind colours); builds clean.
- [ ] Master-detail: left hierarchy (grouped, version+name+date·time), right
      detail; selecting a release swaps the pane; newest preview default.
- [ ] Patch release renders the **fixes table** (F-ref · text · reporter · ✓);
      base/feature renders **areas + typed chips**; no raw markdown visible.
- [ ] Report Issue dialog creates a `shared.feedback` issue via the standard
      dialog + app-select; confirmation shows the `F-` ref.
- [ ] "My issues" table lists the signed-in user's own issues (Ref · Type · Area
      · Title · Status pill · Date), row → detail; `mine` filter is JWT-derived,
      not client-supplied; empty state present.
- [ ] `submitted_by` comes from JWT, not body; environment server-side; Zod
      validation added; API audit checklist in ship report.
- [ ] Responsive (panes stack); Lucide icons; OnPush/signals/resource.
- [ ] Bump chip; ship report written.

## Concerns not in spec
Standard section. Note the pre-existing `POST /api/feedback` trust gap you
closed, and anything the area-category picker needs (namespace filter for the
`area` rows).
