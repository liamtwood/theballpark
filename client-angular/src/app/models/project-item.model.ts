export type SelectionType = 'selected' | 'liked';

export interface ProjectItem {
  id: string;
  project_id: string;
  item_id: string;
  project_category_id?: string;
  selection_type: SelectionType;
  created_at: string;

  // Joined fields populated by ProjectItemService.getByProject() — present
  // on read, not on write.
  name?: string;
  base_price?: number;
  unit?: string;
  time_unit?: string;
  image_url?: string;
  tier?: string;
  category_name?: string;
  /** v1.18: the item's own category_id, joined for Build-tab bucketing
      when project_category_id is null (older rows added without it). */
  item_category_id?: string;
  /** v1.22: joined from items for the context-panel redesign — drives
      the per-row "{N} days lead" subtitle and the panel's "longest lead"
      summary. */
  lead_time_days?: number;
  /** v1.22: joined from orgs (the item's supplier) for the per-row
      "{supplier} · {N} days lead" subtitle. */
  supplier_name?: string;
}
