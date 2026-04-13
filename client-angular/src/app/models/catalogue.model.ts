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
  specs?: { label: string; value: string }[];
  // Parent reference (items link to their supplier)
  parentEntity?: { id: string; name: string; subtitle?: string; image_url?: string };
  // Display mode — 'cover' (full bleed) or 'contain' (centred logo)
  image_display?: 'cover' | 'contain';
  // Pass-through for actions
  _raw?: any;
}

export interface CategoryInfo {
  id: string;
  name: string;
  cover_image_url?: string;
  icon?: string;
  count?: number;
  parent_id?: string;
  tagline?: string;
  description?: string;
  model?: string;
}
