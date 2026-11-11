/** pV2-BUILDUP-03 — the one definition of the estimate roll-up math, shared by the
 *  build-up dialog (customize-dialog) and the item editor's inline total. A line in
 *  '%' mode takes its cost as a percentage of the fixed-£ subtotal (option 1). */
export interface EstLine { cost: number | null; qty: number | null; unit: string | null; }

/** Sum of the fixed-£ lines only (% lines excluded) — the base % lines apply to. */
export function estimateSubtotal(lines: EstLine[]): number {
  return lines.reduce((s, l) => s + (l.unit !== '%' ? (Number(l.cost) || 0) * (Number(l.qty) || 1) : 0), 0);
}

/** One line's £ total: a % line = cost% of the fixed-£ subtotal; else cost × qty. */
export function estimateLineTotal(l: EstLine, subtotal: number): number {
  return l.unit === '%' ? ((Number(l.cost) || 0) / 100) * subtotal : (Number(l.cost) || 0) * (Number(l.qty) || 1);
}

/** The whole estimate: the £ lines plus the % lines computed off the £ subtotal. */
export function estimateTotal(lines: EstLine[]): number {
  const subtotal = estimateSubtotal(lines);
  return lines.reduce((s, l) => s + estimateLineTotal(l, subtotal), 0);
}
