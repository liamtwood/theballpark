import { Pipe, PipeTransform } from '@angular/core';

/**
 * Compact GBP currency for at-a-glance display on cards.
 *
 *   < 1000        → '£950'
 *   1000-9999     → '£2.8k'     (1 decimal)
 *   10000-99999   → '£28k'
 *   100000-999999 → '£120k'
 *   1m+           → '£1.2m'     (1 decimal)
 *
 * null / 0 / non-numeric → '—' (em-dash). Caller adds 'Est. ' prefix
 * so the empty state reads as 'Est. —' on project cards.
 *
 * Use the regular `gbp` pipe for line-item precision (£1,400 etc.);
 * this one is for headline totals.
 */
@Pipe({ name: 'compactCurrency', standalone: true })
export class CompactCurrencyPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    if (n == null || typeof n !== 'number' || isNaN(n) || n === 0) {
      return '—';
    }
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs < 1000)        return `${sign}£${Math.round(abs)}`;
    if (abs < 10_000)      return `${sign}£${(abs / 1000).toFixed(1)}k`;
    if (abs < 1_000_000)   return `${sign}£${Math.round(abs / 1000)}k`;
    if (abs < 10_000_000)  return `${sign}£${(abs / 1_000_000).toFixed(1)}m`;
    return `${sign}£${Math.round(abs / 1_000_000)}m`;
  }
}
