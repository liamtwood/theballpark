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
  /** v1.29b: ISO-4217 currency code (GBP/USD/EUR/AUD). Set per project
      from the Event drawer's Financials section. Defaults to 'GBP'
      server-side. */
  currency?: string;
  total_ballpark_cost?: number;
  total_base_cost?: number;
  total_client_cost?: number;
  tier?: string;
  event_type?: string;
  duration_days?: number;
  po_ref?: string;
  /** v1.39: auto-generated project reference — "{org.ref_prefix}-{counter:03}"
      (e.g. WA-014). Stamped on create from orgs.ref_prefix +
      orgs.ref_counter (atomic increment). Distinct from po_ref which
      is a free-text purchase-order field. */
  ref?: string;
  status_id?: string;
  status_name?: string;
  status_color?: string;
  /** v1.31: synthetic status-code field — codelist 'project_status'
      code (draft / active / completed / archived). Used by the Event
      drawer's Status dropdown; backend resolves to status_id on save. */
  status_code?: string;
  cover_image_url?: string;
  client_logo_url?: string;
  card_color?: string;
  is_active: boolean;
  project_categories?: ProjectCategory[];
  created_at: string;
  updated_at: string;
}

/**
 * Build tab — context passed into CatalogueGridComponent so the inline
 * detail panel can show the project / per-category brief alongside the
 * usual item preview, and so the circle strip can grey unscoped
 * categories. When null the grid renders in standard marketplace mode.
 */
export interface ProjectContext {
  projectId: string;
  /** Project-level brief (projects.raw_brief_text). Shown when "All" is active. */
  projectBrief: string;
  /** Active project_categories rows for this project, keyed off category_id. */
  projectCategories: ProjectCategory[];
}

export interface ProjectCategory {
  id: string;
  project_id: string;
  category_id: string;
  name?: string;
  description?: string;
  requirement_brief?: string;
  requirement_detail?: string;
  ballpark_budget?: number;
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
  category_name?: string;
  category_icon_name?: string;
  category_icon_color?: string;
  category_cover_image_url?: string;
  category_sort_order?: number;
  is_active: boolean;
}
