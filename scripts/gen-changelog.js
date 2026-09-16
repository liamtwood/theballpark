#!/usr/bin/env node
/**
 * Generates CHANGELOG.md + client-v2/public/changelog.json.
 *
 *   npm run changelog
 *
 * Two-track versioning (pV2-RELEASE-VERSIONING-01):
 * - PREVIEW section = client-RELEASE-keyed. Each promote curates
 *   `docs/release-notes/v<MAJOR.MINOR.PATCH>.md` with a meta line
 *   `<!-- Release: v0.1.1 · <name> · <YYYY-MM-DD HH:MM> · built from v2.NNN -->`
 *   and a body of EITHER `## Fixes` (patch → fixes table) OR `## Area` sections
 *   with typed bullets `- new|improved|fixed: <text>` (base/feature).
 * - DEV section ("not yet promoted") = build-keyed pending commits carrying a
 *   `docs/release-notes/<v2.NNN>.md` note (rare; usually empty).
 *
 * Each changelog.json entry (pV2-WHATSNEW-REDESIGN-01 renders these):
 *   { version, name, build, date, datetime, env, notes:[{area,items:[{ref,type,text}]}], fixes:[{ref,type,reporter,text,done}] }
 */
const { execSync } = require('child_process');
const { writeFileSync, readFileSync, existsSync, readdirSync } = require('fs');
const { join } = require('path');

const REPO = join(__dirname, '..');
const NOTES_DIR = join(REPO, 'docs', 'release-notes');
const git = (cmd) => execSync(`git ${cmd}`, { cwd: REPO, encoding: 'utf8' }).trim();

const VERSIONED = /^(\w+)\((v[\d]+\.[\d]+[a-z]*)\):\s*(.+)$/;

function commits(range) {
  const out = git(`log ${range} --no-merges --date=short --format=%h%ad%s`);
  if (!out) return [];
  return out.split('\n').map((line) => {
    const [hash, date, subject] = line.split('');
    const m = VERSIONED.exec(subject || '');
    return m ? { hash, date, version: m[2] } : null;
  }).filter(Boolean);
}

/** First versioned commit date per version (newest-first order preserved). */
function versionDates(list) {
  const seen = new Map();
  for (const c of list) if (!seen.has(c.version)) seen.set(c.version, c.date);
  return seen;
}

const strip = (s) => (s || '').replace(/\*\*/g, '').trim();

/** Parse a note/release markdown body into { notes[], fixes[] }. */
function parseSections(text) {
  const notes = [];
  const fixes = [];
  let mode = null; // 'fixes' | 'area'
  let area = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const h = /^#{2,6}\s+(.+)$/.exec(line);
    if (h) {
      const name = h[1].trim();
      if (/^fixes$/i.test(name)) { mode = 'fixes'; area = null; }
      else { mode = 'area'; area = { area: name, items: [] }; notes.push(area); }
      continue;
    }
    const b = /^[-*]\s+(.+)$/.exec(line);
    if (!b) continue;
    const body = b[1].trim();
    if (mode === 'fixes') {
      // "F-00087 · Enhancement · Beth Pizey · <text> · ✓"
      const cols = body.split('·').map((s) => s.trim());
      fixes.push({
        ref: cols[0] || '',
        type: cols[1] || '',
        reporter: cols[2] || '',
        text: strip(cols[3]),
        done: /✓|done|yes|fixed/i.test(cols[4] || ''),
      });
    } else if (area) {
      // Two shapes: "EP-##### · Type · <text>" (epic ref, text may contain ·)
      // or legacy "new|improved|fixed: <text>" / plain bullet (default new).
      const cols = body.split('·').map((s) => s.trim());
      if (/^[A-Z]{2}-\d+$/i.test(cols[0])) {
        area.items.push({
          ref: cols[0].toUpperCase(),
          type: (cols[1] || 'new').toLowerCase(),
          text: strip(cols.slice(2).join(' · ')),
        });
      } else {
        const tm = /^(new|improved|fixed):\s*(.+)$/i.exec(body);
        area.items.push({ ref: '', type: (tm ? tm[1] : 'new').toLowerCase(), text: strip(tm ? tm[2] : body) });
      }
    }
  }
  return { notes: notes.filter((a) => a.items.length), fixes };
}

/** Build one entry from a release-notes file. */
function parseFile(path, { version, env, date }) {
  const raw = readFileSync(path, 'utf8');
  const meta = (raw.match(/<!--([\s\S]*?)-->/) || [])[1] || '';
  const segs = meta.split('·').map((s) => s.trim());
  const name = env === 'preview' ? (segs[1] || '') : '';
  const datetime = (meta.match(/\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/) || [])[0] || date || '';
  const day = (datetime.match(/\d{4}-\d{2}-\d{2}/) || [])[0] || date || '';
  const build = (meta.match(/built from\s+(v[\d.]+)/i) || [])[1] || '';
  const { notes, fixes } = parseSections(raw);
  return { version, name, build, date: day, datetime, env, notes, fixes };
}

/** Release-keyed preview entries: docs/release-notes/v{0,1}.*.md, newest first. */
function releaseEntries() {
  return readdirSync(NOTES_DIR)
    .filter((f) => /^v[01]\.\d+\.\d+\.md$/.test(f))
    .map((f) => parseFile(join(NOTES_DIR, f), { version: f.replace(/\.md$/, ''), env: 'preview' }))
    .filter((e) => e.notes.length || e.fixes.length)
    .sort((a, b) => cmpSemver(b.version, a.version));
}
function cmpSemver(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

/** Pending (dev) entries: build versions on origin/preview..dev that carry a
 *  build-keyed note file. Same shape as preview entries. */
function pendingEntries() {
  const list = commits('origin/preview..dev');
  const dates = versionDates(list);
  const out = [];
  for (const [version, date] of dates) {
    const path = join(NOTES_DIR, `${version}.md`);
    if (!existsSync(path)) continue;
    const e = parseFile(path, { version, env: 'dev', date });
    if (e.notes.length || e.fixes.length) out.push(e);
  }
  return out;
}

function renderEntry(e) {
  const head = `### ${e.version}${e.name ? ` — ${e.name}` : ''}${e.build ? ` · built from ${e.build}` : ''}${e.datetime ? ` · ${e.datetime}` : ''}`;
  const lines = [head, ''];
  for (const a of e.notes) {
    lines.push(`**${a.area}**`, '');
    for (const it of a.items) lines.push(`- [${it.type}] ${it.text}`);
    lines.push('');
  }
  if (e.fixes.length) {
    lines.push('**Fixes**', '');
    for (const f of e.fixes) lines.push(`- ${f.ref} · ${f.reporter} · ${f.text}${f.done ? ' · ✓' : ''}`);
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  try { execSync('git fetch origin --quiet', { cwd: REPO, stdio: 'ignore' }); } catch { /* offline ok */ }
  try { git('rev-parse --verify origin/preview'); } catch { console.error('[changelog] no origin/preview ref'); process.exit(1); }

  const preview = releaseEntries();
  const dev = pendingEntries();
  const current = preview[0]?.version ?? '(unknown)';

  const md = [
    '# Changelog',
    '',
    '> Generated by `npm run changelog` — **do not edit by hand**.',
    '',
    '## 🚧 On dev — NOT yet on preview',
    '',
    dev.length ? `${dev.length} build${dev.length === 1 ? '' : 's'} pending the next promote.` : '_Nothing pending — dev and preview are level._',
    '',
    ...dev.map(renderEntry),
    '---',
    '',
    `## ✅ On preview — current release \`${current}\``,
    '',
    ...preview.map(renderEntry),
  ].join('\n');
  writeFileSync(join(REPO, 'CHANGELOG.md'), md.replace(/\n{3,}/g, '\n\n'), 'utf8');

  writeFileSync(
    join(REPO, 'client-v2', 'public', 'changelog.json'),
    JSON.stringify({ dev, preview }, null, 2),
    'utf8'
  );

  console.log(`[changelog] preview=${preview.map((r) => r.version).join(', ') || 'none'} · pending=${dev.length} · wrote CHANGELOG.md + changelog.json`);
}

main();
