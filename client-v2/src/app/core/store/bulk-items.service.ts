import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from '../api.service';
import { CatalogueService } from '../marketplace/catalogue.service';

/** Which endpoint pair a bulk action targets — owner (own org) vs admin (cross-org). */
export type BulkScope = 'owner' | 'admin';

/** Owner actions (own items) vs admin actions (cross-org moderation). refresh-images
 *  is shared by both. These mirror the server Zod enums 1:1 (defence-in-depth). */
export type OwnerBulkAction = 'activate' | 'deactivate' | 'reclassify' | 'submit' | 'delete' | 'refresh-images';
export type AdminBulkAction = 'approve' | 'reject' | 'delete' | 'refresh-images';
export type BulkAction = OwnerBulkAction | AdminBulkAction;

/** Synchronous bulk result (every action except refresh-images). */
export interface BulkResult {
  action: string;
  requested: number;
  updated: number;
  skipped: number;
}

/** refresh-images response — a background job was started; poll it. */
export interface BulkJobStarted {
  action: 'refresh-images';
  jobId: string;
  total: number;
}

/** One refresh-images job poll (shape from catalogue-extract.service jobToClient). */
export interface RefreshJob {
  jobId: string;
  kind: string;
  status: 'running' | 'cancelling' | 'cancelled' | 'done' | 'error';
  processed: number;
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  error: string | null;
}

/** pV2-ITEM-BULK-ACTIONS-01 — the bulk item-management client. One choke point for
 *  both bulk endpoints; busts the marketplace read cache after any write so the grid
 *  reflects the change on reload. */
@Injectable({ providedIn: 'root' })
export class BulkItemsService {
  private readonly api = inject(ApiService);
  private readonly catalogue = inject(CatalogueService);

  private readonly bust = <T>() => tap<T>(() => this.catalogue.invalidate());

  private base(scope: BulkScope): string {
    return scope === 'admin' ? '/api/admin/items' : '/api/store/items';
  }

  /** Run a synchronous bulk action (NOT refresh-images). Returns the count summary. */
  run(scope: BulkScope, action: Exclude<BulkAction, 'refresh-images'>, ids: string[], opts?: { categoryId?: string }): Observable<BulkResult> {
    const body: Record<string, unknown> = { action, ids };
    if (opts?.categoryId) body['categoryId'] = opts.categoryId;
    return this.api.post<BulkResult>(`${this.base(scope)}/bulk`, body).pipe(this.bust());
  }

  /** Start the refresh-images background job. Poll with `pollRefresh`. */
  startRefresh(scope: BulkScope, ids: string[]): Observable<BulkJobStarted> {
    return this.api.post<BulkJobStarted>(`${this.base(scope)}/bulk`, { action: 'refresh-images', ids });
  }

  /** Poll one refresh job (own-org scoped on the server). Busting the cache is left to
   *  the caller once the job finishes (so the grid reloads with the new photos). */
  pollRefresh(scope: BulkScope, jobId: string): Observable<RefreshJob> {
    return this.api.get<RefreshJob>(`${this.base(scope)}/bulk/refresh/${jobId}`);
  }

  /** Bust the marketplace read cache (call after a refresh job completes). */
  invalidate(): void {
    this.catalogue.invalidate();
  }
}
