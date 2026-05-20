export interface Codelist {
  id: string;
  list_name: string;
  code: string;
  label: string;
  symbol?: string;
  meta: Record<string, any>;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}
