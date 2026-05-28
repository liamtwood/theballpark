import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { OrgService } from './org.service';
import { BehaviorSubject, Observable, ReplaySubject, switchMap, tap, take } from 'rxjs';

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
  /** v1.65dl — fires once orgId is set so callers (the dashboard's
      loadFavourites, in particular) don't race the async
      getCurrentOrg() subscription and ship an empty org_id=
      query string. ReplaySubject(1) so late subscribers get the
      last value. */
  private orgReady$ = new ReplaySubject<string>(1);

  constructor(private api: ApiService, private orgSvc: OrgService) {
    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) {
        this.orgId = org.id;
        this.orgReady$.next(org.id);
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

  /** v1.65dl — gates the actual HTTP call on orgReady$ so a caller
      who subscribes BEFORE getCurrentOrg() resolves still gets a
      valid request once the org lands (was firing immediately with
      org_id= empty, which hit the API as "no org" and returned []). */
  getAll(type?: 'supplier' | 'item'): Observable<Favourite[]> {
    return this.orgReady$.pipe(
      take(1),
      switchMap(orgId => {
        const url = type
          ? `/favourites?org_id=${orgId}&type=${type}`
          : `/favourites?org_id=${orgId}`;
        return this.api.get<Favourite[]>(url);
      })
    );
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
