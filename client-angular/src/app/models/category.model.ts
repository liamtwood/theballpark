export interface Category {
  id: string;
  name: string;
  description?: string;
  tagline?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  enabled?: boolean;
  cover_image_url?: string;
  card_color?: string;
  tags?: string[];
  parent_id?: string | null;
  level?: number;
  org_id?: string | null;
}
