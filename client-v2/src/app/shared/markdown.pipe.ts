import { Pipe, PipeTransform } from '@angular/core';

/** pV2-BUILDUP-04 — a minimal, SAFE markdown→HTML renderer for user-entered
 *  item text (description / services / details): bold, italic, bullet lists,
 *  and blank-line spacers. It HTML-escapes the source first and only ever emits
 *  <strong>/<em>/<ul>/<li>/<p>/<br> — so binding the result with [innerHTML]
 *  stays safe under Angular's default sanitizer (we NEVER bypassSecurityTrust,
 *  so injected markup can't smuggle scripts/handlers through).
 *
 *  Each non-empty line is its own paragraph; a blank line BETWEEN content emits a
 *  <br> spacer (one per blank line), so an empty row renders as an empty row.
 *  Leading/trailing blank lines are dropped.
 *
 *  Line syntax (beyond inline bold/italic + bullets):
 *    # / ## / ###  → heading 1 / 2 / 3 (bp-md-h1..h3)
 *    !!            → Shout Out (bold, centred, one size up — bp-md-shout)
 *    >             → shaded callout box (consecutive > lines group — bp-md-box)
 *  Still escaped + whitelist-only (we emit fixed classes, never raw HTML), so it
 *  stays safe under [innerHTML] without bypassSecurityTrust. `heading` mode
 *  (Details) renders a non-# line as a bold sub-heading instead of a paragraph. */
@Pipe({ name: 'md', standalone: true })
export class MarkdownPipe implements PipeTransform {
  transform(src: string | null | undefined, mode: 'prose' | 'heading' = 'prose'): string {
    if (!src) return '';
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = (s: string) =>
      esc(s)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>');
    let html = '';
    let inList = false;
    let boxLines: string[] | null = null; // consecutive `>` lines, buffered then rendered recursively
    let pendingGaps = 0;    // blank lines seen since the last content — flushed before the next
    let hasContent = false; // so leading (and trailing) blank lines are dropped
    const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
    // A shaded callout box renders its inner content as FULL markdown (headings,
    // bullets, bold/italic all work inside) by recursing on the un-prefixed lines.
    const closeBox = () => {
      if (boxLines) { html += `<div class="bp-md-box">${this.transform(boxLines.join('\n'), mode)}</div>`; boxLines = null; }
    };
    const flushGaps = () => { for (; pendingGaps > 0; pendingGaps--) html += '<br>'; };
    for (const raw of src.split('\n')) {
      const line = raw.trimEnd();
      const box = line.match(/^>\s?(.*)$/);
      if (box) {
        // Buffer this box line (prefix stripped); consecutive `>` lines group into
        // ONE box. A blank line (or any non-`>` line) ends it.
        closeList();
        flushGaps();
        (boxLines ??= []).push(box[1]);
        hasContent = true;
        continue;
      }
      closeBox(); // any non-box line ends an open box first
      const bullet = line.match(/^\s*[•\-*]\s+(.*)$/);
      const heading = line.match(/^(#{1,3})\s+(.*\S)\s*$/);
      const shout = line.match(/^!!\s+(.*\S)\s*$/);
      if (bullet) {
        flushGaps();
        if (!inList) { html += '<ul class="bp-md-list">'; inList = true; }
        html += `<li>${inline(bullet[1])}</li>`;
        hasContent = true;
      } else if (heading) {
        closeList();
        flushGaps();
        html += `<p class="bp-md-h${heading[1].length}">${inline(heading[2])}</p>`;
        hasContent = true;
      } else if (shout) {
        closeList();
        flushGaps();
        html += `<p class="bp-md-shout">${inline(shout[1])}</p>`;
        hasContent = true;
      } else if (line.trim() === '') {
        closeList();
        if (hasContent) pendingGaps++; // a blank line → one <br> spacer (emitted before next content)
      } else {
        closeList();
        flushGaps();
        // In Details, a non-bulleted line is a category sub-heading (bold).
        html += mode === 'heading'
          ? `<p class="bp-md-heading">${inline(line)}</p>`
          : `<p>${inline(line)}</p>`;
        hasContent = true;
      }
    }
    closeList();
    closeBox();
    return html;
  }
}
