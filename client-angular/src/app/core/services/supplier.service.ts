import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Org, Item } from '../../models';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  constructor(private api: ApiService) {}

  getAll() { return this.api.get<Org[]>('/suppliers'); }

  /** v1.68b — includeHidden=true (owner viewing their OWN /store) relaxes the
      is_active filter so hidden items return (badged "Hidden"). Deleted items
      stay excluded either way. Public/marketplace callers omit it. */
  getCatalogue(supplierId: string, includeHidden = false) {
    const q = includeHidden ? '?include_hidden=true' : '';
    return this.api.get<Item[]>(`/suppliers/${supplierId}/catalogue${q}`);
  }

  getItems(params: { category_id?: string; subcategory_id?: string; tag?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.category_id)    qs.set('category_id',    params.category_id);
    if (params.subcategory_id) qs.set('subcategory_id', params.subcategory_id);
    if (params.tag)            qs.set('tag',            params.tag);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.api.get<any[]>(`/items${query}`);
  }

  getTagsByCategory(categoryId: string) {
    return this.api.get<string[]>(`/items/tags?category_id=${categoryId}`);
  }

  getItemCounts() {
    return this.api.get<{ counts: Record<string, number>; total: number }>('/items/counts');
  }
}
