import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a project / event date string for compact display.
 *
 * Parseable ISO / date-string input → NATO format with a relative tail:
 *   '2026-06-02'           → '02-Jun-2026 · in 20 days'
 *   '2025-11-10'           → '10-Nov-2025 · 6 months ago'
 *   '2026-05-13T…' (today) → '13-May-2026 · today'
 *
 * Free-text input that won't parse comes back unchanged so the user's
 * "Late September" or "TBC" still reads as-is:
 *   'Late September' → 'Late September'
 *   'TBC'            → 'TBC'
 *
 * Used on the dashboard project cards and the past-events carousel.
 */
@Pipe({ name: 'eventDate', standalone: true })
export class EventDatePipe implements PipeTransform {
  private static readonly MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  transform(value: string | Date | null | undefined): string {
    if (value == null || value === '') return '';
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) {
      // Free text — let the caller's copy through unchanged.
      return String(value);
    }
    return this.format(d);
  }

  private format(d: Date): string {
    const dd  = String(d.getDate()).padStart(2, '0');
    const mmm = EventDatePipe.MONTHS[d.getMonth()];
    const yy  = d.getFullYear();
    const base = `${dd}-${mmm}-${yy}`;

    // Relative tail. Compare against the start-of-day for stability —
    // "in 1 day" shouldn't flip to "today" just because it's late
    // afternoon.
    const today  = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

    if (diffDays === 0)   return `${base} · today`;
    if (diffDays === 1)   return `${base} · tomorrow`;
    if (diffDays === -1)  return `${base} · yesterday`;
    if (diffDays > 0)     return `${base} · in ${diffDays} days`;
    return `${base} · ${-diffDays} days ago`;
  }
}
