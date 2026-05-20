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
  /** Supplier's project-specific proposal. Editable until approved_at is set. */
  offer_price: number;
  /** Agency's price expectation (optional). */
  budget_price?: number;
  /** Catalogue base_price snapshot at request time — anchors the conversation. */
  ballpark_snapshot?: number;
  /** Which catalogue item this deal started from. SET NULL on item delete. */
  inspired_by_item_id?: string;
  /** Deal lock — once set, offer_price is immutable. */
  approved_at?: string;
  approved_by?: string;
  /** Time dimension multiplier. Defaults to 1 if null/missing. */
  duration?: number;
  /** Unit / time_unit inherited from the item on creation, mutable on the deal. */
  unit?: string;
  time_unit?: string;
  /** Open metadata bag for deal-specific fields. */
  attributes?: Record<string, any>;
  /** quantity × duration × offer_price. Server-computed. */
  total_price: number;
  supplier_org_id?: string;
  shortlisted: boolean;
  status_id?: string;
  created_at: string;
}
