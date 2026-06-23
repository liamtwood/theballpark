# Shipped — p0032 — Hero color global + page-config drawer two tabs

**Version:** v1.66p
**Shipped:** see commit log
**Prompt:** `p0032-hero-color-global-and-drawer-tabs-prompt.md`

## What changed
Three changes, one commit: hero color is now an app-wide setting, and the
drawer is reorganised into Dashboard / General tabs.

## §1 — Hero color is global
- `AppShell.heroIsNone` now reads the **global** hero color
  (`this.heroColor`, synced from `ConfigService` in `syncFromConfig`)
  instead of `ctx.heroColor`: `heroColor === 'none' || heroVariant === 'none'`.
  `heroIsCalm` is route-only again. Route `heroVariant` still works for
  surfaces that force a treatment (auth) — it just no longer fights the
  global setting.
- `ShellContext`: **dropped `heroColor`**, **added `useConfiguredTitle?`**.
- `heroTitle` getter gates on `ctx.useConfiguredTitle` (was `ctx.heroColor`);
  ctx-keepalive check updated to match.
- **Dashboard** pushes `useConfiguredTitle: true` (no `heroColor`).
  **`/projects`** stops pushing `heroColor` (gets the global treatment).
  `/inbox` never pushed it. (Agent was deleted in p0033.)
- Effect: marketplace, `/projects`, `/inbox`, project pages all respect
  the Hero color toggle; the dashboard keeps its greeting/org/username
  title; marketplace keeps "BALLPARK".

## §2 — Drawer two tabs
- The four legacy sub-eyebrow groups (GENERAL / APPEARANCE / HERO /
  SECTIONS) replaced by a **`bp-cfg-seg` two-button tab strip**
  `[Dashboard] [General]` (chosen over `p-tabView` — reads cleaner in the
  calm drawer) + two `*ngIf` panels. Default **Dashboard**; the active tab
  is held in `activeDrawerTab` and persists across open/close on the page.

## §3 — Controls re-sorted
- **Dashboard tab:** Title dropdown · Subtitle input · Sections checkboxes
  (Upcoming / Stats / Quick Actions / {credit}s card / Saved Suppliers /
  Recent Activity).
- **General tab:** Theme swatches · Hero color · Hero align · Nav · User
  name · Location · Credits label · Events label.
- Deleted the four `bp-drawer-label` sub-eyebrows + the `.bp-pcd-sub-eyebrow`
  CSS. All field bindings, save-on-change, the X, and the `bp-drawer`
  chrome are unchanged.

## Side effect (flagged in the plan)
With `heroColor` no longer forcing the configured title, the **`/projects`
hero title** now falls back to the **org name** (it's not a "home"
surface, so it doesn't set `useConfiguredTitle`). The dedicated "Projects"
title for that page remains a separate pending item.

## Diff
4 files (app-shell, shell-context, dashboard, projects-list) for §1; the
drawer for §2+§3; env bump. `ng build` clean.

## Verify (per prompt spec)
Build clean. Visual QC for Liam:
- ☐ `/home`: Hero color → Theme = accent fill; → None = parchment.
- ☐ `/suppliers` (marketplace), `/projects`, `/inbox`, `/projects/:id`: every hero responds to the same toggle.
- ☐ Marketplace title still "BALLPARK"; dashboard still the configured org/user/greeting.
- ☐ Drawer opens on **Dashboard** tab: Title / Subtitle / Sections.
- ☐ **General** tab: Theme / Hero color / Align / Nav / User name / Location / Credits label / Events label. Close + reopen → still on the last tab.
- ☐ All controls still save on change; theme switch + section toggles + title mode + user/location chips all still work.

p0032 → `Done` in `prompts/backlog.md`.
