import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'gbp', standalone: true })
export class GbpPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    const num = typeof value === 'number' ? value : parseFloat(value as string) || 0;
    // v1.49j — "£ 12,000": a gap after the symbol. Format the amount on
    // its own (no currency style) so the spacing is under our control.
    const amount = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(Math.abs(num));
    return (num < 0 ? '-' : '') + '£ ' + amount;
  }
}
