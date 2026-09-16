#!/usr/bin/env node
/**
 * Generates CHANGELOG.md + client-v2/public/changelog.json.
 *
 *   npm run changelog
 *
 * Two-track versioning (pV2-RELEASE-VERSIONING-01):
 * - **Preview section** is CLIENT-RELEASE-keyed. Each promote curates a
 *   release note `docs/release-notes/v<MAJOR.MINOR.PATCH>.md` with a meta line
 *   `<!-- Release: v0.1.1 · <title> · <YYYY-MM-DD> · built from v2.NNN -->` and
 *   `## Area` / `- bullet` body. The What's New page headlines the release
 *   version + "built from vX.NNN".
 * - **"On dev — not yet on preview"** stays BUILD-keyed (the internal demo
 *   list): versioned commits `origin/preview..dev` that carry a build-keyed
 *   note file `docs/release-notes/<v2.NNN>.md` (rare; usually empty).
 */
const { execSync } = require('child_process');
const { writeFileSync, readFileSync, existsSync, readdirSync } = require('fs');
const { join } = require('path');

const REPO = join(__dirname, '..');
const NOTES_DIR = join(REPO, 'docs', 'release-notes');
const git = (cmd) => execSync(`git ${cmd}`, { cwd: REPO, encoding: 'utf8' }).trim();

/** `type(vX.YZ): subject` — the repo's commit convention. */
const VERSIONED = /^(\w+)\((v[\d]+\.[\d]+[a-z]*)\):\s*(.+)$/;
const TYPE_LABEL = { feat: 'Features', fix: 'Fixes', perf: 'Performance', refactor: 'Refactors' };
const TYPE_ORDER = ['feat', 'fix', 'perf', 'refactor', 'chore', 'docs', 'test', 'style'];

function commits(range) {
  const out = git(`log ${range} --no-merges --date=short --format=%h%ad%s`);
  if (!out) return [];
  return out
    .split('\n')
    .map((line) => {
      const [hash, date, subject] = line.split('');
      const m = VERSIONED.exec(subject || '');
      if (!m) return null;
      return { hash, date, type: m[1], version: m[2], subject: m[3] };
    })
    .filter(Boolean);
}

function byVersion(list) {
  const groups = new Map();
  for (const c of list) {
    if (!groups.has(c.version)) groups.set(c.version, { version: c.version, date: c.date, items: [] });
    groups.get(c.version).items.push(c);
  }
  return [...groups.values()];
}

/** Parse a release/notes markdown body into `[{area, items[]}]` (## heading →
 *  `- bullet`). Ignores the `<!-- Release: … -->` meta comment + prose. */
function parseAreas(text) {
  const areas = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const heading = /^#{2,6}\s+(.+)$/.exec(line); // ## Area (not the # title)
    if (heading) { areas.push({ area: heading[1].trim(), items: [] }); continue; }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet && areas.length) areas[areas.length - 1].items.push(bullet[1].trim());
  }
  return areas.filter((a) => a.items.length);
}

/** Build-keyed note for a v2.NNN version (the dev/demo section). */
function readBuildNotes(version) {
  const path = join(NOTES_DIR, `${version}.md`);
  if (!existsSync(path)) return null;
  const areas = parseAreas(readFileSync(path, 'utf8'));
  return areas.length ? areas : null;
}

/** Release-keyed preview entries: docs/release-notes/v{0,1}.*.md, newest first.
 *  Meta comment supplies the source build + date. */
function releaseEntries() {
  const files = readdirSync(NOTES_DIR).filter((f) => /^v[01]\.\d+\.\d+\.md$/.test(f));
  const out = [];
  for (const f of files) {
    const release = f.replace(/\.md$/, '');
    const raw = readFileSync(join(NOTES_DIR, f), 'utf8');
    const meta = (raw.match(/<!--([\s\S]*?)-->/) || [])[1] || '';
    const build = (meta.match(/built from\s+(v[\d.]+)/i) || [])[1] || '';
    const date = (meta.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
    const notes = parseAreas(raw);
    if (notes.length) out.push({ version: release, build, date, notes });
  }
  out.sort((a, b) => cmpSemver(b.version, a.version));
  return out;
}
function cmpSemver(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

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

/** A pending (dev) version for CHANGELOG.md — build-keyed. */
function renderPending(g) {
  const lines = [`### ${g.version} — ${g.date}`, ''];
  const notes = readBuildNotes(g.version);
  if (notes) {
    for (const a of notes) { lines.push(`**${a.area}**`, ''); for (const item of a.items) lines.push(`- ${item}`); lines.push(''); }
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

/** A release entry for CHANGELOG.md — release-keyed. */
function renderRelease(e) {
  const lines = [`### ${e.version}${e.build ? ` — built from ${e.build}` : ''}${e.date ? ` · ${e.date}` : ''}`, ''];
  for (const a of e.notes) { lines.push(`**${a.area}**`, ''); for (const item of a.items) lines.push(`- ${item}`); lines.push(''); }
  return lines.join('\n');
}

function main() {
  try { execSync('git fetch origin --quiet', { cwd: REPO, stdio: 'ignore' }); } catch { /* offline ok */ }

  let previewRef = 'origin/preview';
  try { git(`rev-parse --verify ${previewRef}`); } catch { console.error(`[changelog] no ${previewRef} ref`); process.exit(1); }

  const pending = byVersion(commits(`${previewRef}..dev`));
  const releases = releaseEntries();
  const currentRelease = releases[0]?.version ?? '(unknown)';

  const out = [
    '# Changelog',
    '',
    '> Generated by `npm run changelog` — **do not edit by hand**.',
    '> Preview = client releases (docs/release-notes/v*.md); dev = pending builds.',
    '',
    '---',
    '',
    '## 🚧 On dev — NOT yet on preview',
    '',
    pending.length
      ? `Live on **dev** only — the demo list. ${pending.length} build${pending.length === 1 ? '' : 's'} pending the next promote.`
      : '_Nothing pending — dev and preview are level._',
    '',
    ...pending.map(renderPending),
    '---',
    '',
    `## ✅ On preview — current release \`${currentRelease}\``,
    '',
    ...releases.map(renderRelease),
  ].join('\n');
  writeFileSync(join(REPO, 'CHANGELOG.md'), out.replace(/\n{3,}/g, '\n\n'), 'utf8');

  // In-app What's New (user menu → above Sign out): dev = build-keyed pending
  // (internal demo list); preview = release-keyed (client releases + source build).
  const json = {
    dev: pending
      .map((g) => { const notes = readBuildNotes(g.version); return notes ? { version: g.version, date: g.date, notes } : null; })
      .filter(Boolean),
    preview: releases,
  };
  writeFileSync(join(REPO, 'client-v2', 'public', 'changelog.json'), JSON.stringify(json, null, 2), 'utf8');

  console.log(
    `[changelog] preview release=${currentRelease} · releases=${releases.map((r) => r.version).join(', ') || 'none'} · pending builds=${pending.length} · wrote CHANGELOG.md + changelog.json`
  );
}

main();
