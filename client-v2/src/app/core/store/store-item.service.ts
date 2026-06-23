import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';
import { GalleryImage } from '../media/media.types';

/** The editable item row (pV2-STORE-01) — the full item as the editor sees it.
 *  Only fields the supplier edits today; deferred columns (install_cost,
 *  location_coverage, included_services) are not here yet. */
export interface StoreItem {
  id: string;
  org_id: string;
  category_id: string;
  subcategory_id: string | null;
  name: string;
  description: string | null;
  base_price: number | string | null;
  /** Installed total (ballpark + install add-on). */
  max_price: number | string | null;
  unit: string | null;
  lead_time_days: number | null;
  image_url: string | null;
  images: GalleryImage[];
  tags: string[];
  approval_status: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** What the editor sends on save. The supplier sets `approval_status` to either
 *  `draft` (Save Draft) or `pending` (Submit for Approval); visibility
 *  (`is_active`) stays server-controlled — an item only goes live once a
 *  ballpark admin approves it. */
export interface StoreItemWrite {
  name: string;
  category_id: string;
  subcategory_id?: string | null;
  description?: string | null;
  base_price?: number | null;
  /** Installed total (ballpark + install add-on) → stored in max_price. */
  max_price?: number | null;
  unit?: string | null;
  lead_time_days?: number | null;
  image_url?: string | null;
  images?: GalleryImage[];
  tags?: string[];
  approval_status?: 'draft' | 'pending';
}

/** pV2-STORE-01 — supplier item editor client. Hits the gated
 *  `/api/store/items` endpoints (org scoped server-side). */
@Injectable({ providedIn: 'root' })
export class StoreItemService {
  private readonly api = inject(ApiService);

  get(id: string): Observable<StoreItem> {
    return this.api.get<StoreItem>(`/api/store/items/${id}`);
  }

  create(body: StoreItemWrite): Observable<StoreItem> {
    return this.api.post<StoreItem>('/api/store/items', body);
  }

  update(id: string, body: StoreItemWrite): Observable<StoreItem> {
    return this.api.put<StoreItem>(`/api/store/items/${id}`, body);
  }

  /** Ballpark-admin moderation (pV2-STORE-01) — cross-org read of any item. */
  getForReview(id: string): Observable<StoreItem> {
    return this.api.get<StoreItem>(`/api/admin/items/${id}`);
  }

  /** Approve (→ approved + active) or reject (→ rejected + hidden) an item. */
  decide(id: string, decision: 'approve' | 'reject'): Observable<StoreItem> {
    return this.api.put<StoreItem>(`/api/admin/items/${id}/approval`, { decision });
  }
}
