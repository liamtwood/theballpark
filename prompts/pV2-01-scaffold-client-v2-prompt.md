# pV2-01 — Scaffold `client-v2/` (Angular 22 + PrimeNG 21)

## Read first

1. `WORKING_STANDARDS.md`
2. `prompts/cc-onboarding.md`
3. `prompts/auth-and-users-plan.md` (the auth shape we're heading toward — Google OAuth only for v1)
4. This prompt

## Goal

Stand up `client-v2/` as a brand-new Angular workspace in the same repo,
running on the latest stable Angular (22) + PrimeNG 21. Old `client-angular/`
stays untouched and continues to run on its current port. The new instance
proves the full stack works end-to-end with a hello-world surface and is wired
to the existing `server/` API.

This is the **scaffold only**. No real features. No auth. No data. Just a
clean canvas to build on.

## Locked tech choices

| Layer | Choice |
|---|---|
| Angular | **v22** (latest stable) |
| PrimeNG | **v21** with the **Aura** theme preset (styled mode + design tokens) |
| Tailwind | Latest, with `@tailwindcss/forms` + `@tailwindcss/typography` |
| Lucide | `lucide-angular` latest, registered via `.pick({})` per WORKING_STANDARDS |
| Build | Default Angular esbuild builder (already current) |
| Components | Standalone only — NgModules forbidden |
| Change detection | `OnPush` mandatory on every component |
| TypeScript | Strict mode, no `any`, no implicit `any` |
| State | Signals + `computed()` over RxJS where appropriate (RxJS still fine for streams) |
| Forms | Typed `FormGroup<{...}>` — no untyped controls |
| DI | `inject()` over constructor injection for new code |
| Control flow | `@if` / `@for` / `@switch` / `@defer` — no `*ngIf` / `*ngFor` |
| Code style | Prettier + ESLint with Angular plugin |
| Build target | ES2022 |

## Folder layout

```
ballpark/                          (existing repo root — DO NOT TOUCH)
├── client-angular/                (existing v18 app — untouched)
├── server/                        (existing API — untouched, shared)
├── client-v2/                     (NEW — scaffolded by this prompt)
│   ├── angular.json
│   ├── package.json
│   ├── tsconfig.json              (strict mode)
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── styles.css             (Tailwind directives + minimal global resets)
│   │   ├── runtime-config.json    (NEW — runtime API URL config, see below)
│   │   ├── environments/
│   │   │   ├── environment.ts            (dev)
│   │   │   ├── environment.staging.ts
│   │   │   └── environment.prod.ts
│   │   └── app/
│   │       ├── app.config.ts             (providers, theming, router)
│   │       ├── app.routes.ts
│   │       ├── app.component.ts          (root shell, hero placeholder, router-outlet)
│   │       ├── core/
│   │       │   ├── runtime-config.service.ts   (loads runtime-config.json on boot)
│   │       │   ├── api.service.ts              (HTTP wrapper, uses runtime API URL)
│   │       │   └── theme.tokens.ts             (--theme-* token bridging to PrimeNG Aura preset)
│   │       └── pages/
│   │           ├── hello/
│   │           │   └── hello.component.ts      (hello-world page, proves the stack)
│   │           ├── login/
│   │           │   └── login.component.ts      (placeholder — "Login coming soon")
│   │           └── auth-callback/
│   │               └── auth-callback.component.ts (placeholder)
└── prompts/                       (existing — untouched)
```

## Specifics

### 1. Workspace creation

```bash
cd /path/to/ballpark
npx @angular/cli@22 new client-v2 \
  --routing=true \
  --style=css \
  --standalone=true \
  --ssr=false \
  --skip-git=true \
  --strict=true \
  --inline-style=false \
  --inline-template=false
```

The flags: standalone (no NgModules), no SSR (matches static-S3 deploy shape),
strict TS, default builder (esbuild).

### 2. PrimeNG 21 setup

Install:
```bash
npm install primeng@21 @primeng/themes primeicons
```

In `app.config.ts`:
```typescript
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: false }
      }
    }),
    // ... runtime config provider — see below
  ]
};
```

### 3. `--theme-*` token bridging (the one place we own this)

In `src/styles.css`:
```css
:root {
  /* Ballpark brand tokens — single source of truth */
  --theme-accent: #d63384;
  --theme-soft:   linear-gradient(135deg, #fde7f0 0%, #e6f4ea 100%);
  --theme-bg:     #fbf7f4;
  --theme-text:   #1f2937;
  /* ... full token set as needed */
}

/* Map our tokens into PrimeNG's Aura preset tokens.
   This is THE file that bridges Ballpark style → PrimeNG style.
   Do NOT scatter PrimeNG overrides across components. */
:root {
  --p-primary-color: var(--theme-accent);
  --p-primary-contrast-color: #fff;
  /* ... add more bridges as needed when PrimeNG components are introduced */
}
```

Leave the bridge minimal — add to it only as PrimeNG components are introduced.
The old app's 160 `.p-*` overrides do NOT get migrated. We start clean.

### 4. Runtime config (CRITICAL for self-host portability)

`src/runtime-config.json`:
```json
{
  "apiBaseUrl": "http://localhost:3001",
  "googleOAuthClientId": ""
}
```

This file ships next to the built static assets. Customers can edit it post-build
without rebuilding the bundle.

`src/app/core/runtime-config.service.ts`:
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface RuntimeConfig {
  apiBaseUrl: string;
  googleOAuthClientId: string;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private http = inject(HttpClient);
  private config?: RuntimeConfig;

  async load(): Promise<void> {
    this.config = await firstValueFrom(
      this.http.get<RuntimeConfig>('/runtime-config.json')
    );
  }

  get(): RuntimeConfig {
    if (!this.config) throw new Error('Runtime config not loaded');
    return this.config;
  }
}
```

In `main.ts`:
```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { RuntimeConfigService } from './app/core/runtime-config.service';

// Bootstrap with config loaded FIRST. The app never sees an undefined API URL.
(async () => {
  const ref = await bootstrapApplication(AppComponent, appConfig);
  await ref.injector.get(RuntimeConfigService).load();
})();
```

### 5. API service wrapper

`src/app/core/api.service.ts`:
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private rc = inject(RuntimeConfigService);

  private base(): string {
    return this.rc.get().apiBaseUrl;
  }

  get<T>(path: string)  { return this.http.get<T>(`${this.base()}${path}`); }
  post<T>(path: string, body: unknown) { return this.http.post<T>(`${this.base()}${path}`, body); }
  put<T>(path: string, body: unknown)  { return this.http.put<T>(`${this.base()}${path}`, body); }
  delete<T>(path: string) { return this.http.delete<T>(`${this.base()}${path}`); }
}
```

Every feature uses `ApiService`. NEVER hit `HttpClient` directly. NEVER hardcode
URLs.

### 6. Tailwind setup

```bash
npm install -D tailwindcss postcss autoprefixer @tailwindcss/forms @tailwindcss/typography
npx tailwindcss init
```

`tailwind.config.js`:
```javascript
export default {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        theme: 'var(--theme-accent)',
        // bridge other Ballpark tokens here as needed
      }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')]
};
```

`src/styles.css` includes:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
/* (Plus the --theme-* tokens + PrimeNG bridge from §3) */
```

### 7. Lucide

```bash
npm install lucide-angular
```

Per WORKING_STANDARDS — always import via `.pick({})` in each component, never
the bare module.

### 8. Routes (placeholders)

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '',              loadComponent: () => import('./pages/hello/hello.component').then(m => m.HelloComponent) },
  { path: 'login',         loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'auth/callback', loadComponent: () => import('./pages/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent) },
  { path: '**',            redirectTo: '' }
];
```

### 9. Hello-world page

`pages/hello/hello.component.ts`:
- Standalone, OnPush, signals-only state
- Calls `ApiService.get('/api/health')` (or any existing endpoint; if none, just render static markup — the API call is to PROVE the wiring works)
- Renders:
  - Title "Ballpark v2"
  - Subtitle "Scaffold online · Angular 22 · PrimeNG 21"
  - Version chip from `environment.ts` — `[Dev v2] v2.00a`
  - If API call succeeds: green dot + "API: connected"
  - If API call fails: orange dot + "API: not reachable"

Use `@if` / `@for` — not `*ngIf` / `*ngFor`. Use `signal()` for state.

Use ONE PrimeNG component (e.g. `<p-button>`) to prove the Aura theme + token
bridge works visually.

### 10. Port + dev script

Run on port `4201` (old app keeps `4200`). Update `package.json`:
```json
"scripts": {
  "start": "ng serve --port 4201",
  "build": "ng build",
  "test": "ng test"
}
```

### 11. Environment files

`src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  versionChip: '[Dev v2] v2.00a'
};
```

Note: `apiBaseUrl` is NOT in here. Runtime config owns that.

### 12. Linting & formatting

```bash
npm install -D eslint @angular-eslint/builder @angular-eslint/eslint-plugin @angular-eslint/eslint-plugin-template @angular-eslint/template-parser @angular-eslint/schematics
npx ng add @angular-eslint/schematics
npm install -D prettier prettier-eslint eslint-config-prettier eslint-plugin-prettier
```

Add `.prettierrc` with sensible defaults (2 spaces, single quotes, no semis if you prefer).

## Acceptance criteria

1. `cd client-v2 && npm install && npm start` — runs on port 4201, no errors.
2. Visit `http://localhost:4201/` — sees the hello-world page rendered.
3. Hello-world page calls the existing API (`http://localhost:3001/api/...`) and shows green "API: connected" dot when the server is up.
4. Stop the API server — refresh — page shows orange "API: not reachable". Confirms runtime config is wired correctly (not crashing the app).
5. PrimeNG button (any visible `<p-button>`) renders with the `--theme-accent` pink. Confirms Aura preset + token bridge work.
6. Version chip in the page reads `[Dev v2] v2.00a`.
7. `http://localhost:4201/login` — placeholder login page renders ("Login — coming soon").
8. `http://localhost:4200/` (old app) still works unchanged. Same dev server, same port, same behavior. No regressions in old app.
9. `ng build` in `client-v2/` succeeds with zero errors.
10. Lint passes: `npm run lint` clean.
11. No `*ngIf` / `*ngFor` / NgModules / `any` types anywhere in `client-v2/src/`.

## Out of scope

- Auth (Google OAuth comes in pV2-02)
- User / session state
- Any real data fetching beyond the health-check call
- Any feature porting from old app
- Migrating any styles or components from `client-angular/styles.css`
- Touching `client-angular/` at all
- Modifying `server/`
- Database changes
- Deployment scripts / Dockerfiles (deferred)

## Bump + ship

1. Version chip in `client-v2/src/environments/environment.ts` reads `[Dev v2] v2.00a`.
2. Commit message: `feat(v2.00a): scaffold client-v2/ on Angular 22 + PrimeNG 21`.
3. Push to `dev`.
4. Write `prompts/pV2-01-scaffold-client-v2-shipped.md` per cc-onboarding ship-report format.
5. Flip `pV2-01` in `prompts/backlog.md` to Done.

## Reply with

- Commit SHA
- Versions in `client-v2/package.json` for: `@angular/core`, `primeng`, `tailwindcss`, `lucide-angular`
- Confirmation: all 11 acceptance criteria ticked
- Anything non-trivial you decided in setup (e.g. which Aura preset variant, lint rule overrides)
- Confirmation old app still serves on 4200 unchanged
