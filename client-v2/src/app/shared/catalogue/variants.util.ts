// pV2-STORE-VARIANTS-UPCHARGE-01 — the variant model is UPCHARGE-based (Liam):
// each dimension value carries a +£ delta (0 = free pick); the final unit price is
// base + Σ(selected upcharges). Volume pricing owns the quantity axis separately, so
// the two compose instead of colliding (the old absolute combo matrix did both).
//
// Stored shape (attributes.variants): { dimensions: [{ name, values: [{value, upcharge}] }] }.
// This normalizer also reads the LEGACY shape ({ dimensions:[{name,values:[str]}], combos }),
// deriving each value's upcharge from the cheapest combo carrying it — so items loaded
// before the switch keep working until re-saved. `price is a guide`, so the derived
// deltas being approximate for non-additive matrices is acceptable.

export interface VariantValue { value: string; upcharge: number; }
export interface VariantDimension { name: string; values: VariantValue[]; }
export interface VariantMatrix { dimensions: VariantDimension[]; }

interface LegacyCombo { values: Record<string, string>; price: number; }

/** Coerce any stored `attributes.variants` into the upcharge shape, or null when
 *  there are no dimensions. Tolerates the legacy combo matrix. */
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
      // New shape: {value, upcharge}.
      if (v && typeof v === 'object' && 'value' in (v as object)) {
        const o = v as { value?: unknown; upcharge?: unknown };
        return { value: String(o.value ?? ''), upcharge: Number(o.upcharge) || 0 };
      }
      // Legacy shape: a bare string value — derive its upcharge from the combos.
      const value = String(v);
      const matching = combos.filter((c) => c.values && c.values[name] === value);
      const upcharge = matching.length ? Math.min(...matching.map((c) => Number(c.price) || 0)) - globalMin : 0;
      return { value, upcharge: Math.max(0, Math.round(upcharge * 100) / 100) };
    });
    return { name, values };
  });
  return { dimensions };
}

/** Σ of the selected values' upcharges. */
export function totalUpcharge(m: VariantMatrix | null, selected: Record<string, string>): number {
  if (!m) return 0;
  let t = 0;
  for (const d of m.dimensions) {
    const hit = d.values.find((x) => x.value === selected[d.name]);
    if (hit) t += hit.upcharge;
  }
  return t;
}
