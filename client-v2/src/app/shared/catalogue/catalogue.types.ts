/** pV2-MARKET-00 — catalogue domain types (the engine's shared contract;
 *  items/suppliers + the paginated envelope join in pV2-06a). Mirrors the
 *  server's marketplace.js projections. */

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
