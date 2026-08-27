import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';
import { EstimateBreakdown, ProjectCard, ProjectCreatePayload, ProjectDetail, ProjectUpdate, QuoteLine } from './project.types';

/** pV2-BUILDUP-02 — a supplier's reusable component (the derived library). */
export interface MyComponent {
  id: string;
  name: string;
  base_price: number | null;
  unit: string | null;
  category_id: string | null;
  kind: string | null;
  description: string | null;
  image_url: string | null;
}

/** pV2-BUILDUP-02 — one component line the supplier adds under a parent.
 *  `id` present = update an existing child (reconcile). */
export interface ComponentInput {
  id?: string;
  categoryId: string | null;
  name: string;
  cost: number | null;
  unit: string | null;
  quantity: number;
  kind: string | null;
  included: boolean;
  description?: string | null;
  /** Demo: an inline data URL stored in project_items.image_url (text). */
  image?: string | null;
}

/** pV2-BUILDUP-02 — the re-open payload: the line's children + its saved margin
 *  (null = never set) + the supplier org's default margin to seed from. */
export interface ComponentsResponse {
  components: ComponentRow[];
  parentName: string;
  parentDescription: string | null;
  parentServices: string | null;
  marginPct: number | null;
  defaultMarginPct: number | null;
}

/** pV2-BUILDUP-02 — an existing child component (as stored), for re-open. */
export interface ComponentRow {
  id: string;
  name: string;
  base_price: number | null;
  unit: string | null;
  quantity: number;
  category_id: string | null;
  kind: string | null;
  selection_type: string;
  description: string | null;
  image_url: string | null;
}

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
    /** The item's unit (per head / day), carried from a looked-up item. */
    unit?: string | null;
    /** pV2-BUILDUP-01 (UI1): supplier this line is added for (tags it). */
    supplierOrgId?: string | null;
    /** pV2-BUILDUP-03: parent quote line this line is a picked option of. */
    optionOfLineId?: string | null;
  }): Observable<QuoteLine> {
    return this.api.post<QuoteLine>(`/api/projects-v2/${projectId}/items/custom`, body);
  }

  removeQuoteItem(projectId: string, itemId: string): Observable<{ removed: boolean }> {
    return this.api.delete<{ removed: boolean }>(`/api/projects-v2/${projectId}/items/${itemId}`);
  }

  /** pV2-BUILDUP-02 — the supplier's reusable components (derived library) for
   *  the Customize left rail + type-ahead. */
  listMyComponents(q?: string): Observable<MyComponent[]> {
    const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return this.api.get<MyComponent[]>(`/api/projects-v2/my-components${qs}`);
  }

  /** pV2-BUILDUP-02 — the line's current child components + its saved margin
   *  (and the org default to seed from) — for re-opening the estimate. */
  getComponents(projectId: string, lineId: string): Observable<ComponentsResponse> {
    return this.api.get<ComponentsResponse>(`/api/projects-v2/${projectId}/items/${lineId}/components`);
  }

  /** pV2-BUILDUP-02 — reconcile the line's components (add/update/remove) + the
   *  revised price and the line-level margin (the supplier's estimate quote). */
  saveComponents(projectId: string, lineId: string, components: ComponentInput[], revisedPrice: number | null, marginPct: number | null, parent?: { name?: string; description?: string | null; services?: string | null }): Observable<ComponentRow[]> {
    return this.api.post<ComponentRow[]>(`/api/projects-v2/${projectId}/items/${lineId}/components`, {
      components, revisedPrice, marginPct, parentName: parent?.name, parentDescription: parent?.description, parentServices: parent?.services,
    });
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

  /** Edit a line's free-text details (name / description / Services) — the
   *  supplier records what they changed on the line. NOT lock-gated. */
  updateLineDetails(
    projectId: string, itemId: string,
    body: { name?: string; description?: string | null; services?: string | null },
  ): Observable<QuoteLine> {
    return this.api.patch<QuoteLine>(`/api/projects-v2/${projectId}/items/${itemId}/details`, body);
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
