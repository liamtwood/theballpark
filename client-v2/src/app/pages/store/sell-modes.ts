// pV2-STORE-PACKAGES-01 — "How is this sold?" sell modes. A small reusable
// vocabulary; each mode seeds the composition (packages + presentation meta). WHICH
// modes a supplier sees is CATEGORY-driven (engine thesis: config on the taxonomy,
// not a fork). The per-category lists are hardcoded defaults for now — the clean
// home is a `meta.sell_modes` column on categories + an admin editor (deferred).

export type SellModeCode = 'single' | 'tiers' | 'sizes' | 'spaces' | 'custom';

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
};

/** Which modes apply per TOP category (by category name — the client has the name,
 *  not the ref). Hardcoded defaults; moves to category meta later. "Custom" is always
 *  appended so a supplier is never boxed in. */
const BY_CATEGORY: Record<string, SellModeCode[]> = {
  Venues:    ['single', 'spaces'],
  'Set Build': ['single', 'tiers'],
  AV:        ['single', 'tiers'],
  Catering:  ['single', 'tiers'],
  Furniture: ['single', 'sizes'],
  'Prop Hire': ['single', 'sizes'],
  Graphics:  ['single'],
  Floristry: ['single', 'tiers'],
};

const DEFAULT_MODES: SellModeCode[] = ['single', 'tiers', 'sizes'];

/** The sell modes offered for a category (by name), always ending in Custom. */
export function sellModesForCategory(categoryName: string | null | undefined): SellModeCode[] {
  const base = (categoryName && BY_CATEGORY[categoryName]) || DEFAULT_MODES;
  return base.includes('custom') ? base : [...base, 'custom'];
}

/** What a mode seeds: the presentation meta + the starter row names (blank otherwise). */
export interface SellModeSeed {
  meta: { label: string; presentation: 'buttons' | 'picklist'; select: 'one' | 'multi' };
  rowNames: string[];
  /** Default unit for seeded rows (spaces → capacity); '' leaves it unset. */
  rowUnit: string;
}

export function sellModeSeed(code: SellModeCode): SellModeSeed {
  switch (code) {
    case 'tiers':
      return { meta: { label: 'Package', presentation: 'buttons', select: 'one' }, rowNames: ['Bronze', 'Silver', 'Gold'], rowUnit: '' };
    case 'sizes':
      return { meta: { label: 'Size', presentation: 'buttons', select: 'one' }, rowNames: ['Small', 'Medium', 'Large'], rowUnit: '' };
    case 'spaces':
      return { meta: { label: 'Space', presentation: 'picklist', select: 'one' }, rowNames: [], rowUnit: 'capacity' };
    case 'custom':
      return { meta: { label: 'Option', presentation: 'buttons', select: 'one' }, rowNames: [], rowUnit: '' };
    case 'single':
    default:
      return { meta: { label: 'Package', presentation: 'buttons', select: 'one' }, rowNames: [], rowUnit: '' };
  }
}
