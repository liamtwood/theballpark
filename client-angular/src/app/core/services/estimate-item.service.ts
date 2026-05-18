import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { EstimateItem } from '../../models';

/**
 * v1.24k — thin client wrapper for /api/estimate-items. The primary
 * read paths are:
 *   getByEstimate(estimateId)  → server's existing ?estimate_id filter
 *   getByProject(projectId)    → server-side JOIN through estimates;
 *                                used by the project Overview tab to
 *                                roll up SELECTED / QUOTED / BOOKED
 *                                counts across every estimate on the
 *                                project.
 *
 * Mutations are deferred — the Estimate tab still goes through its
 * own existing service paths.
 */
@Injectable({ providedIn: 'root' })
export class EstimateItemService {
  constructor(private api: ApiService) {}

  getByEstimate(estimateId: string): Observable<EstimateItem[]> {
    return this.api.get<EstimateItem[]>(`/estimate-items?estimate_id=${encodeURIComponent(estimateId)}`);
  }

  getByProject(projectId: string): Observable<EstimateItem[]> {
    return this.api.get<EstimateItem[]>(`/estimate-items?project_id=${encodeURIComponent(projectId)}`);
  }
}
