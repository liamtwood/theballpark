export interface Item {
  id: string;
  org_id: string;
  category_id: string;
  category_name?: string;
  category_icon?: string;
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
  external_url?: string | null;
  is_active: boolean;
}
