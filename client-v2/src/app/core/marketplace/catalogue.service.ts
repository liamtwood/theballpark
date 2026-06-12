import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';
import { CategoryInfo, CategoryUpdate } from '../../shared/catalogue/catalogue.types';

/** pV2-MARKET-00 — catalogue reads + platform-admin curation writes. The
 *  ONE choke point for marketplace HTTP (the pV2-06a Map cache + busting
 *  rules land here — see pV2-06-angular-architecture.md §4). */
@Injectable({ providedIn: 'root' })
export class CatalogueService {
  private readonly api = inject(ApiService);

  /** Active top-level categories + counts — the browse rail. */
  categories(): Observable<CategoryInfo[]> {
    return this.api.get<CategoryInfo[]>('/api/marketplace/categories');
  }

  /** Every top-level category incl. inactive — the curation table
   *  (server-gated to platform admins). */
  adminCategories(): Observable<CategoryInfo[]> {
    return this.api.get<CategoryInfo[]>('/api/marketplace/categories/all');
  }

  /** Curation update; resolves to the fresh row (with live count). */
  updateCategory(id: string, patch: CategoryUpdate): Observable<CategoryInfo> {
    return this.api.patch<CategoryInfo>(`/api/marketplace/categories/${id}`, patch);
  }
}
