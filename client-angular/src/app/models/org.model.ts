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
  /** v1.39: prefix used by the auto-generated project ref
      ("{prefix}-{counter:03}", e.g. WA-014). Editable in
      Settings > Organisation. Defaults to 'BP' if unset. */
  ref_prefix?: string;
  /** v1.39: per-org incrementing counter; never edited from the UI —
      driven by project creates server-side. */
  ref_counter?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
