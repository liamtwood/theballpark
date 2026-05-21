export interface Item {
  id: string;
  org_id: string;
  category_id: string;
  category_name?: string;
  category_icon?: string;
  /** v1.41: two-field subcategory model. category_id is always the
      parent category; subcategory_id is the optional child category
      (must satisfy categories.parent_id = items.category_id — the
      trg_check_item_subcategory trigger enforces this). */
  subcategory_id?: string | null;
  subcategory_name?: string;
  name: string;
  description?: string;
  unit?: string;
  /** Optional rental cadence — e.g. unit='pallet', time_unit='month'.
      Both reference shared.codelists; time_unit codes live in item_time_unit. */
  time_unit?: string | null;
  base_price: number;
  min_price?: number;
  max_price?: number;
  lead_time_days?: number;
  coverage_area?: number;
  tier?: 'basic' | 'mid' | 'premium' | null;
  /** Self-FK to an item this one was "born from" (lineage). */
  derived_from_id?: string | null;
  /** Self-FK to the parent of a variant family. */
  parent_item_id?: string | null;
  /** Open metadata bag. */
  attributes?: Record<string, any>;
  tags?: string[];
  image_url?: string | null;
  image_display?: 'cover' | 'contain';
  /** v1.17: ordered gallery of up to 8 images. `image_url` continues to be
      written from `images[0]` (or the entry where is_hero=true) on every
      save for backward compat with existing card / detail surfaces. */
  images?: Array<{ url: string; sort_order: number; is_hero: boolean }>;
  external_url?: string | null;
  is_active: boolean;
  /** v1.43: latest unaccepted AI classification suggestion. NULL once
      the supplier accepts or skips it. Shape mirrors the /taxonomy/classify
      response — { category_id, category_name, subcategory_id,
      subcategory_name, tags[], confidence, classified_at }. */
  pending_classification?: {
    category_id: string;
    category_name: string;
    subcategory_id: string | null;
    subcategory_name: string | null;
    tags: Array<{ tag_id: string; dimension: string; label: string }>;
    confidence: number;
    classified_at?: string;
  } | null;
  /** v1.43: the structured (dimension-scoped) tags accepted for this item,
      joined from supplier_item_tag. Read-only — populated by getById. */
  item_tags?: Array<{ tag_id: string; dimension: string; label: string }>;
}
