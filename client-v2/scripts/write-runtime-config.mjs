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
// Locally (ng serve) this script does not run, so the committed localhost
// default in public/runtime-config.json stays in place for dev.
import { writeFileSync } from 'node:fs';

const config = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
};

const target = new URL('../public/runtime-config.json', import.meta.url);
writeFileSync(target, JSON.stringify(config, null, 2) + '\n');
console.log(`[write-runtime-config] apiBaseUrl = ${config.apiBaseUrl}`);
