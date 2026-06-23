import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Item } from '../../models';

/**
 * Org-scoped item CRUD. Read paths (browse, search) live on SupplierService;
 * this service is for the supplier's own catalogue management — the
 * item-drawer's create/update/delete endpoints.
 *
 * Note: list reads via getByOrg() are intentionally tiny — the marketplace
 * grid pages use SupplierService.getItems() with category/tag filters.
 */
@Injectable({ providedIn: 'root' })
export class ItemService {
  constructor(private api: ApiService) {}

  /** All items owned by a single org. Used by the lineage dropdowns in the
      item drawer (current org's catalogue, minus the item being edited). */
  getByOrg(orgId: string) {
    return this.api.get<Item[]>(`/items?org_id=${encodeURIComponent(orgId)}`);
  }

  getById(id: string) {
    return this.api.get<Item>(`/items/${id}`);
  }

  create(data: Partial<Item>) {
    return this.api.post<Item>('/items', data);
  }

  update(id: string, data: Partial<Item>) {
    return this.api.put<Item>(`/items/${id}`, data);
  }

  /** Soft delete — v1.68b: backend now sets deleted_at (was is_active=false).
      Removes the item from the supplier's own store AND the marketplace. */
  delete(id: string) {
    return this.api.delete<Item>(`/items/${id}`);
  }

  /** v1.68b — publish/hide toggle (distinct from delete). Sets items.is_active:
      false hides the item from the marketplace (still visible, badged "Hidden",
      in the owner's own store); true re-publishes it. */
  setActive(id: string, isActive: boolean) {
    return this.api.put<Item>(`/items/${id}`, { is_active: isActive });
  }

  /** v1.68b — duplicate an item (row + gallery + taxonomy). The copy lands
      hidden (is_active=false) for review before publishing. */
  duplicate(id: string) {
    return this.api.post<Item>(`/items/${id}/duplicate`, {});
  }
}
