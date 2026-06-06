import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'gbp', standalone: true })
export class GbpPipe implements PipeTransform {
  /**
   * v1.65fN — optional `decimals` arg. Defaults to 0 (whole pounds,
   * which is what most rollups want). Pass 2 to keep pence — e.g.
   * the cart drawer's CLIENT TOTAL should reflect the actual figure
   * that lands on the supplier invoice, not a rounded approximation.
   *   {{ clientTotal | gbp:2 }}       -> "£ 44,643.42"
   *   {{ subtotal    | gbp }}         -> "£ 32,350"
   *   {{ price       | gbp:0:true }}  -> "£8"   (no gap — tight catalogue prices)
   */
  transform(value: number | string | null | undefined, decimals: number = 0, noSpace: boolean = false): string {
    const num = typeof value === 'number' ? value : parseFloat(value as string) || 0;
    // v1.49j — "£ 12,000": a gap after the symbol. Format the amount on
    // its own (no currency style) so the spacing is under our control.
    // v1.66cu — noSpace drops the gap ("£8") for tight catalogue "From" prices.
    const amount = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(Math.abs(num));
    return (num < 0 ? '-' : '') + '£' + (noSpace ? '' : ' ') + amount;
  }
}
