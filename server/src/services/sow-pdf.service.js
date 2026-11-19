// pV2-SOW-01 — server-side SOW PDF generator (pure pdf-lib, no browser). Draws a
// clean legal document from a flat "print model" (an ordered list of blocks the
// client already renders), with word-wrap, pagination, a small markdown subset
// (bold + bullets) and simple bordered tables. Phase 1 = the body; the page frame
// (header/supplier-letterhead footer) and the T&C merge + continuous page numbers
// layer on in later phases.

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Ballpark wordmark for the running header (top-left). Loaded once; absent → skipped.
let LOGO_BYTES = null;
try { LOGO_BYTES = fs.readFileSync(path.join(__dirname, '../assets/ballpark-logo.png')); } catch { LOGO_BYTES = null; }

// A4 in points, generous legal-document margins.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 54;
const HEADER_H = 46; // reserved band for the logo + running header
const FOOTER_H = 48; // reserved band for the supplier letterhead footer
const CONTENT_W = PAGE_W - MARGIN * 2;
const BODY_TOP = PAGE_H - MARGIN - HEADER_H;
const BODY_BOTTOM = MARGIN + FOOTER_H;

const COLORS = {
  text: rgb(0.13, 0.13, 0.15),
  muted: rgb(0.42, 0.42, 0.46),
  rule: rgb(0.85, 0.85, 0.88),
  headBar: rgb(0.98, 0.93, 0.96), // soft tint, echoes the UI section bar
  strong: rgb(0.08, 0.08, 0.1),
};

/** A drawing cursor over a growing set of pages. */
function makeDoc(pdf, font, bold) {
  // `indent` = the current left offset (set by the last heading) so body content
  // lines up under its heading.
  const state = { pdf, font, bold, page: null, y: 0, indent: 0 };
  state.page = pdf.addPage([PAGE_W, PAGE_H]);
  state.y = BODY_TOP;
  return state;
}
function newPage(d) {
  d.page = d.pdf.addPage([PAGE_W, PAGE_H]);
  d.y = BODY_TOP;
}
/** Ensure `h` points fit on the current page; start a new one if not. */
function ensure(d, h) {
  if (d.y - h < BODY_BOTTOM) newPage(d);
}

/** Wrap a single run of text (one font) to a width, returning the lines. */
function wrapRun(text, font, size, maxW) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** Draw one paragraph line made of mixed bold/regular segments, wrapped to maxW
 *  at indent x. Returns nothing; advances the cursor. */
function drawRichLine(d, segments, x, maxW, size, lh) {
  // Flatten to words tagged with their font, then greedily wrap.
  const words = [];
  for (const seg of segments) {
    const f = seg.bold ? d.bold : d.font;
    for (const w of String(seg.text).split(/(\s+)/)) {
      if (w === '') continue;
      words.push({ t: w, f });
    }
  }
  let lineWords = [];
  let lineW = 0;
  const flush = () => {
    ensure(d, lh);
    let cx = x;
    for (const ww of lineWords) {
      const t = ww.t;
      d.page.drawText(t, { x: cx, y: d.y - size, size, font: ww.f, color: COLORS.text });
      cx += ww.f.widthOfTextAtSize(t, size);
    }
    d.y -= lh;
    lineWords = [];
    lineW = 0;
  };
  for (const ww of words) {
    const wWidth = ww.f.widthOfTextAtSize(ww.t, size);
    const isSpace = /^\s+$/.test(ww.t);
    if (!isSpace && lineW + wWidth > maxW && lineWords.length) flush();
    if (isSpace && lineWords.length === 0) continue; // no leading space
    lineWords.push(ww);
    lineW += wWidth;
  }
  if (lineWords.length) flush();
}

/** Parse `**bold**` into segments for a line. */
function parseInline(text) {
  const segs = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), bold: false });
    segs.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last), bold: false });
  return segs.length ? segs : [{ text: '', bold: false }];
}

/** Draw a markdown subset: paragraphs, bullets (- * •), and inline **bold**.
 *  Indents to the current heading (d.indent). */
function drawMarkdown(d, md, size = 10.5) {
  const x = MARGIN + d.indent;
  const maxW = CONTENT_W - d.indent;
  const lh = size * 1.4;
  const raw = String(md ?? '').replace(/\r\n/g, '\n').split('\n');
  for (const line of raw) {
    const t = line.trim();
    if (!t) { d.y -= lh * 0.5; continue; } // blank line = small gap
    const bullet = /^[-*•]\s+/.test(t);
    const body = bullet ? t.replace(/^[-*•]\s+/, '') : t;
    const segs = parseInline(body);
    if (bullet) {
      ensure(d, lh);
      d.page.drawText('•', { x: x + 4, y: d.y - size, size, font: d.font, color: COLORS.text });
      drawRichLine(d, segs, x + 16, maxW - 16, size, lh);
    } else {
      drawRichLine(d, segs, x, maxW, size, lh);
    }
  }
}

/** A numbered heading. level 0 = section: bold title with a thin rule beneath
 *  (clean legal style, no highlight); deeper levels = plain bold, indented. */
function drawHeading(d, num, title, level, opts = {}) {
  if (opts.pageBreak) newPage(d);
  if (opts.center) {
    // Centered, UPPERCASE, un-numbered major title with a full-width rule — used
    // identically for the document title and the "Appendices" divider.
    const size = 18;
    ensure(d, size + 42);
    d.y -= 22;
    const t = String(title).toUpperCase();
    const w = d.bold.widthOfTextAtSize(t, size);
    d.page.drawText(t, { x: MARGIN + (CONTENT_W - w) / 2, y: d.y - size, size, font: d.bold, color: COLORS.strong });
    d.y -= size + 6;
    if (opts.subtitle) {
      const ss = 9;
      const sw = d.font.widthOfTextAtSize(opts.subtitle, ss);
      d.page.drawText(opts.subtitle, { x: MARGIN + (CONTENT_W - sw) / 2, y: d.y - ss, size: ss, font: d.font, color: COLORS.muted });
      d.y -= ss + 6;
    }
    d.page.drawLine({ start: { x: MARGIN, y: d.y }, end: { x: MARGIN + CONTENT_W, y: d.y }, thickness: 1, color: COLORS.rule });
    d.y -= 12;
    d.indent = 0;
    return;
  }
  const size = level === 0 ? 13 : level === 1 ? 11 : 10.5;
  const indent = Math.max(0, level - 1) * 14;
  ensure(d, size + (level === 0 ? 24 : 12));
  d.y -= level === 0 ? 14 : 6; // space above
  const label = num ? `${num} - ` : '';
  d.page.drawText(`${label}${title}`, { x: MARGIN + indent, y: d.y - size, size, font: d.bold, color: COLORS.strong });
  d.y -= size + (level === 0 ? 5 : 2);
  if (level === 0) {
    d.page.drawLine({ start: { x: MARGIN, y: d.y }, end: { x: MARGIN + CONTENT_W, y: d.y }, thickness: 0.75, color: COLORS.rule });
    d.y -= 8;
  } else {
    d.y -= 5; // breathing room between a subsection heading and its body
  }
  d.indent = indent; // body under this heading lines up with it
}

/** A bordered table. columns: [{header, width, align?}]; rows: [[str,...]]. */
function drawTable(d, columns, rows) {
  const size = 9.5;
  const pad = 5;
  const lh = size * 1.3;
  const left = MARGIN + d.indent;
  const contentW = CONTENT_W - d.indent;
  const totalW = columns.reduce((s, c) => s + c.width, 0);
  const scale = contentW / totalW;
  const widths = columns.map((c) => c.width * scale);

  const drawRow = (cells, { head = false } = {}) => {
    const font = head ? d.bold : d.font;
    // wrap each cell, row height = tallest cell
    const wrapped = cells.map((cell, i) => wrapRun(cell ?? '', font, size, widths[i] - pad * 2));
    const rowH = Math.max(...wrapped.map((w) => w.length)) * lh + pad * 2;
    ensure(d, rowH);
    const top = d.y;
    if (head) d.page.drawRectangle({ x: left, y: top - rowH, width: contentW, height: rowH, color: COLORS.headBar });
    let cx = left;
    wrapped.forEach((lines, i) => {
      const align = columns[i].align || 'left';
      lines.forEach((ln, li) => {
        const w = font.widthOfTextAtSize(ln, size);
        const tx = align === 'right' ? cx + widths[i] - pad - w : align === 'center' ? cx + (widths[i] - w) / 2 : cx + pad;
        d.page.drawText(ln, { x: tx, y: top - pad - size - li * lh, size, font, color: head ? COLORS.strong : COLORS.text });
      });
      cx += widths[i];
    });
    // bottom rule
    d.page.drawLine({ start: { x: left, y: top - rowH }, end: { x: left + contentW, y: top - rowH }, thickness: 0.5, color: COLORS.rule });
    d.y = top - rowH;
  };

  d.y -= 4;
  drawRow(columns.map((c) => c.header), { head: true });
  for (const r of rows) drawRow(r);
  d.y -= 14; // clear gap before the next heading/content
}

/** Stamp the running header (project / ref) and the supplier-letterhead footer
 *  onto one page. Page numbers are added later, across the merged doc (Phase 3). */
function stampFrame(page, font, bold, frame, logo) {
  const header = frame && frame.header;
  const footer = frame && frame.footer;
  if (header) {
    // Logo high and to the left, up in the top margin.
    if (logo) {
      const lh = 15;
      const lw = lh * (logo.width / logo.height);
      page.drawImage(logo, { x: MARGIN - 20, y: PAGE_H - 20 - lh, width: lw, height: lh });
    }
    // Project / ref-date line on the content margin, with a rule under.
    const hs = 8.5;
    const by = PAGE_H - MARGIN - hs;
    if (header.project) page.drawText(String(header.project), { x: MARGIN, y: by, size: hs, font, color: COLORS.muted });
    const right = [header.ref, header.date].filter(Boolean).join(' · ');
    if (right) {
      const rw = font.widthOfTextAtSize(right, hs);
      page.drawText(right, { x: PAGE_W - MARGIN - rw, y: by, size: hs, font, color: COLORS.muted });
    }
    page.drawLine({ start: { x: MARGIN, y: by - 5 }, end: { x: PAGE_W - MARGIN, y: by - 5 }, thickness: 0.5, color: COLORS.rule });
  }
  if (footer) {
    const fs = 7.5;
    const lh = fs * 1.4;
    const lines = [];
    if (footer.name) lines.push({ t: footer.name, b: true });
    if (footer.address) lines.push({ t: footer.address });
    const regvat = [footer.companyNumber ? `Company Reg ${footer.companyNumber}` : null, footer.vatNumber ? `VAT ${footer.vatNumber}` : null].filter(Boolean).join('    ');
    if (regvat) lines.push({ t: regvat });
    let fy = MARGIN + FOOTER_H - 12;
    page.drawLine({ start: { x: MARGIN, y: fy + 7 }, end: { x: PAGE_W - MARGIN, y: fy + 7 }, thickness: 0.5, color: COLORS.rule });
    for (const ln of lines) {
      const f = ln.b ? bold : font;
      const w = f.widthOfTextAtSize(ln.t, fs);
      page.drawText(ln.t, { x: MARGIN + (CONTENT_W - w) / 2, y: fy - fs, size: fs, font: f, color: COLORS.muted });
      fy -= lh;
    }
  }
}

/** Build the SOW body PDF (content + header/letterhead footer). Returns the
 *  PDFDocument so the T&C can be appended before saving. */
async function buildBody(blocks, frame = {}, title = null) {
  const pdf = await PDFDocument.create();
  // Embedded document metadata — Chrome/Firefox show /Title as the viewer tab's
  // name, so give it the SOW identifier rather than a blob id.
  if (title) pdf.setTitle(title);
  pdf.setAuthor('Ballpark');
  pdf.setProducer('Ballpark');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = LOGO_BYTES ? await pdf.embedPng(LOGO_BYTES).catch(() => null) : null;
  const d = makeDoc(pdf, font, bold);

  // Document title — same centered/uppercase/rule treatment as "Appendices", with
  // a small grey platform subtitle under it.
  drawHeading(d, null, 'Statement of Work', 0, { center: true, subtitle: 'Generated via the Ballpark platform' });

  for (const b of blocks || []) {
    switch (b.kind) {
      case 'heading': drawHeading(d, b.num, b.title, b.level ?? 0, { pageBreak: b.pageBreak, center: b.center }); break;
      case 'text': if (b.md) drawMarkdown(d, b.md); break;
      case 'table': drawTable(d, b.columns || [], b.rows || []); break;
      case 'note': { d.y -= 2; drawMarkdown(d, b.md, 9.5); break; }
      default: break;
    }
  }
  for (const page of pdf.getPages()) stampFrame(page, font, bold, frame, logo);
  return pdf;
}

/** Append the supplier's T&C PDF pages (vector), normalising each page's WIDTH to
 *  the SOW's (A4) so a Letter-sized T&C doesn't come out wider than the document. */
async function appendTerms(pdf, termsBytes) {
  const terms = await PDFDocument.load(termsBytes, { ignoreEncryption: true });
  const pages = await pdf.copyPages(terms, terms.getPageIndices());
  for (const p of pages) {
    const w = p.getWidth();
    if (w > 0 && Math.abs(w - PAGE_W) > 0.5) p.scale(PAGE_W / w, PAGE_W / w); // uniform → match SOW width
    pdf.addPage(p);
  }
}

/** Stamp "Page X of Y" centered at the foot of EVERY page (SOW + merged T&C),
 *  positioned per page so it survives differing T&C page sizes. */
async function stampPageNumbers(pdf) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const n = pages.length;
  pages.forEach((page, i) => {
    const { width } = page.getSize();
    const t = `Page ${i + 1} of ${n}`;
    const w = font.widthOfTextAtSize(t, 8);
    page.drawText(t, { x: (width - w) / 2, y: 28, size: 8, font, color: COLORS.muted });
  });
}

/** Full SOW PDF: body + header/letterhead footer, the supplier T&C merged at the
 *  end, and continuous page numbers across the whole combined document. */
async function generateBody(blocks, frame = {}, termsBytes = null, title = null) {
  const pdf = await buildBody(blocks, frame, title);
  if (termsBytes) {
    try { await appendTerms(pdf, termsBytes); }
    catch (e) { /* unreadable/encrypted T&C → skip the merge, keep the SOW */ }
  }
  await stampPageNumbers(pdf);
  return pdf.save();
}

module.exports = { generateBody, PAGE_W, PAGE_H, MARGIN };
