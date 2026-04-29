export interface CatalogueEntity {
  id: string;
  name: string;
  description?: string;
  // Images — component uses first available
  cover_image_url?: string;
  logo_url?: string;
  image_url?: string;
  external_url?: string;
  // Display fields — component renders whichever exist
  subtitle?: string;
  price?: number;
  priceRange?: { min: number; max: number };
  unit?: string;
  category_id?: string;
  categoryLabel?: string;
  // Optional pill rendered next to the name (var(--theme-bg) background) —
  // used for things like a feedback version tag (e.g. 'v1.7').
  badge?: string;
  specs?: { label: string; value: string }[];
  // Parent reference (items link to their supplier)
  parentEntity?: { id: string; name: string; subtitle?: string; image_url?: string };
  // Display mode — 'cover' (full bleed) or 'contain' (centred logo)
  image_display?: 'cover' | 'contain';
  // Lucide icon name — shown when no image
  icon?: string;
  // Pass-through for actions
  _raw?: any;
}

export interface CategoryInfo {
  id: string;
  name: string;
  cover_image_url?: string;
  logo_url?: string;
  icon?: string;
  icon_name?: string;
  icon_color?: string;
  count?: number;
  parent_id?: string;
  tagline?: string;
  description?: string;
  model?: string;
  namespace?: string;
  object_type?: string;
  level?: number;
  enabled?: boolean;
  card_color?: string;
  tags?: string[];
}
