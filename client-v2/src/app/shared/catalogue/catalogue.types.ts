/** pV2-MARKET-00/06a — catalogue domain types (the engine's shared
 *  contract). Mirrors the server's marketplace.js projections. */
import { GalleryImage } from '../../core/media/media.types';

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
  /** "Included Services" — what the install covers (install_description). */
  installDescription: string | null;
  basePrice: number | null;
  unit: string | null;
  coverUrl: string | null;
  categoryId: string;
  subcategoryId: string | null;
  supplierId: string;
  supplierName: string;
  /** Supplier's city — the item card's pin row (pV2-CARDS-01, image 2). */
  supplierCity: string | null;
  /** Category display name — chip fallback when the item has no subcat. */
  categoryName: string | null;
  /** Subcategory display name — the item card's tag chip (QC: subcat, not
   *  top-level cat — "Save the Date", not "Graphics & Signage"). */
  subcategoryName: string | null;
  /** Server-derived ownership flag (MARKETPLACE.md model) — unlocks
   *  edit/delete affordances in later arcs. Never computed client-side. */
  ownedByActiveOrg: boolean;
  /** pV2-STORE-01 — moderation surfacing: the approval_status code (for the
   *  status pill) and the publish flag. Inactive items show a status pill. */
  approvalStatus: string;
  isActive: boolean;
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
  /** Owner store filters (pV2-STORE-01) — server honours these only when the
   *  caller owns `supplier`. status = approval_status; active = publish state. */
  status?: string | null;
  active?: string | null;
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

/** One storefront subcat card (pV2-CARDS-01 QC #5, image 7): a
 *  subcategory the supplier has live items in; cover = first item image.
 *  parentId drills the Store tab to cat+sub in one navigation. */
export interface SupplierSubcategory {
  id: string;
  name: string;
  parentId: string | null;
  /** True = the per-category catch-all card (items with no subcat) —
   *  carries the CATEGORY's id/name; drills cat-only. */
  isCatchAll: boolean;
  count: number;
  coverUrl: string | null;
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
  /** Portfolio gallery (pV2-MEDIA-01e) — rendered read-only on the storefront. */
  images: GalleryImage[];
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

/** Size a remote image URL for its surface (pure — unit tested).
 *  Unsplash-style URLs carry ?w=1080; cards need ~480, list thumbs ~160.
 *  Non-parameterised URLs pass through untouched (v2.16d — Liam's "All
 *  is a disaster": 48 × 1080px sources for 340px cards). */
export function sizedImage(url: string | null, width: number): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.searchParams.has('w')) {
      u.searchParams.set('w', String(width));
      return u.toString();
    }
    return url;
  } catch (err) {
    // DB-sourced URLs only — a parse failure means truncated/garbage data;
    // surface it rather than silently passing through (closing audit).
    console.warn('[sizedImage] URL parse failed:', url, err);
    return url;
  }
}

/** Parse an untrusted ?view= param (pure — unit tested). */
export function asViewMode(v: string | null): ViewMode {
  return v === 'list' || v === 'table' ? v : 'card';
}
