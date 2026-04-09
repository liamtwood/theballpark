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
  cover_image_url?: string;
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
