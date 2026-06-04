# Shipped — p0031 — `/projects` card refresh + layout polish

**Version:** v1.66g
**Shipped:** see commit log
**Prompt:** `p0031-projects-card-refresh-prompt.md`

## What changed
Four scoped refinements to `projects-list.component.ts` (the page p0024
shipped). No new components, no model/backend changes, no new flags.

### 1. Refreshed card
- **Bigger:** grid `minmax(220px → 320px)`, gap 12 → 16, cover height
  110 → 200px. Page container widened (960 → 1400px max) so the bigger
  cards get room.
- **Notification badge** (`.bp-card-notif`) top-right of the cover —
  `message-circle` + count + " New", gradient pill
  (`--color-action-text → --theme-accent`). Renders only when
  `actionNeeded(p) > 0`.
- **REF chip** above the title (`--theme-soft` bg / `--theme-accent`
  text, small-caps eyebrow); hidden when `ref` is null.
- **Status pill** moved off the cover to its own line below the title,
  driven by the `project_status` codelist colour (white text).
- **Stats row:** `{N} Suppliers` (left) + relative time (right, via a
  small inline `relativeTime()` helper — date-fns isn't installed).
- **Big gradient Ballpark cost** at the bottom (28px, `--theme-accent →
  --color-action-text` `background-clip:text`) from `total_ballpark_cost`
  via `CompactCurrencyPipe`, with a muted `Ballpark` label.

### 2. REF chip — done as part of the card (above the name).

### 3. Active section header removed
- Dropped the `Active {projectLabel}s` panel header + card chrome. The
  Active grid is now bare, full-width on the parchment (no border / no
  panel). **Completed keeps its accordion header** (chevron to expand).

### 4. `+ New` dashed tile
- `.bp-new-tile` as the **last item in the Active grid only** — dashed
  border, centred `plus` icon + `New {projectLabel}` label, hover
  solidifies to `--theme-accent`, opens `CreateProjectService.open()`.
  Grid `stretch` matches it to card height. Doubles as the empty state.

## Token / data notes (substitutions + gaps flagged)
- **Tokens:** the prompt referenced `--color-action` / `--color-action-soft`,
  which **don't exist** — mapped to `--color-action-text` (#DC2626) and
  `--color-action-bg`. The gradients use `--theme-accent` (theme-driven)
  paired with `--color-action-text` (semantic red).
- **`{N} Suppliers`** — no supplier-count field on the project list
  payload today, so `supplierCount()` defaults to **0** (shows
  "0 Suppliers") until the backend plumbs it. No model change per spec.
- **Notification badge** — same: no `action_needed_count` field, so it
  stays **hidden** (count 0) until the backend supplies it.
- **Ballpark cost** reads `total_ballpark_cost`; shows £0 if the list
  endpoint doesn't return it (it may currently return `total_client_cost`
  instead — worth a glance).
- **Past section** — already removed in v1.66f, so this applies to
  **Active + Completed** only (the prompt predated that change).

## Cleanup
Removed now-dead `.bp-card-status-pill` / `.bp-card-meta` / `.bp-card-cost`
/ `.bp-section-new-btn` / `.bp-empty` styles + the unused `EventDatePipe`
import (the card no longer shows event date).

## Diff
One-file change (`projects-list.component.ts`) + version bump. `ng build`
clean.

## Verify (per prompt spec)
Build-verified. Visual QC for Liam:
- ☐ Active cards bigger; REF chip above name; status pill below name;
  suppliers + relative time row; big gradient Ballpark cost.
- ☐ No "Active Projects" header; grid fills page width.
- ☐ `+ New {projectLabel}` dashed tile last in Active; opens the modal;
  not in Completed.
- ☐ Completed accordion header + chevron still works.
- ☐ REF chip absent for projects without a ref.
- ☐ Theme switch recolours gradient text / status pill / badge.
- ☐ No regression on `/home`, `/agent`, top-nav.
- ⚠ "0 Suppliers" + no badge until the backend plumbs those fields;
  Ballpark may read £0 if the list endpoint doesn't return it.

p0031 → `Done` in `prompts/backlog.md`.
