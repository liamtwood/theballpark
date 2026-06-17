# Deployment Guide

> **v2 cutover (2026-06):** the app shipped to users is now **`client-v2/`**
> (Angular 21). `client-angular/` (v1) is retired and being removed from the
> deploy path. The instructions below describe the **v2** flow. Anything
> referencing `client-angular` is legacy.

## Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL database
- `.env` file in project root (see Environment Variables below)

### One command start
```bash
npm run dev
```
`concurrently` starts both:
- **Backend** (Express on port 3001): `server/`
- **Frontend** (Angular on port 4201): `client-v2/`

### Individual services
```bash
npm run dev:server     # Backend only
npm run dev:client     # v2 frontend only (port 4201)
npm run dev:client:v1  # legacy v1 frontend (client-angular, port 4200)
```

### First-time setup
```bash
npm run install:all        # root + server + client-v2 deps
npm run db:migrate         # base tables (public schema)
npm run db:migrate:schemas # idempotent per-environment schema sync (public/preview/master)
npm run db:seed            # sample data
```

## Branch Strategy

| Branch    | Purpose              | Deploys to          | Frontend built |
|-----------|----------------------|---------------------|----------------|
| `dev`     | Active development   | — (push routinely)  | client-v2      |
| `preview` | Preview/staging      | preview.theballpark.ai | client-v2 (staging) |
| `master`  | Stable releases      | Production          | (cutover to v2 pending) |

### Workflow — deploying to preview
1. All work lands on `dev`.
2. Bump the staging version chip so the deploy is identifiable:
   - edit `client-v2/src/environments/environment.staging.ts` → `versionChip`.
3. Update the `preview` branch to the desired `dev` state and push:
   ```bash
   git checkout preview
   git reset --hard dev      # preview tracks dev; v1 lineage retired
   git push --force-with-lease origin preview
   git checkout dev
   ```
4. The push triggers the Vercel build for the preview project (see below).
5. If the backend schema changed, run the migration against the **preview** DB
   (see Railway, below) — this is currently a **manual** step.

> Production (`master`) still serves v1 until its own cutover; do not merge
> `dev`→`master` as part of a preview deploy.

## Frontend — Vercel (client-v2)

The Angular frontend deploys to Vercel. Build config is repo-tracked in
[`client-v2/vercel.json`](client-v2/vercel.json):

- **Build command**: `node scripts/write-runtime-config.mjs && npx ng build --configuration staging`
- **Output directory**: `dist/client-v2/browser`
- **Rewrites**: SPA fallback (`/(.*)` → `/index.html`)

**Dashboard setting that is NOT in the repo** (must be set in the Vercel project):
- **Root Directory**: `client-v2`  ← was `client-angular`; this is the cutover switch.

### API URL — runtime config (important)
v2 reads its API base URL at **runtime** from `/runtime-config.json`
(`RuntimeConfigService`, loaded at bootstrap), not from a compiled-in env file.
On a host the file is generated at build time by
[`client-v2/scripts/write-runtime-config.mjs`](client-v2/scripts/write-runtime-config.mjs)
from environment variables:

| Vercel env var           | Fills                | Example                              |
|--------------------------|----------------------|--------------------------------------|
| `API_BASE_URL`           | `apiBaseUrl`         | preview backend origin (no trailing /) |
| `GOOGLE_OAUTH_CLIENT_ID` | `googleOAuthClientId`| (empty until pV2-02 auth)            |

Locally (`ng serve`) the script does not run, so the committed
`client-v2/public/runtime-config.json` default (`http://localhost:3001`) is used.

## Backend — Railway (server)

- **Start command**: `cd server && node src/index.js`
- **Env vars** (Railway dashboard): `DATABASE_URL`, `PORT`, `NODE_ENV`,
  `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`.
- **Health check**: `GET /` returns server status.

### Database migrations — MANUAL (no auto-hook)
There is currently **no** auto-migration on deploy (no `railway.json`, the start
command does not run migrations). `server/src/db/migrate-schemas.js` is the single
idempotent source of schema truth across the `public`/`preview`/`master` schemas.
After any schema change, run it against the target DB:
```bash
DATABASE_URL=<target-db-url> npm run db:migrate:schemas
```

> **Proposed improvement (not yet wired):** make migrations run automatically on
> deploy by changing the server start to migrate first, e.g.
> `"start": "node src/db/migrate-schemas.js && node src/index.js"` — safe because
> `migrate-schemas.js` is idempotent. Implement once verified against preview.

## Environment Variables

Create a `.env` file in the project root:
```
DATABASE_URL=           # PostgreSQL connection string
PORT=                   # Server port (default: 3001)
NODE_ENV=development    # 'development' or 'production'
ANTHROPIC_API_KEY=      # Claude API key for AI brief parsing
ALLOWED_ORIGINS=http://localhost:4201,http://localhost:4200
```

### Railway env (preview)
```
NODE_ENV=production
ALLOWED_ORIGINS=https://preview.theballpark.ai,http://localhost:4201
```

### Railway env (production)
```
NODE_ENV=production
ALLOWED_ORIGINS=https://theballpark.ai,https://www.theballpark.ai
```

## Legacy (v1 — retired)
- `client-angular/` and `client-angular/vercel.json` are superseded by `client-v2`.
  The v1 vercel.json is no longer read once the Vercel Root Directory points at
  `client-v2`. Kept in-tree for reference until the v1 path is fully removed.
