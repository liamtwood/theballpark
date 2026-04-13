export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  enabled?: boolean;
  cover_image_url?: string;
  card_color?: string;
  tags?: string[];
  namespace?: string;
  parent_id?: string;
  tagline?: string;
  model?: string;
}
