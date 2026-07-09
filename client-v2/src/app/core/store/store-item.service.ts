import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from '../api.service';
import { CatalogueService } from '../marketplace/catalogue.service';
import { GalleryImage } from '../media/media.types';

/** The editable item row (pV2-STORE-01) — the full item as the editor sees it. */
export interface StoreItem {
  id: string;
  org_id: string;
  category_id: string;
  subcategory_id: string | null;
  name: string;
  description: string | null;
  base_price: number | string | null;
  /** The installation cost (separate line from base_price). */
  install_cost: number | string | null;
  /** "Included Services" — what the install covers. */
  install_description: string | null;
  /** How install_cost applies: per_order | per_item | percentage (null = per_item). */
  install_unit: string | null;
  /** Free-text location coverage. */
  location_coverage: string | null;
  /** ISO-4217 — defaults to the supplier's org currency. */
  currency: string | null;
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
  /** The installation cost (separate line from base_price). */
  install_cost?: number | null;
  install_description?: string | null;
  install_unit?: string | null;
  location_coverage?: string | null;
  /** ISO-4217 — server defaults to the supplier's org currency if omitted. */
  currency?: string | null;
  unit?: string | null;
  lead_time_days?: number | null;
  image_url?: string | null;
  images?: GalleryImage[];
  tags?: string[];
  approval_status?: 'draft' | 'pending' | 'approved';
}

/** pV2-STORE-01 — supplier item editor client. Hits the gated
 *  `/api/store/items` endpoints (org scoped server-side). */
@Injectable({ providedIn: 'root' })
export class StoreItemService {
  private readonly api = inject(ApiService);
  private readonly catalogue = inject(CatalogueService);

  /** Bust the marketplace read cache after any write, so the grid shows the
   *  change on the next fetch (architecture §"writes invalidate"). Without
   *  this, reload returns the URL-memoised stale list until a full refresh. */
  private readonly bust = <T>() => tap<T>(() => this.catalogue.invalidate());

  get(id: string): Observable<StoreItem> {
    return this.api.get<StoreItem>(`/api/store/items/${id}`);
  }

  create(body: StoreItemWrite): Observable<StoreItem> {
    return this.api.post<StoreItem>('/api/store/items', body).pipe(this.bust());
  }

  update(id: string, body: StoreItemWrite): Observable<StoreItem> {
    return this.api.put<StoreItem>(`/api/store/items/${id}`, body).pipe(this.bust());
  }

  /** Ballpark-admin moderation (pV2-STORE-01) — cross-org read of any item. */
  getForReview(id: string): Observable<StoreItem> {
    return this.api.get<StoreItem>(`/api/admin/items/${id}`);
  }

  /** Public read-only view (pV2-STORE-01) — any active member; approved + active
   *  items only (e.g. an agent viewing a product). */
  getPublic(id: string): Observable<StoreItem> {
    return this.api.get<StoreItem>(`/api/marketplace/items/${id}`);
  }

  /** Approve / reject — moderation (status only; supplier activates later). */
  decide(id: string, decision: 'approve' | 'reject'): Observable<StoreItem> {
    return this.api.put<StoreItem>(`/api/admin/items/${id}/approval`, { decision }).pipe(this.bust());
  }

  /** Owner item management (pV2-STORE-01). */
  setActive(id: string, isActive: boolean): Observable<StoreItem> {
    return this.api.patch<StoreItem>(`/api/store/items/${id}/active`, { is_active: isActive }).pipe(this.bust());
  }
  duplicate(id: string): Observable<StoreItem> {
    return this.api.post<StoreItem>(`/api/store/items/${id}/duplicate`, {}).pipe(this.bust());
  }
  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/api/store/items/${id}`).pipe(this.bust());
  }
}
