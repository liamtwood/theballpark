# Architecture Guide

## Folder Structure

```
client-angular/src/app/
  models/              TypeScript interfaces (one file per entity)
    index.ts           Barrel re-export
    org.model.ts       Org interface
    project.model.ts   Project, ProjectCategory
    user.model.ts      User
    client.model.ts    Client
    config.model.ts    PlatformConfig, ThemePreset
    ...

  core/
    services/          Singleton services (providedIn: 'root')
      api.service.ts       Base HTTP wrapper
      config.service.ts    Theme, config, localStorage persistence
      org.service.ts       Organisation + users + balance
      project.service.ts   Project CRUD
      client.service.ts    Client CRUD
      supplier.service.ts  Supplier + catalogue
      category.service.ts  Categories
      estimate.service.ts  Estimates
      message.service.ts   Messages
      ai.service.ts        Claude AI brief parsing
      project-category.service.ts  Project cost breakdown

  shared/
    components/        Reusable presentational components
      avatar/          Initials avatar (inputs: name, size)
      stat-card/       Stats bar cell (inputs: label, value, sub, themed, icon)
      loading-spinner/ Animated spinner
      empty-state/     Empty placeholder with icon
      status-badge/    Coloured status pill
      currency-display/ Currency formatter wrapper
    pipes/
      gbp.pipe.ts      GBP currency formatting (Intl.NumberFormat)

  layout/
    top-nav.component.ts  Sticky nav bar with logo, links, mode toggle, avatar

  features/            One folder per route
    dashboard/         Home page: hero, stats, projects, suppliers
    settings/          5-tab settings: org, team, categories, subscription, appearance
    projects/pages/    Project list, detail, create wizard
    clients/pages/     Client list, detail
    suppliers/         Supplier catalogue with expandable rows
    about/             Credits page

server/
  src/
    index.js           Express entry point, route mounting, CORS, error handler
    db/
      pool.js          PostgreSQL connection pool (env-driven SSL)
      migrate.js       Schema creation
      seed.js          Sample data
    services/          Business logic layer (one file per domain)
      project.service.js        Project CRUD + recalcTotals (single source)
      org.service.js             Org CRUD + getCurrentAgency + suppliers
      user.service.js            User CRUD + getByOrg
      balls.service.js           Transactions with atomic balance updates
      category.service.js        Category CRUD
      client.service.js          Client CRUD
      item.service.js            Item (catalogue) CRUD
      project-category.service.js  Cost breakdown with derived field calc
      estimate.service.js        Estimate CRUD + recalcTotal
      estimate-item.service.js   Estimate items with cascading totals
      message.service.js         Message CRUD
      status.service.js          Status CRUD
      ai.service.js              Claude API brief parsing
    routes/            Thin controllers (one file per entity)
```

## Key Services

| Service | Purpose |
|---------|---------|
| `ConfigService` | Manages platform config (theme, labels, layout). Persists to localStorage. Exposes `config$` BehaviorSubject for reactive updates. Applies CSS custom properties on theme change. |
| `ApiService` | Thin wrapper around Angular HttpClient. All HTTP calls go through this. |
| `OrgService` | Organisation CRUD, user listing, balls balance. |

## Design Decisions

- **Standalone components**: Every component is standalone (no NgModules). This is the modern Angular pattern and enables better tree-shaking.
- **CSS custom properties for theming**: All theme colours flow through `--theme-*` and `--color-*` CSS variables set on `:root`. Components never hardcode theme colours.
- **BehaviorSubject over Signals**: Config uses RxJS BehaviorSubject for compatibility. Migration to Angular Signals is a future option.
- **Lazy-loaded routes**: All feature components are lazy-loaded via `loadComponent()` in `app.routes.ts`.
- **Lucide icons**: Registered globally via `LUCIDE_ICONS` injection token in `app.config.ts`. Components import `LucideAngularModule` for the `<lucide-icon>` directive.
- **PrimeNG**: Used for form controls (InputText, InputNumber, Dropdown, Steps) and data display (TabView, Table, Dialog). Not used for layout or theming.

## Patterns to Follow

1. **New feature**: Create folder under `features/`, use standalone component with lazy route in `app.routes.ts`.
2. **New model**: Add `<name>.model.ts` in `models/`, re-export from `models/index.ts`.
3. **New service**: Add to `core/services/`, use `providedIn: 'root'`.
4. **New shared component**: Add to `shared/components/`, keep it presentational (inputs only, no service injection).
5. **New icon**: Add the import to `app.config.ts` in the `LucideIconProvider` object.
6. **Theming**: Use `var(--theme-accent)`, `var(--color-text-primary)` etc. Never hardcode hex colours in components.

## Anti-Patterns to Avoid

- Do not create NgModules — use standalone components.
- Do not import `LucideAngularModule.pick()` in standalone components (incompatible with `ModuleWithProviders`). Register icons globally instead.
- Do not duplicate currency formatting — use `GbpPipe` for full format or `ConfigService.formatCurrency()` for compact format.
- Do not put business logic in route handlers (backend) — extract to service files when refactoring.
- Do not call `require('dotenv').config()` in multiple files — it runs once in `index.js`.
