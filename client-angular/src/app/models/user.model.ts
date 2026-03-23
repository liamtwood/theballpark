export interface User {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  email: string;
  role: 'admin' | 'member';
  avatar_url?: string;
  joined?: string;
  is_active: boolean;
  created_at: string;
}
