import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { ApiService } from '../api.service';
import {
  CatalogueItem,
  CatalogueSupplier,
  CategoryInfo,
  CategoryUpdate,
  FavouriteIds,
  ItemsQuery,
  Paginated,
  SupplierDetail,
  SupplierOption,
  SupplierSubcategory,
} from '../../shared/catalogue/catalogue.types';

/** pV2-MARKET-00/06a — catalogue reads + platform-admin curation writes.
 *  The ONE marketplace HTTP choke point, with the §4 session cache:
 *  reads are memoised by URL; the cache busts on (a) page reload (it's
 *  in-memory), (b) any successful WRITE through this service, (c) an
 *  explicit invalidate() from future write surfaces (/store, image
 *  uploads). See pV2-06-angular-architecture.md §"Roundtrip budget". */
@Injectable({ providedIn: 'root' })
export class CatalogueService {
  private readonly api = inject(ApiService);

  /** Session cache: URL → resolved payload. Promise-based so concurrent
   *  identical requests share one flight. */
  private readonly cache = new Map<string, Promise<unknown>>();

  /** Bust every cached read — call after ANY catalogue write. */
  invalidate(): void {
    this.cache.clear();
  }

  /** Stable cache key: sort params so logically identical queries never
   *  double-cache (audit H5 — fragile under future param reordering). */
  private stableUrl(path: string, params: URLSearchParams): string {
    const sorted = new URLSearchParams([...params.entries()].sort(([a], [b]) => a.localeCompare(b)));
    const qs = sorted.toString();
    return qs ? path + '?' + qs : path;
  }

  private cached<T>(url: string, fetcher: () => Observable<T>): Promise<T> {
    let hit = this.cache.get(url) as Promise<T> | undefined;
    if (!hit) {
      hit = firstValueFrom(fetcher());
      // A failed flight must not poison the cache — evict on rejection.
      hit.catch(() => this.cache.delete(url));
      this.cache.set(url, hit);
    }
    return hit;
  }

  /** Active top-level categories + counts — the browse rail. */
  categories(): Promise<CategoryInfo[]> {
    return this.cached('/api/marketplace/categories', () =>
      this.api.get<CategoryInfo[]>('/api/marketplace/categories')
    );
  }

  /** One page of the browse grid (born paginated — PAGE_SIZE 48). */
  items(query: ItemsQuery): Promise<Paginated<CatalogueItem>> {
    const params = new URLSearchParams();
    if (query.cat) params.set('cat', query.cat);
    if (query.sub) params.set('sub', query.sub);
    if (query.q) params.set('q', query.q);
    if (query.priceMin != null) params.set('priceMin', String(query.priceMin));
    if (query.priceMax != null) params.set('priceMax', String(query.priceMax));
    if (query.tier) params.set('tier', query.tier);
    if (query.supplier) params.set('supplier', query.supplier);
    if (query.status) params.set('status', query.status);
    if (query.active) params.set('active', query.active);
    if (query.offset) params.set('offset', String(query.offset));
    const url = this.stableUrl('/api/marketplace/items', params);
    return this.cached(url, () => this.api.get<Paginated<CatalogueItem>>(url));
  }

  /** Active subcategories of a category + live counts (browse strip). */
  subcategories(categoryId: string): Promise<CategoryInfo[]> {
    return this.cached(`/api/marketplace/categories/${categoryId}/subcategories`, () =>
      this.api.get<CategoryInfo[]>(`/api/marketplace/categories/${categoryId}/subcategories`)
    );
  }

  /** One page of the suppliers browse (pV2-06d — same envelope). */
  suppliers(query: { cat?: string | null; q?: string | null; offset?: number }): Promise<Paginated<CatalogueSupplier>> {
    const params = new URLSearchParams();
    if (query.cat) params.set('cat', query.cat);
    if (query.q) params.set('q', query.q);
    if (query.offset) params.set('offset', String(query.offset));
    const url = this.stableUrl('/api/marketplace/suppliers', params);
    return this.cached(url, () => this.api.get<Paginated<CatalogueSupplier>>(url));
  }

  /** The storefront projection (pV2-06d). */
  supplierDetail(id: string): Promise<SupplierDetail> {
    return this.cached(`/api/marketplace/suppliers/${id}`, () =>
      this.api.get<SupplierDetail>(`/api/marketplace/suppliers/${id}`)
    );
  }

  /** The storefront's subcat-card grid rows (pV2-CARDS-01 QC #5). */
  supplierSubcategories(id: string): Promise<SupplierSubcategory[]> {
    return this.cached(`/api/marketplace/suppliers/${id}/subcategories`, () =>
      this.api.get<SupplierSubcategory[]>(`/api/marketplace/suppliers/${id}/subcategories`)
    );
  }

  /** The active org's favourite ids. UNCACHED — toggles must read fresh. */
  favourites(): Observable<FavouriteIds> {
    return this.api.get<FavouriteIds>('/api/marketplace/favourites');
  }

  /** Toggle a favourite for the active org; resolves the new state. */
  toggleFavourite(type: 'item' | 'supplier', refId: string): Observable<{ favourited: boolean }> {
    return this.api.post<{ favourited: boolean }>('/api/marketplace/favourites', { type, refId });
  }

  /** Suppliers with active items — the filter dropdown (pV2-06c). */
  supplierOptions(): Promise<SupplierOption[]> {
    return this.cached('/api/marketplace/suppliers/options', () =>
      this.api.get<SupplierOption[]>('/api/marketplace/suppliers/options')
    );
  }

  /** Every top-level category incl. inactive — the curation table
   *  (server-gated to platform admins). Uncached: the table is the live
   *  editing surface. */
  adminCategories(parent?: string): Observable<CategoryInfo[]> {
    // URLSearchParams like every other builder (closing audit: raw
    // interpolation was the one inconsistent URL in this service).
    const path = '/api/marketplace/categories/all';
    if (!parent) return this.api.get<CategoryInfo[]>(path);
    const params = new URLSearchParams([['parent', parent]]);
    return this.api.get<CategoryInfo[]>(`${path}?${params.toString()}`);
  }

  /** Curation update; resolves to the fresh row (with live count). Busts
   *  the read cache so an open marketplace tab refetches truth. */
  updateCategory(id: string, patch: CategoryUpdate): Observable<CategoryInfo> {
    return this.api
      .patch<CategoryInfo>(`/api/marketplace/categories/${id}`, patch)
      .pipe(tap(() => this.invalidate()));
  }
}
