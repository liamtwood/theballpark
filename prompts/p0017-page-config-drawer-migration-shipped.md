# Shipped — p0017 — page-config-strip → page-config-drawer

**Version:** v1.65hJ
**Shipped:** see commit log
**Prompt:** `p0017-page-config-drawer-migration-prompt.md`

## What changed

- Created `shared/components/page-config-drawer/page-config-drawer.component.ts` — `<p-sidebar position="right" styleClass="bp-drawer" width=480px>` containing the existing labels / theme / align / nav / components controls, sub-grouped under GENERAL / APPEARANCE / SECTIONS drawer-label eyebrows.
- Selector: `<app-page-config-drawer>`. Class: `PageConfigDrawerComponent`.
- Dashboard + agent swap one import + one tag from `app-page-config-strip` → `app-page-config-drawer`.

## Service simplification

- `ConfigStripService.setTemplate()` + `template$` removed (no remaining consumers — the strip was the only one using the lifted-slot pattern). The cog still uses `register()` / `unregister()` + `open$` / `hasConfig$`.
- AppShell's lifted `bp-shell-config-strip` slot + chrome CSS removed. Drops the unused `TemplateRef` import.

## Drawer visibility wiring

- `[(visible)]` binds to a local `visible` field that mirrors `open$`.
- `(visibleChange)` funnels backdrop / ESC / X clicks back through `setOpen()` so every subscriber stays in sync.
- The cog in the top-nav continues to call `configStrip.toggle()` — no top-nav change needed.

## Diff

Net: **+575 / -481 (net +94)** — drawer body + group/field CSS added; strip removed cleanly.

## Verify (per prompt spec)

- ✓ Cog in top-nav on dashboard + agent. Click → drawer slides in from the right. Click X / backdrop / ESC → drawer closes.
- ✓ All existing settings work identically (page label / credits / events save on blur; theme swatches live-change accent; align + nav segmented buttons update shell; components pill toggle still toggles user/location/upcoming/stats).
- ✓ Cog appears only on pages with a drawer mounted (no leaked cog on inbox).
- ✓ Drawer scrolls when content exceeds viewport height.
- ✓ Horizontal strip toolbar is GONE from dashboard + agent — page content sits directly under the page header.
- ✓ Theme switch via drawer propagates to the rest of the app immediately.

p0017 flipped to `Done` in `prompts/backlog.md`. Hard-refresh — chip reads `[Dev] v1.65hJ`.
