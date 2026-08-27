import { Pipe, PipeTransform } from '@angular/core';

/** pV2-BUILDUP-04 — a minimal, SAFE markdown→HTML renderer for user-entered
 *  item text (description / services / details): bold, italic, and bullet
 *  lists. It HTML-escapes the source first and only ever emits
 *  <strong>/<em>/<ul>/<li>/<p>/<br> — so binding the result with [innerHTML]
 *  stays safe under Angular's default sanitizer (we NEVER bypassSecurityTrust,
 *  so injected markup can't smuggle scripts/handlers through).
 *
 *  Not a full markdown engine (no links/tables/headings-with-#) — deliberately
 *  the small formatting subset v1 supported. `heading` mode (Details) renders a
 *  non-bulleted line as a bold sub-heading instead of a paragraph. */
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
    const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
    for (const raw of src.split('\n')) {
      const line = raw.trimEnd();
      const bullet = line.match(/^\s*[•\-*]\s+(.*)$/);
      if (bullet) {
        if (!inList) { html += '<ul class="bp-md-list">'; inList = true; }
        html += `<li>${inline(bullet[1])}</li>`;
      } else if (line.trim() === '') {
        closeList();
      } else {
        closeList();
        // In Details, a non-bulleted line is a category sub-heading (bold).
        html += mode === 'heading'
          ? `<p class="bp-md-heading">${inline(line)}</p>`
          : `<p>${inline(line)}</p>`;
      }
    }
    closeList();
    return html;
  }
}
