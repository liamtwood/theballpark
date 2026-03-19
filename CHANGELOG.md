# Changelog

All notable changes to The Ballpark are documented here.

## [1.1.1] - 2026-03-19

### Fixed
- **Change detection**: ConfigService now emits on BehaviorSubject after loading from localStorage. Injected ChangeDetectorRef in dashboard, settings, and top-nav to force repaint after async data loads. Pages now render immediately on first load.
- **Amber default theme**: ConfigService validates `themeName` against preset list after loading from localStorage. Falls back to amber if missing or invalid.
- **Lucide icons**: Registered all icons globally via `LUCIDE_ICONS` injection token and `LucideIconProvider` in `app.config.ts`. Standalone components cannot use `LucideAngularModule.pick()` (returns ModuleWithProviders). Icons now render across all components.

### Added
- **Avatar component** (`shared/components/avatar/`): Reusable initials avatar with `name` and `size` inputs. Extracts logic previously inline in top-nav.
- **Stat card component** (`shared/components/stat-card/`): Reusable stats bar cell with `label`, `value`, `sub`, `themed`, and `icon` inputs. Extracts repeating pattern from dashboard.
- **Models folder** (`models/`): Split single 228-line barrel file into 12 individual model files (org, project, user, client, config, etc.) with barrel re-export.
- **ARCHITECTURE.md**: Folder structure, key services, design decisions, patterns guide, anti-patterns.
- **DEPLOYMENT.md**: Local setup, branch strategy, environment variables, Vercel/Railway configuration.

### Changed
- Moved models from `core/models/` to top-level `models/` folder. Updated all 17 import sites.
- Moved `ThemePreset` and `PlatformConfig` interfaces from `config.service.ts` to `models/config.model.ts`.
- Root `package.json` scripts cleaned up: removed stale `client/` references, simplified to `dev:server` and `dev:client`.
- Avatar in top-nav now uses shared `AvatarComponent` instead of inline div.
- Stats bar in dashboard now uses shared `StatCardComponent` instead of inline cells.

### Removed
- Legacy React client (`client/` folder) — superseded by Angular app.
- Dead `SidebarComponent` — unused PrimeNG-based sidebar from initial scaffolding.
- Empty `app.component.html` and `app.component.css` (template and styles are inline).

## [1.1.0] - 2026-03-19

### Added
- **Option D Design System**: Complete visual redesign replacing sidebar layout with top navigation bar. Playfair Display + Libre Franklin typography. Full CSS variable system with 5 theme presets (amber, emerald, pink, ocean, slate).
- **ConfigService**: Platform configuration with theme presets, dark/light/system mode, customisable labels (project/credit terminology), localStorage persistence, and reactive updates across the app.
- **Dashboard rebuild**: Hero banner with org name (Playfair Display 48px), stats bar (4-column grid), two-column body with project cards, credits card with dot visualiser, and saved suppliers list.
- **Dark mode**: Full dark mode support via CSS variables and `data-mode` attribute on `<html>`. System preference detection, manual toggle in top nav, persisted to localStorage.
- **Settings Appearance tab**: Platform name, tagline, terminology, 5-colour theme swatches with live preview, light/dark/system mode toggle, hero banner alignment picker, and component visibility toggles.
- **Settings hero banner**: Parchment-style hero matching dashboard design pattern.
- **Theme-aware buttons**: All primary buttons use theme-bg/theme-text default, theme-accent hover, with disabled state styling.
- **Global theme application**: All PrimeNG components (tabs, steps, inputs, switches, pagination, sort, dialogs) use theme accent colour via CSS variable overrides.
- **Lucide icons**: Replaced PrimeIcons with Lucide Angular across all custom templates (top nav, about, empty states, loading spinner, suppliers, clients, project detail/create).
- **Marketplace logo upload**: Image upload in Settings Organisation tab, stored as base64 in localStorage. Displays in top nav replacing text logo when present.
- **Branching strategy**: master (production), preview (staging), dev (working branch). Vercel and Railway deployment configuration.
- **Environment-driven versioning**: Version labels ([Dev], [Preview], [Master]) displayed in sidebar/nav from environment files.
- **CORS configuration**: Express server allows localhost:4200, theballpark.vercel.app, theballpark.ai, www.theballpark.ai, preview.theballpark.ai.

### Changed
- Root `dev` script runs Angular client (port 4200) instead of React client.
- Production apiUrl set to Railway deployment URL.
- Angular build outputPath corrected for Angular 17 application builder.

## [1.0.0] - 2026-03-17

### Added
- Initial commit: Express API, React client, Angular client, Supabase database with migrations and seed data.
