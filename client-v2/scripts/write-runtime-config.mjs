// Build-time generator for public/runtime-config.json.
//
// v2 reads its API base URL at runtime from /runtime-config.json (see
// RuntimeConfigService), NOT from a compiled-in environment file — so a single
// build can be pointed at any backend by editing one JSON file. On a host
// (Vercel) we don't hand-edit; instead this script writes the file from env
// vars at build time, so each environment injects its own URL:
//
//   API_BASE_URL            → apiBaseUrl   (e.g. the preview/prod API origin)
//   GOOGLE_OAUTH_CLIENT_ID  → googleOAuthClientId
//
// v2.31e — resolution order so the deploy works even if the dashboard
// API_BASE_URL var is missing (which it was on preview — the build fell back
// to localhost and every API call failed):
//   1. explicit API_BASE_URL env (host dashboard) — always wins
//   2. a per-Vercel-environment default keyed off VERCEL_ENV
//   3. localhost for local dev (ng serve doesn't run this script anyway)
import { writeFileSync } from 'node:fs';

const PER_ENV = {
  preview:    'https://theballpark-preview-preview.up.railway.app',
  production: 'https://theballpark-production.up.railway.app',
};
const apiBaseUrl =
  process.env.API_BASE_URL
  || PER_ENV[process.env.VERCEL_ENV]
  || 'http://localhost:3001';

const config = {
  apiBaseUrl,
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
};

const target = new URL('../public/runtime-config.json', import.meta.url);
writeFileSync(target, JSON.stringify(config, null, 2) + '\n');
console.log(`[write-runtime-config] apiBaseUrl = ${config.apiBaseUrl}`);
