export interface Estimate {
  id: string;
  project_id: string;
  name?: string;
  description?: string;
  version: number;
  total_value: number;
  balls_cost: number;
  status_id?: string;
  status_name?: string;
  status_color?: string;
  is_active: boolean;
  created_at: string;
}

export interface EstimateItem {
  id: string;
  estimate_id: string;
  project_category_id?: string;
  item_id?: string;
  name?: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier_org_id?: string;
  shortlisted: boolean;
  status_id?: string;
  created_at: string;
}
