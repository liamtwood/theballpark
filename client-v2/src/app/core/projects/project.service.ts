import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';
import { EstimateBreakdown, ProjectCard, ProjectCreatePayload, ProjectDetail, ProjectUpdate, QuoteLine } from './project.types';

/** pV2-PROJECTS-01 — the v2 projects read path. INTERIM base
 *  `/api/projects-v2`: v1 owns the live ungated `/api/projects` until
 *  pV2-11; this is the gated, org-scoped (JWT) v2 surface. */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly api = inject(ApiService);

  /** The caller's org's projects (org scoping is server-side, from JWT). */
  list(): Observable<ProjectCard[]> {
    return this.api.get<ProjectCard[]>('/api/projects-v2');
  }

  /** Create a project from an AI-parsed brief (no items). Returns the new
   *  list card. org from JWT — never sent. */
  create(payload: ProjectCreatePayload): Observable<ProjectCard> {
    return this.api.post<ProjectCard>('/api/projects-v2', payload);
  }

  /** One project's full detail (inside-project view). */
  getDetail(id: string): Observable<ProjectDetail> {
    return this.api.get<ProjectDetail>(`/api/projects-v2/${id}`);
  }

  /** Distinct client names this org has used — feeds the About Project client
   *  type-ahead (self-populating suggestions, free text still allowed). */
  clientNames(): Observable<string[]> {
    return this.api.get<string[]>('/api/projects-v2/client-names');
  }

  /** Partial update (Project Details tab). Returns the fresh detail. */
  update(id: string, patch: ProjectUpdate): Observable<ProjectDetail> {
    return this.api.put<ProjectDetail>(`/api/projects-v2/${id}`, patch);
  }

  // ── Project Quote (slice 2) — minimal add/remove ──────────────────────
  quoteItems(projectId: string): Observable<QuoteLine[]> {
    return this.api.get<QuoteLine[]>(`/api/projects-v2/${projectId}/items`);
  }

  /** The server-computed estimate breakdown (the ONE cascade). The Estimate
   *  tab consumes this instead of recomputing client-side. `uninstalledItemIds`
   *  are lines the agent opted out of install on (install is otherwise
   *  assumed). */
  estimate(projectId: string, scope: 'all' | 'cart' = 'all'): Observable<EstimateBreakdown> {
    const qs = scope === 'cart' ? '?scope=cart' : '';
    return this.api.get<EstimateBreakdown>(`/api/projects-v2/${projectId}/estimate${qs}`);
  }

  addQuoteItem(projectId: string, itemId: string): Observable<QuoteLine> {
    return this.api.post<QuoteLine>(`/api/projects-v2/${projectId}/items`, { itemId });
  }

  /** pV2-CUSTOMS-01 — add a custom (ad-hoc) line with no catalogue backing. */
  addCustomItem(projectId: string, body: {
    categoryId: string | null; name: string; description?: string | null;
    cost?: number | null; quantity?: number; installed?: boolean | null;
    installCost?: number | null; installUnit?: string | null;
  }): Observable<QuoteLine> {
    return this.api.post<QuoteLine>(`/api/projects-v2/${projectId}/items/custom`, body);
  }

  removeQuoteItem(projectId: string, itemId: string): Observable<{ removed: boolean }> {
    return this.api.delete<{ removed: boolean }>(`/api/projects-v2/${projectId}/items/${itemId}`);
  }

  /** pV2-QUANTITY-01 — set a quote line's quantity (positive integer). */
  setQuoteItemQuantity(projectId: string, itemId: string, quantity: number): Observable<QuoteLine> {
    return this.api.patch<QuoteLine>(`/api/projects-v2/${projectId}/items/${itemId}`, { quantity });
  }

  /** pV2-CART-01 — persist a line's Install choice (true/false, or null to
   *  reset to the default). */
  setQuoteItemInstalled(projectId: string, itemId: string, installed: boolean | null): Observable<QuoteLine> {
    return this.api.patch<QuoteLine>(`/api/projects-v2/${projectId}/items/${itemId}`, { installed });
  }

  /** Recommend + add items from the project's stored brief (v1 matcher per
   *  category). The Estimate tab then displays the grouped quote. */
  recommend(projectId: string): Observable<RecommendResult> {
    return this.api.post<RecommendResult>(`/api/projects-v2/${projectId}/recommend`, {});
  }
}

export interface RecommendResult {
  categories: { category: string; added: number; error?: string }[];
  totalAdded: number;
}
