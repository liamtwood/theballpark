import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { OrgService } from './org.service';
import { BehaviorSubject, Observable, switchMap, tap } from 'rxjs';

export interface Favourite {
  id: string;
  org_id: string;
  type: 'supplier' | 'item';
  ref_id: string;
  ref_name: string;
  ref_image_url?: string;
  ref_price?: number;
  ref_category?: string;
  supplier_name?: string;
  supplier_org_id?: string;
  is_active: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class FavouriteService {
  // Local cache of favourited IDs for instant UI feedback
  private supplierIds$ = new BehaviorSubject<Set<string>>(new Set());
  private itemIds$     = new BehaviorSubject<Set<string>>(new Set());

  private orgId = '';

  constructor(private api: ApiService, private orgSvc: OrgService) {
    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) {
        this.orgId = org.id;
        this.loadIds();
      }
    });
  }

  private loadIds() {
    this.api.get<string[]>(`/favourites/ids?org_id=${this.orgId}&type=supplier`)
      .subscribe(ids => this.supplierIds$.next(new Set(ids || [])));
    this.api.get<string[]>(`/favourites/ids?org_id=${this.orgId}&type=item`)
      .subscribe(ids => this.itemIds$.next(new Set(ids || [])));
  }

  getAll(type?: 'supplier' | 'item'): Observable<Favourite[]> {
    const url = type
      ? `/favourites?org_id=${this.orgId}&type=${type}`
      : `/favourites?org_id=${this.orgId}`;
    return this.api.get<Favourite[]>(url);
  }

  isSupplierFavourited(supplierId: string): boolean {
    return this.supplierIds$.value.has(supplierId);
  }

  isItemFavourited(itemId: string): boolean {
    return this.itemIds$.value.has(itemId);
  }

  toggleSupplier(supplierId: string): Observable<{ favourited: boolean }> {
    return this.api.post<{ favourited: boolean }>('/favourites/toggle', {
      org_id: this.orgId, type: 'supplier', ref_id: supplierId
    }).pipe(tap(result => {
      const ids = new Set(this.supplierIds$.value);
      if (result.favourited) ids.add(supplierId); else ids.delete(supplierId);
      this.supplierIds$.next(ids);
    }));
  }

  toggleItem(itemId: string): Observable<{ favourited: boolean }> {
    return this.api.post<{ favourited: boolean }>('/favourites/toggle', {
      org_id: this.orgId, type: 'item', ref_id: itemId
    }).pipe(tap(result => {
      const ids = new Set(this.itemIds$.value);
      if (result.favourited) ids.add(itemId); else ids.delete(itemId);
      this.itemIds$.next(ids);
    }));
  }

  // Observables for reactive UI
  get supplierFavIds$(): Observable<Set<string>> { return this.supplierIds$.asObservable(); }
  get itemFavIds$(): Observable<Set<string>>     { return this.itemIds$.asObservable(); }
}
