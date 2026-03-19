export interface BallsTransaction {
  id: string;
  org_id: string;
  project_id?: string;
  estimate_id?: string;
  supplier_org_id?: string;
  user_id?: string;
  amount: number;
  direction: 'credit' | 'debit';
  reason: 'subscription' | 'spend' | 'referral' | 'refund' | 'bonus';
  description?: string;
  created_at: string;
}
