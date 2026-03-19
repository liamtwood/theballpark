# Changelog

All notable changes to The Ballpark are documented here.

## [1.1] - 2026-03-19 — Design System & Architecture

### Design
- **Option D layout**: Top navigation bar, parchment hero banner, two-column body. Playfair Display + Libre Franklin typography.
- **Global theme system**: 5 presets (amber, emerald, pink, ocean, slate). All components theme-aware via CSS custom properties.
- **Appearance settings**: Full config panel — platform name, tagline, terminology, theme swatches with live preview, hero alignment, component toggles.
- **Dark/light mode**: System preference detection, manual toggle in top nav, persisted to localStorage.
- **Lucide icons**: Registered globally via `LUCIDE_ICONS` injection token. Used across all components (nav, dashboard, settings, suppliers, projects).

### Architecture — Frontend
- **Models split**: Single 228-line barrel file split into 12 individual model files under `models/` with barrel re-export.
- **Shared components**: `AvatarComponent` (initials from name, configurable size), `StatCardComponent` (label, value, sub, themed, icon).
- **Config interfaces extracted**: `ThemePreset` and `PlatformConfig` moved from `config.service.ts` to `models/config.model.ts`.
- **Change detection fixed**: ConfigService emits on BehaviorSubject after loading. ChangeDetectorRef injected in dashboard, settings, top-nav.
- **Amber default enforced**: Theme name validated against preset list on load, falls back to amber if invalid.
- **Dead code removed**: SidebarComponent, empty `app.component.html`/`.css`.
- **Legacy React client removed**: `client/` folder deleted (superseded by Angular app).

### Architecture — Backend
- **Service layer**: 13 service files in `server/src/services/`. All business logic extracted from route handlers.
- **Thin controllers**: All 13 route files rewritten to delegate to services. No SQL in routes.
- **Centralised error handler**: `app.use((err, req, res, next) => ...)` in `index.js`. Logs stack traces, hides details in production.
- **`recalcProjectTotals` deduplicated**: Single canonical version in `project.service.js` (was duplicated across two route files).
- **CORS from environment**: `ALLOWED_ORIGINS` env var replaces hardcoded origin array.
- **SSL conditional**: `pool.js` enables SSL only when `NODE_ENV=production`.
- **dotenv centralised**: Single `require('dotenv').config()` in `index.js` (removed from `pool.js`).

### Documentation
- **ARCHITECTURE.md**: Folder structure, key services, design decisions, patterns, anti-patterns.
- **DEPLOYMENT.md**: Local setup, branch strategy, environment variables (`NODE_ENV`, `ALLOWED_ORIGINS`), Vercel/Railway configuration.
- **CHANGELOG.md**: Consolidated release notes.

## [1.0.0] - 2026-03-17

### Added
- Initial commit: Express API, React client, Angular client, Supabase database with migrations and seed data.
