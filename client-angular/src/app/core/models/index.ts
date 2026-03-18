export interface Status {
  id: string;
  entity_type: string;
  name: string;
  description?: string;
  label?: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
}

export interface Org {
  id: string;
  name: string;
  description?: string;
  type: 'agency' | 'supplier';
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  subscription_tier: 'starter' | 'studio' | 'agency';
  balls_balance: number;
  balls_monthly_allowance: number;
  default_vat_pct: number;
  vat_registered: boolean;
  vat_number?: string;
  default_margin_pct: number;
  default_contingency_pct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  email: string;
  role: 'admin' | 'member';
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
}

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

export interface Project {
  id: string;
  org_id: string;
  client_id?: string;
  client_name?: string;
  name: string;
  description?: string;
  event_name?: string;
  event_date?: string;
  venue_name?: string;
  venue_city?: string;
  venue_address?: string;
  guest_count?: number;
  stand_size?: string;
  stand_width_m?: number;
  stand_depth_m?: number;
  stand_type?: string;
  project_notes?: string;
  raw_brief_text?: string;
  parsed_brief_json?: any;
  ai_hints?: string;
  missing_fields?: string;
  project_budget?: number;
  share_budget_with_suppliers?: boolean;
  default_margin_pct?: number;
  default_contingency_pct?: number;
  default_vat_pct?: number;
  total_ballpark_cost?: number;
  total_base_cost?: number;
  total_client_cost?: number;
  tier?: string;
  status_id?: string;
  status_name?: string;
  status_color?: string;
  is_active: boolean;
  project_categories?: ProjectCategory[];
  created_at: string;
  updated_at: string;
}

export interface ProjectCategory {
  id: string;
  project_id: string;
  category_id: string;
  name?: string;
  description?: string;
  requirement_brief?: string;
  requirement_detail?: string;
  ballpark_cost: number;
  base_cost: number;
  contingency_pct: number;
  contingency_amount: number;
  subtotal: number;
  margin_pct: number;
  margin_amount: number;
  net_cost: number;
  vat_pct: number;
  vat_amount: number;
  client_cost: number;
  sort_order: number;
  status_id?: string;
  status_name?: string;
  status_color?: string;
  is_active: boolean;
}

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

export interface Message {
  id: string;
  project_id: string;
  user_id?: string;
  sender_name?: string;
  supplier_org_id?: string;
  estimate_item_id?: string;
  subject?: string;
  body?: string;
  direction: 'inbound' | 'outbound';
  status_id?: string;
  created_at: string;
}

export interface BallsTransaction {
  id: string;
  org_id: string;
  project_id?: string;
  estimate_id?: string;
  supplier_org_id?: string;
  user_id?: string;
  amount: number;
  direction: 'credit' | 'debit';
  reason: 'subscription' | 'spend' | 'referral' | 'refund' | 'bonus';
  description?: string;
  created_at: string;
}

export interface ParsedBrief {
  event_name?: string;
  event_date?: string;
  venue_name?: string;
  venue_city?: string;
  venue_address?: string;
  guest_count?: number;
  stand_size?: string;
  stand_type?: string;
  project_notes?: string;
  suggested_categories?: string[];
  ai_hints?: string;
  missing_fields?: string[];
}
