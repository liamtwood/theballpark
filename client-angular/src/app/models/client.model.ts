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
