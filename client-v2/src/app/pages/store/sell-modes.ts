// pV2-STORE-PACKAGES-01 — "How is this sold?" sell modes. A small reusable
// vocabulary; each mode seeds the composition (packages + presentation meta). EVERY
// mode is offered on every item (Liam 2026-11-25): the seven are mostly orthogonal,
// the supplier picks the one that fits, and each hint explains itself — so a caterer
// seeing "Spaces" (for venues with bookable rooms/areas) costs nothing. We dropped the
// earlier category-driven curation: it was a hardcoded name-matched placeholder with a
// deferred "move to category meta" debt, and the filtering wasn't worth its fragility.

export type SellModeCode = 'single' | 'tiers' | 'sizes' | 'spaces' | 'custom' | 'volume' | 'levels';

export interface SellModeDef {
  code: SellModeCode;
  label: string;
  hint: string;
}

/** The vocabulary — label + one-line hint, shown as the "How is this sold?" buttons. */
export const SELL_MODES: Record<SellModeCode, SellModeDef> = {
  single: { code: 'single', label: 'Single package', hint: 'One offering at one price' },
  tiers:  { code: 'tiers',  label: 'Bronze, Silver & Gold', hint: 'Good / better / best tiers' },
  sizes:  { code: 'sizes',  label: 'Small, Medium & Large', hint: 'Pick a size' },
  spaces: { code: 'spaces', label: 'Spaces', hint: 'For venues with multiple rooms or areas to book' },
  custom: { code: 'custom', label: 'Custom options', hint: 'Build your own list' },
  volume: { code: 'volume', label: 'Volume Pricing', hint: 'One price + bulk discount; pick a colour/size' },
  levels: { code: 'levels', label: 'Option Levels', hint: 'Nest options on a base — pick each; price adds up' },
};

/** Every sell mode, in display order (the "How is this sold?" grid). Offered on every
 *  item regardless of category — the supplier picks the one that fits. */
export const ALL_SELL_MODES: SellModeCode[] = ['single', 'volume', 'tiers', 'sizes', 'levels', 'spaces', 'custom'];

/** A starter row for a mode — name + an optional default chip colour. */
export interface SellModeRow { name: string; color?: string; }

/** What a mode seeds: the presentation meta + the starter rows (empty otherwise). */
export interface SellModeSeed {
  meta: { label: string; presentation: 'buttons' | 'picklist'; select: 'one' | 'multi' };
  rows: SellModeRow[];
  /** Default unit for seeded rows (spaces → capacity); '' leaves it unset. */
  rowUnit: string;
}

export function sellModeSeed(code: SellModeCode): SellModeSeed {
  switch (code) {
    case 'tiers':
      return {
        meta: { label: 'Package', presentation: 'buttons', select: 'one' },
        rows: [{ name: 'Bronze', color: '#CD7F32' }, { name: 'Silver', color: '#C0C0C0' }, { name: 'Gold', color: '#D4AF37' }],
        rowUnit: '',
      };
    case 'sizes':
      return { meta: { label: 'Size', presentation: 'buttons', select: 'one' }, rows: [{ name: 'Small' }, { name: 'Medium' }, { name: 'Large' }], rowUnit: '' };
    case 'spaces':
      return { meta: { label: 'Space', presentation: 'picklist', select: 'one' }, rows: [], rowUnit: 'capacity' };
    case 'volume':
      // One price + volume up top; free-pick options (no per-option cost).
      return { meta: { label: 'Option', presentation: 'buttons', select: 'one' }, rows: [], rowUnit: '' };
    case 'levels':
      // Multi-dimension configurator — uses the Variants matrix (base + upcharges),
      // not the single-dim chips; no package rows.
      return { meta: { label: 'Option', presentation: 'buttons', select: 'one' }, rows: [], rowUnit: '' };
    case 'custom':
      return { meta: { label: 'Option', presentation: 'buttons', select: 'one' }, rows: [], rowUnit: '' };
    case 'single':
    default:
      return { meta: { label: 'Package', presentation: 'buttons', select: 'one' }, rows: [], rowUnit: '' };
  }
}
