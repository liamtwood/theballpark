export interface Item {
  id: string;
  org_id: string;
  category_id: string;
  category_name?: string;
  category_icon?: string;
  name: string;
  description?: string;
  unit?: string;
  base_price: number;
  min_price?: number;
  max_price?: number;
  lead_time_days?: number;
  coverage_area?: number;
  tier: 'basic' | 'mid' | 'premium';
  is_active: boolean;
}
