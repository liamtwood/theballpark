# Deployment Guide

## Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL database
- `.env` file in project root (see Environment Variables below)

### One command start
```bash
npm run dev
```
This uses `concurrently` to start both:
- **Backend** (Express on port 3001): `server/`
- **Frontend** (Angular on port 4200): `client-angular/`

### Individual services
```bash
npm run dev:server    # Backend only
npm run dev:client    # Frontend only
```

### First-time setup
```bash
npm run install:all   # Install root + server + client-angular deps
npm run db:migrate    # Create database tables
npm run db:seed       # Populate sample data
```

## Branch Strategy

| Branch | Purpose | Deploys to |
|--------|---------|------------|
| `dev` | Active development | Preview environment |
| `master` | Stable releases only | Production |

### Workflow
1. All work happens on `dev` (or feature branches merged into `dev`)
2. Test thoroughly on preview environment
3. When stable, merge `dev` into `master`:
   ```bash
   git checkout master
   git merge dev
   git push origin master
   ```
4. Production deploys automatically from `master`

## Environment Variables

Create a `.env` file in the project root with these variables:

```
DATABASE_URL=           # PostgreSQL connection string
PORT=                   # Server port (default: 3001)
NODE_ENV=development    # 'development' or 'production'
ANTHROPIC_API_KEY=      # Claude API key for AI brief parsing
ALLOWED_ORIGINS=http://localhost:4200  # Comma-separated CORS origins
```

### Railway environment variables (production)
```
NODE_ENV=production
ALLOWED_ORIGINS=https://theballpark.ai,https://www.theballpark.ai
```

### Railway environment variables (preview)
```
NODE_ENV=production
ALLOWED_ORIGINS=https://preview.theballpark.ai,http://localhost:4200
```

Frontend environment files are in `client-angular/src/environments/`:
- `environment.ts` — local development
- `environment.staging.ts` — preview/staging
- `environment.prod.ts` — production

Each defines `apiUrl` and `version`.

## Vercel Configuration

The Angular frontend deploys to Vercel.

- **Framework**: Angular
- **Build command**: `cd client-angular && ng build --configuration production`
- **Output directory**: `client-angular/dist/client-angular/browser`
- **Install command**: `cd client-angular && npm install`

Environment-specific builds use `--configuration`:
- `production` — uses `environment.prod.ts`
- `preview` — uses `environment.staging.ts`

## Railway Configuration

The Express backend deploys to Railway.

- **Start command**: `cd server && node src/index.js`
- **Environment variables**: Set `DATABASE_URL`, `PORT`, `NODE_ENV`, `ANTHROPIC_API_KEY`, and `ALLOWED_ORIGINS` in Railway dashboard
- **Health check**: `GET /` returns server status

The PostgreSQL database is provisioned as a Railway service. The `DATABASE_URL` is automatically available.
