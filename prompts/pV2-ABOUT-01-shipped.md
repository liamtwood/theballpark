# pV2-ABOUT-01 — In-app About (version / release / What's New)

**Shipped:** 2026-09-17, chip `Dev v2.481`
**Owner:** CC. Chat authored the spec. Tracker: FR-00207 (under EP-00016). Target v0.1.2.

## What landed
- New **`/about`** route + `AboutComponent` (standalone, OnPush) — a small card
  on the standard shell: `app-page-hero` (title "About", Back→home, `history:true`)
  + `.bp-page-body--workspace`, a `max-w-xl` `.bp-card`:
  - **App name** — Ballpark, with a one-line tagline + rocket icon block.
  - **Version** — `environment.versionChip` headline (e.g. "Preview v0.1.1" /
    "Dev v2.481"); a muted "built from {build}" sub-line when `release !== 'dev'`.
  - **Environment** — Development / Preview / Production, derived from
    `environment` (`release==='dev'` → Development; `production` → Production;
    else Preview).
  - A **What's new** link (`.bp-btn-outline` → `/whats-new`).
- Everything reads from `environment` — the SAME single source as the chip/About
  line — so it updates every release with no separate edit. No backend.
- **User menu** — new "About" entry directly under "What's new".

## Files touched
| File | Notes |
|---|---|
| client-v2/src/app/pages/about/about.component.ts | new — the About page |
| client-v2/src/app/app.routes.ts | new `/about` lazy route |
| client-v2/src/app/shell/user-menu/user-menu.component.ts | "About" menu entry under "What's new" |
| client-v2/src/environments/environment.ts | chip → v2.481 |

## Acceptance
- [x] "About" reachable from the user menu; shows app name + release headline +
      build sub + environment, read from `environment`.
- [x] Link through to What's New works (routerLink `/whats-new`).
- [x] Values update automatically next release (no hard-coded version — reads env).
- [x] Standard layout/tokens; OnPush; builds clean; chip bumped; guard clean.
- [~] Liam QCs on localhost.

## Concerns not in spec
- **Route vs dialog:** built as a small `/about` route (mirrors `/whats-new`),
  not a modal — simpler, consistent, and the prompt allowed either. Easy to
  reshape into a dialog later if preferred.
- **No org/user-specific info** — kept to app version/release only, per the spec.
- The user menu still shows the inline version chip line above What's new; the
  About page complements it (fuller view). Left both — remove the inline line if
  it now reads as redundant (Liam's call).

## QC notes
Tested on localhost as part of the v0.1.2 bundle — QC pass (Liam, 2026-09-17).

## Chat audit
(chat)
