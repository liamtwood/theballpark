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
