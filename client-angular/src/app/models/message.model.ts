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
  category_id?: string;
  category_name?: string;
  msg_status?: string;
  created_at: string;
}
