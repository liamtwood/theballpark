/** pV2-MARKET-00/06a — catalogue domain types (the engine's shared
 *  contract). Mirrors the server's marketplace.js projections. */

/** One top-level catalogue category as the rail + curation table see it. */
export interface CategoryInfo {
  id: string;
  name: string;
  tagline: string | null;
  iconName: string | null;
  isActive: boolean;
  sortOrder: number | null;
  /** Live count of active items in the category. */
  count: number;
}

/** PATCH /api/marketplace/categories/:id body (platform admins). */
export interface CategoryUpdate {
  name?: string;
  tagline?: string;
  isActive?: boolean;
  sortOrder?: number;
}

/** One marketplace item as the browse grid sees it (pV2-06a). */
export interface CatalogueItem {
  id: string;
  name: string;
  description: string | null;
  basePrice: number | null;
  unit: string | null;
  coverUrl: string | null;
  categoryId: string;
  subcategoryId: string | null;
  supplierId: string;
  supplierName: string;
  /** Server-derived ownership flag (MARKETPLACE.md model) — unlocks
   *  edit/delete affordances in later arcs. Never computed client-side. */
  ownedByActiveOrg: boolean;
}

/** The shared paginated list envelope — stable contract regardless of
 *  future UX (Show more today, virtual scroll someday). */
export interface Paginated<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

/** Items list query (URL-is-state — see MarketplaceStore). */
export interface ItemsQuery {
  cat?: string | null;
  sub?: string | null;
  q?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  tier?: ItemTier | null;
  supplier?: string | null;
  offset?: number;
}

/** pV2-06c — the filter dimensions with real data behind them
 *  (items.attributes is empty; category-specific dimensions deferred). */
export type ItemTier = 'basic' | 'mid' | 'premium';

export function asTier(v: string | null): ItemTier | null {
  return v === 'basic' || v === 'mid' || v === 'premium' ? v : null;
}

/** One supplier as the filter dropdown sees it. */
export interface SupplierOption {
  id: string;
  name: string;
  count: number;
}

/** One supplier as the suppliers-mode grid sees it (pV2-06d). */
export interface CatalogueSupplier {
  id: string;
  name: string;
  city: string | null;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  count: number;
}

/** The storefront projection (GET /suppliers/:id) — marketplace-public
 *  fields only; items come from /items?supplier=. */
export interface SupplierDetail {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  categories: { id: string; name: string; count: number }[];
}

/** The org's favourite ids (org-scoped, server-derived). */
export interface FavouriteIds {
  items: string[];
  suppliers: string[];
}

/** Middle-region entity mode (?mode=) — items (default) or suppliers. */
export type BrowseMode = 'items' | 'suppliers';

export function asBrowseMode(v: string | null): BrowseMode {
  return v === 'suppliers' ? 'suppliers' : 'items';
}

/** Price brackets for the filter (data: £5–£14k, median £500). The KEY is
 *  what lives in ?price= — labels can change without breaking URLs. */
export const PRICE_BRACKETS: readonly { key: string; label: string; min?: number; max?: number }[] = [
  { key: 'lt100', label: 'Under £100', max: 100 },
  { key: '100-500', label: '£100 – £500', min: 100, max: 500 },
  { key: '500-2000', label: '£500 – £2,000', min: 500, max: 2000 },
  { key: 'gt2000', label: 'Over £2,000', min: 2000 },
];

export function bracketFor(key: string | null): (typeof PRICE_BRACKETS)[number] | null {
  return PRICE_BRACKETS.find((b) => b.key === key) ?? null;
}

/** Middle-region presentation. */
export type ViewMode = 'card' | 'list' | 'table';

/** Right-rail mode, DERIVED from selection ('quote' joins in 06f). */
export type RailMode = 'empty' | 'category' | 'item' | 'quote';

/** Parse an untrusted ?view= param (pure — unit tested). */
export function asViewMode(v: string | null): ViewMode {
  return v === 'list' || v === 'table' ? v : 'card';
}
