import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AnalyseJobStart, ExtractReport, MappingRow, PrepareResult, PullJob, PullStart } from './admin-org.service';

/** pV2-STORE-EXTRACT-01 — the catalogue extractor's HTTP calls, keyed by a BASE
 *  path so the one client serves both mounts without duplication:
 *    • admin cross-org : `/api/admin/orgs/${orgId}/extract`
 *    • self-serve own  : `/api/organisation/extract`
 *  The caller (website-import-panel) picks the base from its mode; the server
 *  shares the same handlers behind each (routes/extract-routes.js). */
@Injectable({ providedIn: 'root' })
export class CatalogueExtractClient {
  private readonly api = inject(ApiService);

  /** ANALYSE — section/product URL → report sync; HOMEPAGE → { jobId, async } job. */
  analyse(base: string, url: string): Observable<ExtractReport | AnalyseJobStart> {
    return this.api.post<ExtractReport | AnalyseJobStart>(`${base}/analyse`, { url });
  }

  /** PREPARE — cat/subcat suggestion per group + the taxonomy tree. */
  prepare(base: string, groups: Array<{ key: string; sample?: string }>): Observable<PrepareResult> {
    return this.api.post<PrepareResult>(`${base}/prepare`, { groups });
  }

  /** CATEGORIES-ONLY — create the new subcats the mapping needs; no item pull. */
  applyMapping(base: string, mapping: Record<string, MappingRow>): Observable<{ created: number; groups: Array<{ key: string; status: string }> }> {
    return this.api.post<{ created: number; groups: Array<{ key: string; status: string }> }>(`${base}/prepare/apply`, { mapping });
  }

  /** PULL — start the background job that creates pending items from product URLs. */
  pull(base: string, urls: string[], mode: 'review' | 'full' = 'full', mapping?: Record<string, MappingRow>): Observable<PullStart> {
    return this.api.post<PullStart>(`${base}/pull`, { urls, mode, mapping });
  }

  /** Poll one pull job's live status/progress/results. */
  job(base: string, jobId: string): Observable<PullJob> {
    return this.api.get<PullJob>(`${base}/job/${jobId}`);
  }

  /** The org's active (running) pull job, or null — for re-attaching on return. */
  activeJob(base: string): Observable<PullJob | null> {
    return this.api.get<PullJob | null>(`${base}/job`);
  }

  /** Request cancel — the runner stops before the next item; created items stay. */
  cancel(base: string, jobId: string): Observable<{ cancelling: boolean }> {
    return this.api.post<{ cancelling: boolean }>(`${base}/job/${jobId}/cancel`, {});
  }
}
