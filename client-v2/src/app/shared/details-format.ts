/** pV2-BUILDUP-04 — shared parsing/formatting for a line's free-text Details
 *  field, used by BOTH the inbox editor and the read-only cards (inbox + Final
 *  Quote). One definition so the inline "qty@price" calc and the running total
 *  can't drift between surfaces. */

const SYMBOLS: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', JPY: '¥', AUD: '$', CAD: '$', NZD: '$' };

/** ISO currency code → symbol (defaults to £). */
export function currencySymbol(code?: string | null): string {
  return SYMBOLS[code || 'GBP'] ?? '£';
}

/** Thousands separators, rounded to 2dp (e.g. 18000 → "18,000"). */
export function withCommas(n: number): string {
  const s = String(Math.round(n * 100) / 100);
  const [int, dec] = s.split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? '.' + dec : '');
}

/** Evaluate a "qty@price" or "N×M" expression in a line into
 *  "… = <sym><total>". Op is @ (qty@price) or x/×/*; a currency sign may sit
 *  before either number, else `fallbackSym`. Idempotent — a trailing numeric
 *  "= <result>" is stripped and recomputed; the expression itself is kept. */
export function detailsCalcLine(line: string, fallbackSym: string): string {
  const m = line.match(/([$£€¥]?)\s*(\d+(?:\.\d+)?)\s*[@x×*]\s*([$£€¥]?)\s*(\d+(?:\.\d+)?)/i);
  if (!m) return line;
  const total = Number(m[2]) * Number(m[4]);
  if (!Number.isFinite(total)) return line;
  const sym = m[1] || m[3] || fallbackSym;
  const base = line.replace(/\s*=\s*[$£€¥]?\s*[\d,]*(?:\.\d+)?\s*$/, '').trimEnd();
  return `${base} = ${sym}${withCommas(total)}`;
}

/** Sum each line's trailing "= <total>" and the sign the lines use (falling
 *  back to `fallbackSym` when a line is unsigned). */
export function detailsTotal(text: string | null | undefined, fallbackSym: string): { sum: number; sym: string } {
  let sum = 0;
  let sym = '';
  for (const raw of (text ?? '').split('\n')) {
    const m = detailsCalcLine(raw, fallbackSym).match(/=\s*([$£€¥]?)\s*([\d,]+(?:\.\d+)?)\s*$/);
    if (m) {
      sum += Number(m[2].replace(/,/g, ''));
      if (!sym && m[1]) sym = m[1];
    }
  }
  return { sum, sym: sym || fallbackSym };
}

/** Formatted Details total ("£3,100"), or '' when no line carries a cost. */
export function detailsTotalStr(text: string | null | undefined, fallbackSym: string): string {
  const { sum, sym } = detailsTotal(text, fallbackSym);
  return sum > 0 ? sym + withCommas(sum) : '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Normalise the FIRST numeric date in a line to NATO (DD-Mmm-YYYY) — the SOW
 *  Timeline mode's analogue of `detailsCalcLine`. Handles DD.MM.YY(YY),
 *  DD/MM/YY(YY) (UK order) and ISO YYYY-MM-DD; a 2-digit year → 20xx. Forgiving
 *  and idempotent: the NATO output (a month WORD + `-`) doesn't re-match, and a
 *  line with no parseable date is returned unchanged (keeps its label intact). */
export function detailsDateLine(line: string): string {
  // Global — a line may carry a range ("20.08.26 - 21.08.26"), so format every date.
  const out = line.replace(/\b(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})\b/g, (m, d, mo, y) => {
    const day = Number(d);
    const mon = Number(mo);
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    if (day < 1 || day > 31 || mon < 1 || mon > 12) return m;
    return `${String(day).padStart(2, '0')}-${MONTHS[mon - 1]}-${year}`;
  });
  return out.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => {
    const mon = Number(mo);
    const day = Number(d);
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return m;
    return `${String(day).padStart(2, '0')}-${MONTHS[mon - 1]}-${y}`;
  });
}
