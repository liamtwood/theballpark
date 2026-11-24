// pV2-STORE-PACKAGES-01 — "How is this sold?" sell modes. A small reusable
// vocabulary; each mode seeds the composition (packages + presentation meta). WHICH
// modes a supplier sees is CATEGORY-driven (engine thesis: config on the taxonomy,
// not a fork). The per-category lists are hardcoded defaults for now — the clean
// home is a `meta.sell_modes` column on categories + an admin editor (deferred).

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
  spaces: { code: 'spaces', label: 'Spaces', hint: 'Choose a space / area' },
  custom: { code: 'custom', label: 'Custom options', hint: 'Build your own list' },
  volume: { code: 'volume', label: 'Volume Pricing', hint: 'One price + bulk discount; pick a colour/size' },
  levels: { code: 'levels', label: 'Option Levels', hint: 'Nest options on a base — pick each; price adds up' },
};

/** Which modes apply per TOP category (by category name — the client has the name,
 *  not the ref). Hardcoded defaults; moves to category meta later. "Custom" is always
 *  appended so a supplier is never boxed in. */
const BY_CATEGORY: Record<string, SellModeCode[]> = {
  Venues:    ['single', 'spaces'],
  'Set Build': ['single', 'tiers', 'volume', 'levels'],
  AV:        ['single', 'tiers', 'volume', 'levels'],
  Catering:  ['single', 'tiers'],
  Furniture: ['single', 'volume', 'sizes'],
  'Prop Hire': ['single', 'volume', 'sizes'],
  Graphics:  ['single', 'volume', 'levels'],
  Floristry: ['single', 'tiers'],
};

const DEFAULT_MODES: SellModeCode[] = ['single', 'volume', 'tiers', 'sizes'];
/** New / uncategorised item → show EVERY option (the supplier narrows by picking a
 *  category, which then suggests its own set). */
const ALL_MODES: SellModeCode[] = ['single', 'volume', 'tiers', 'sizes', 'levels', 'spaces', 'custom'];

/** The sell modes offered for a category (by name), always ending in Custom. With no
 *  category (a new item) every option is offered. */
export function sellModesForCategory(categoryName: string | null | undefined): SellModeCode[] {
  if (!categoryName) return ALL_MODES;
  const base = BY_CATEGORY[categoryName] ?? DEFAULT_MODES;
  return base.includes('custom') ? base : [...base, 'custom'];
}

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
