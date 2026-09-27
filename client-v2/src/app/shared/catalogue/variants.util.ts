// pV2-STORE-VARIANTS-UPCHARGE-01 — variants carry a per-value PRICE MODE (Liam):
//   none     — free pick (colour); no price effect.
//   upcharge — adds its amount to the running price (Gold +£5).
//   absolute — SETS the running price to its amount (A4 = £68).
//
// Final unit price: start at the item base, then walk the dimensions in order —
// `absolute` sets, `upcharge` adds, `none` skips. So Size(absolute £68) +
// Paper(upcharge +£5) = £73. Volume pricing is a separate mechanism (not combined).
//
// Stored shape (attributes.variants): { dimensions: [{ name, values: [{value, mode, amount}] }] }.
// normalizeVariants also reads the earlier upcharge shape ({value, upcharge}) and the
// legacy combo matrix ({values:[str], combos}), so items saved before each switch keep
// working until re-saved. `price is a guide`, so approximate derivations are fine.

export type VariantMode = 'none' | 'upcharge' | 'absolute';
export interface VariantValue { value: string; mode: VariantMode; amount: number; }
export interface VariantDimension { name: string; values: VariantValue[]; }
export interface VariantMatrix { dimensions: VariantDimension[]; }

interface LegacyCombo { values: Record<string, string>; price: number; }

/** Coerce any stored `attributes.variants` into the mode shape, or null when there
 *  are no dimensions. Tolerates the upcharge shape and the legacy combo matrix. */
export function normalizeVariants(raw: unknown): VariantMatrix | null {
  if (!raw || typeof raw !== 'object') return null;
  const block = raw as { dimensions?: unknown; combos?: unknown };
  const rawDims = Array.isArray(block.dimensions) ? block.dimensions : [];
  if (!rawDims.length) return null;
  const combos: LegacyCombo[] = Array.isArray(block.combos) ? (block.combos as LegacyCombo[]) : [];
  const globalMin = combos.length ? Math.min(...combos.map((c) => Number(c.price) || 0)) : 0;

  const dimensions: VariantDimension[] = rawDims.map((d) => {
    const dim = d as { name?: unknown; values?: unknown };
    const name = String(dim.name ?? '');
    const rawVals = Array.isArray(dim.values) ? dim.values : [];
    const values: VariantValue[] = rawVals.map((v) => {
      // Current shape: {value, mode, amount}.
      if (v && typeof v === 'object' && 'mode' in (v as object)) {
        const o = v as { value?: unknown; mode?: unknown; amount?: unknown };
        const mode = (o.mode === 'absolute' || o.mode === 'upcharge') ? o.mode : 'none';
        return { value: String(o.value ?? ''), mode: mode as VariantMode, amount: Number(o.amount) || 0 };
      }
      // Earlier upcharge shape: {value, upcharge}.
      if (v && typeof v === 'object' && 'value' in (v as object)) {
        const o = v as { value?: unknown; upcharge?: unknown };
        const up = Number(o.upcharge) || 0;
        return { value: String(o.value ?? ''), mode: up ? 'upcharge' : 'none', amount: up };
      }
      // Legacy: a bare string value — derive an upcharge from the combos.
      const value = String(v);
      const matching = combos.filter((c) => c.values && c.values[name] === value);
      const up = matching.length ? Math.min(...matching.map((c) => Number(c.price) || 0)) - globalMin : 0;
      const clean = Math.max(0, Math.round(up * 100) / 100);
      return { value, mode: clean ? 'upcharge' : 'none', amount: clean };
    });
    return { name, values };
  });
  return { dimensions };
}

/** Final unit price for a selection: base, then per dimension in order — absolute
 *  sets, upcharge adds, none skips. Unselected dimensions are ignored. */
export function computeUnitPrice(base: number | null, m: VariantMatrix | null, selected: Record<string, string>): number {
  let unit = base ?? 0;
  if (!m) return unit;
  for (const d of m.dimensions) {
    const hit = d.values.find((x) => x.value === selected[d.name]);
    if (!hit) continue;
    if (hit.mode === 'absolute') unit = hit.amount;
    else if (hit.mode === 'upcharge') unit += hit.amount;
  }
  return unit;
}

/** The lowest achievable unit price — greedy per dimension in order (each dimension
 *  picks the value that minimises the running price). Exact for single dimensions;
 *  an honest "From" guide across several. */
export function minUnitPrice(base: number | null, m: VariantMatrix | null): number {
  let unit = base ?? 0;
  if (!m) return unit;
  for (const d of m.dimensions) {
    if (!d.values.length) continue;
    let best: number | null = null;
    for (const v of d.values) {
      const u = v.mode === 'absolute' ? v.amount : v.mode === 'upcharge' ? unit + v.amount : unit;
      if (best === null || u < best) best = u;
    }
    if (best !== null) unit = best;
  }
  return unit;
}

/** Does any value affect the price? (false = every value is a free pick.) */
export function hasPricing(m: VariantMatrix | null): boolean {
  return !!m && m.dimensions.some((d) => d.values.some((v) => v.mode !== 'none'));
}
