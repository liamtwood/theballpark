# ClientV2

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.14.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Google OAuth setup

1. Go to https://console.cloud.google.com → create a project (or use existing)
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Type: Web application
4. Authorised JavaScript origins: `http://localhost:4201` (dev; add the production URL later)
5. Authorised redirect URIs: `http://localhost:3001/auth/google/callback`
6. Copy the Client ID + Secret into the repo-root `.env` (NOT `server/.env` — the
   server loads the root file) as `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.
   See `.env.example` for the full auth variable set (JWT_SECRET, WEB_BASE_URL, …).

Dev sign-in without Google: `npm run seed:dev-users` (in `server/`) seeds four
pickable identities; the login page's dev picker calls `/auth/dev/login`
(disabled when `NODE_ENV=production`).
