#!/usr/bin/env node
/**
 * Generates CHANGELOG.md from the versioned git history.
 *
 *   npm run changelog
 *
 * WHY generated, not hand-written: docs/PROGRESS.md was the hand-maintained
 * version of this and went stale within a few ships. Git already holds the
 * truth — every commit is `type(vX.YZ): subject` — so we derive from it.
 *
 * The point of the file is the SPLIT: what's on `dev` but NOT yet promoted to
 * preview. That's the demo list — features a customer can be shown before the
 * next preview promote — and the pending-release list at promote time.
 *
 * Deployment model: preview deploys from the `preview` branch; `dev` is the
 * integration branch. So "pending" == `origin/preview..dev`.
 */
const { execSync } = require('child_process');
const { writeFileSync, readFileSync, existsSync } = require('fs');
const { join } = require('path');

const REPO = join(__dirname, '..');
const git = (cmd) => execSync(`git ${cmd}`, { cwd: REPO, encoding: 'utf8' }).trim();

/** `type(vX.YZ): subject` — the repo's commit convention. Untagged commits
 *  (no version) are skipped: they're not releasable units. */
const VERSIONED = /^(\w+)\((v[\d]+\.[\d]+[a-z]*)\):\s*(.+)$/;

const TYPE_LABEL = { feat: 'Features', fix: 'Fixes', perf: 'Performance', refactor: 'Refactors' };
const TYPE_ORDER = ['feat', 'fix', 'perf', 'refactor', 'chore', 'docs', 'test', 'style'];

function commits(range) {
  const out = git(`log ${range} --no-merges --date=short --format=%h%ad%s`);
  if (!out) return [];
  return out
    .split('\n')
    .map((line) => {
      const [hash, date, subject] = line.split('');
      const m = VERSIONED.exec(subject || '');
      if (!m) return null;
      return { hash, date, type: m[1], version: m[2], subject: m[3] };
    })
    .filter(Boolean);
}

/** Group commits by version, preserving git order (newest first). */
function byVersion(list) {
  const groups = new Map();
  for (const c of list) {
    if (!groups.has(c.version)) groups.set(c.version, { version: c.version, date: c.date, items: [] });
    groups.get(c.version).items.push(c);
  }
  return [...groups.values()];
}

/**
 * Curated, customer-facing notes for a version: `docs/release-notes/<version>.md`.
 * Commit subjects are engineering shorthand — fine as a fallback, but not what
 * you read to a customer. When a notes file exists it becomes the version's
 * headline content; the commit list stays underneath as the detail.
 *
 * Deliberately a 5-line parser over a tiny format (no markdown dep):
 *   ## Area heading
 *   - bullet
 */
function readNotes(version) {
  const path = join(REPO, 'docs', 'release-notes', `${version}.md`);
  if (!existsSync(path)) return null;
  const areas = [];
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      areas.push({ area: heading[1].trim(), items: [] });
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet && areas.length) areas[areas.length - 1].items.push(bullet[1].trim());
  }
  const withItems = areas.filter((a) => a.items.length);
  return withItems.length ? withItems : null;
}

/** A version's commits bucketed by type — Features first, then Fixes, then the
 *  rest (unknown types last). Shared by the markdown + JSON renderers so the
 *  in-app "What's new" page and CHANGELOG.md can never disagree. */
function groupTypes(g) {
  const rank = (t) => (TYPE_ORDER.indexOf(t) < 0 ? 99 : TYPE_ORDER.indexOf(t));
  return [...new Set(g.items.map((i) => i.type))]
    .sort((a, b) => rank(a) - rank(b))
    .map((t) => ({
      type: t,
      label: TYPE_LABEL[t] ?? t[0].toUpperCase() + t.slice(1),
      items: g.items.filter((i) => i.type === t).map((i) => ({ subject: i.subject, hash: i.hash })),
    }));
}

function renderVersion(g) {
  const lines = [`### ${g.version} — ${g.date}`, ''];
  const notes = readNotes(g.version);
  if (notes) {
    for (const a of notes) {
      lines.push(`**${a.area}**`, '');
      for (const item of a.items) lines.push(`- ${item}`);
      lines.push('');
    }
    lines.push('<details><summary>Commits</summary>', '');
  }
  for (const grp of groupTypes(g)) {
    lines.push(`**${grp.label}**`, '');
    for (const i of grp.items) lines.push(`- ${i.subject} \`${i.hash}\``);
    lines.push('');
  }
  if (notes) lines.push('</details>', '');
  return lines.join('\n');
}

/**
 * One version as the in-app What's new page renders it — CURATED NOTES ONLY.
 *
 * Deliberately NOT the commit list: `client-v2/public/` is served flat and
 * unauthenticated, so anything here is world-readable on preview. Shipping the
 * commit groups meant 726 commit subjects + hashes at `/changelog.json`,
 * including a map of the admin surface and its interim gates (audit 2026-07-17
 * S3). The full history stays in CHANGELOG.md, which is never deployed.
 *
 * null for versions with no notes file — they're simply absent from the page.
 * The page shows what the author chose to say, not a git-log projection.
 */
function toJson(g) {
  const notes = readNotes(g.version);
  return notes ? { version: g.version, date: g.date, notes } : null;
}

function main() {
  try {
    execSync('git fetch origin --quiet', { cwd: REPO, stdio: 'ignore' });
  } catch {
    // Offline is fine — we just report against the refs we already have.
  }

  let previewRef = 'origin/preview';
  try {
    git(`rev-parse --verify ${previewRef}`);
  } catch {
    console.error(`[changelog] no ${previewRef} ref — is preview pushed?`);
    process.exit(1);
  }

  const pending = byVersion(commits(`${previewRef}..dev`));
  const released = byVersion(commits(previewRef));
  const previewVersion = released[0]?.version ?? '(unknown)';

  const out = [
    '# Changelog',
    '',
    '> Generated by `npm run changelog` — **do not edit by hand**.',
    '> Derived from the versioned git history (`type(vX.YZ): subject`).',
    '',
    '---',
    '',
    '## 🚧 On dev — NOT yet on preview',
    '',
    pending.length
      ? `These are live on **dev** only — the demo list. Promoting \`dev\` → \`preview\` ships ${pending.length} version${pending.length === 1 ? '' : 's'}.`
      : '_Nothing pending — dev and preview are level._',
    '',
    ...pending.map(renderVersion),
    '---',
    '',
    `## ✅ On preview — currently \`${previewVersion}\``,
    '',
    ...released.map(renderVersion),
  ].join('\n');

  writeFileSync(join(REPO, 'CHANGELOG.md'), out.replace(/\n{3,}/g, '\n\n'), 'utf8');

  // The in-app "What's new" page (user menu → above Sign out) reads this from the
  // client's static assets.
  //
  // Two EXPLICIT sections, not a list + a "current version" marker: the page
  // renders `dev` and `preview` verbatim and computes nothing. Whatever branch
  // this runs on bakes in the split — on `dev`, `dev[]` is the demo list; run it
  // on `preview` at promote time and `origin/preview..dev` is empty, so `dev[]`
  // empties and those versions appear under `preview[]`. There is no
  // `previewVersion` pill left to be stale, so the page can't invert itself the
  // way it would have on the last promote (audit 2026-07-17 B3).
  const json = {
    dev: pending.map(toJson).filter(Boolean),
    preview: released.map(toJson).filter(Boolean),
  };
  writeFileSync(join(REPO, 'client-v2', 'public', 'changelog.json'), JSON.stringify(json, null, 2), 'utf8');

  console.log(
    `[changelog] preview=${previewVersion} · pending=${pending.length ? pending.map((p) => p.version).join(', ') : 'none'} · wrote CHANGELOG.md + client-v2/public/changelog.json`
  );
}

main();
