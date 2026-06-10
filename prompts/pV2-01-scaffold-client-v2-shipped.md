# Shipped — pV2-01 — Scaffold `client-v2/`

**Version:** v2.00a (chip `[Dev v2] v2.00a`)
**Shipped:** see commit log
**Prompt:** `pV2-01-scaffold-client-v2-prompt.md`

## ⚠️ Version override — Angular 21, not 22 (approved by Liam)
The spec locked **Angular 22 + PrimeNG 21**. That pairing **can't be built**:
- `primeng@21` peers `@angular/core ^21.0.0`, and **there is no `primeng@22`** — PrimeNG's newest major (21) requires Angular **21**. "Angular 22 + PrimeNG 21" is incompatible.
- Angular 22 also requires Node `≥24.15.0`; this machine is on `24.14.0` (Angular 21 needs `≥24.0.0`, which we have).

Shipped **Angular 21 + PrimeNG 21 + Aura** — the genuinely-latest *compatible* stack, with the full modern surface (signals, `linkedSignal`, `resource()`, `@if/@for/@switch/@defer`, esbuild). Liam approved this override; the prompt file is left unedited per instruction so the record lives here. Everything else in pV2-01 is as written.

## Package versions (`client-v2/package.json`)
| Package | Version |
|---|---|
| `@angular/core` | `^21.2.0` |
| `primeng` | `^21.1.0` |
| `@primeuix/themes` | `^2.0.3` (Aura preset — see deviation 1) |
| `tailwindcss` | `^3.4.17` |
| `lucide-angular` | `^0.577.0` (see deviation 2) |

## What changed
- **NEW workspace `client-v2/`** (Angular 21, standalone, strict, ES2022, esbuild builder), scaffolded via `@angular/cli@21 new`. Old `client-angular/` and `server/` untouched.
- **Restructured to the spec layout:** `app.component.ts`/`AppComponent` (Angular 21 generates `app.ts`/`App` — renamed), `core/` (runtime-config + api + theme.tokens), `pages/` (hello / login / auth-callback).
- **PrimeNG Aura** styled mode via `providePrimeNG`, brand-bridged via `definePreset` (see deviation 3).
- **Runtime config** (`public/runtime-config.json`) loaded at bootstrap via `provideAppInitializer` → `RuntimeConfigService.load()`; `ApiService` reads `apiBaseUrl` from it.
- **Hello page** — OnPush, signals, `@if`, `ApiService.get('/api/health')` → connected/unreachable dot, version chip, one `<p-button>` (Aura, themed pink), one Lucide icon.
- **Tailwind 3.4** (`@tailwindcss/forms` + `/typography`) + `--theme-*` brand tokens in `styles.css`.
- **ESLint** (`ng add @angular-eslint`) — `npm run lint` clean. Port **4201** via `npm start`. Env files (dev/staging/prod) wired in `angular.json` `fileReplacements`.
- `.claude/launch.json` — added a `client-v2` config (port 4201).

## Setup deviations (all flagged, none silent)
1. **`@primeuix/themes` instead of `@primeng/themes`** — the spec's `@primeng/themes` is deprecated (npm warns → migrate to `@primeuix/themes`). Same `definePreset`/`providePrimeNG` API, just the maintained package + import path.
2. **Kept `lucide-angular@0.577` (not the renamed `@lucide/angular`)** — `@lucide/angular@1.x` is a redesigned API (per-icon standalone components, **no `.pick()`**), which conflicts with the spec + WORKING_STANDARDS `.pick({})` convention. Kept the `.pick()`-capable package (deprecated but works on Angular 21). **Open decision:** adopting `@lucide/angular` later requires updating the WORKING_STANDARDS Lucide pattern to the new API.
3. **PrimeNG bridge via `definePreset` (app.config), not CSS `--p-*` overrides (spec §3)** — PrimeNG styled mode injects its tokens at runtime, so a CSS `--p-*` override gets clobbered (verified: button rendered Aura-green, not brand-pink). The supported bridge is the preset. `styles.css` remains the single source of truth for non-PrimeNG `--theme-*` brand tokens; `BallparkPreset.primary.500 == --theme-accent` (#d63384). Still "one place" per concern.
4. **`runtime-config.json` in `public/` (not `src/`)** — Angular serves `public/` at the web root, so it's fetchable at `/runtime-config.json` and ships to `dist/` root for post-build edits (the spec's intent). `src/runtime-config.json` wouldn't be served.
5. **Config loaded via `provideAppInitializer` (not the spec §4 bootstrap-then-`load()`)** — the spec's code bootstraps *then* loads, which races the hello page's API call (config undefined → always "unreachable"). `provideAppInitializer` guarantees config-before-render, matching the spec's own stated intent ("config loaded FIRST").
6. **`.env` `ALLOWED_ORIGINS` += `http://localhost:4201`** (config, not `server/` code) — the API's CORS default is only `:4200`, so the cross-origin health check from `:4201` failed until added. This is the documented CORS mechanism. **`.env` is gitignored — `ALLOWED_ORIGINS` must include the client-v2 origin wherever the API runs.**

## Verify — 11/11
1. ✓ `npm install && npm start` → runs on **4201**, no errors.
2. ✓ `http://localhost:4201/` renders the hello page ("Ballpark v2").
3. ✓ Calls `http://localhost:3001/api/health` → **green "API: connected"** (200) when server up.
4. ✓ API stopped → reload → **orange "API: not reachable"**, app doesn't crash (runtime config wired).
5. ✓ `<p-button>` renders **`rgb(214,51,132)` = #d63384** (Aura + `definePreset` brand bridge).
6. ✓ Version chip reads **`[Dev v2] v2.00a`**.
7. ✓ `http://localhost:4201/login` → "Login / Coming soon." placeholder.
8. ✓ `http://localhost:4200/` (old v18 app) unchanged — `[Dev] v1.70a`, "Welcome back, Woodland Agency".
9. ✓ `ng build` clean (419 kB initial, under budget).
10. ✓ `npm run lint` — all files pass.
11. ✓ Zero `*ngIf` / `*ngFor` / `@NgModule` / `any` in `client-v2/src` (grep-verified).

pV2-01 flipped to `Done` in `prompts/backlog.md`. Next: pV2-02 (Google OAuth + user management). Old app stays on 4200; client-v2 on 4201.
