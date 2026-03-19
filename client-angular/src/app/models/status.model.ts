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
