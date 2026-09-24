#!/usr/bin/env node
// pV2-RELEASE-VERSIONING-01 — auto-increment the DEV build chip on every commit.
// Run from a pre-commit hook (see .git/hooks/pre-commit): bumps `build` and
// `versionChip` in environment.ts from v2.NNN → v2.(NNN+1) and lets the hook stage
// the file so the bump rides along in the same commit. Never throws — a parse miss
// leaves the file untouched so a commit is never blocked by versioning.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'environments', 'environment.ts');
try {
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/build:\s*'v2\.(\d+)'/);
  if (!m) { process.exit(0); } // no recognisable build line — leave it alone
  const next = Number(m[1]) + 1;
  const out = src
    .replace(/build:\s*'v2\.\d+'/, `build: 'v2.${next}'`)
    .replace(/versionChip:\s*'Dev v2\.\d+'/, `versionChip: 'Dev v2.${next}'`);
  if (out !== src) fs.writeFileSync(file, out);
} catch {
  /* never block a commit on the version bump */
}
