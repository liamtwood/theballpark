import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'gbp', standalone: true })
export class GbpPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    const num = typeof value === 'number' ? value : parseFloat(value as string) || 0;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(num);
  }
}
