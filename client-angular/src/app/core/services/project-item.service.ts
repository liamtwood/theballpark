import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { ProjectItem, SelectionType } from '../../models';

/**
 * Project-scoped "cart" — items a project has selected (tick) or liked
 * (heart). Backed by the project_items table added in v1.13. The cache
 * keyed by projectId means cards across the marketplace, build tab, and
 * project detail can synchronously check membership without re-fetching.
 */
@Injectable({ providedIn: 'root' })
export class ProjectItemService {
  /** projectId → ProjectItem[] from the last getByProject() call. */
  private cache = new Map<string, ProjectItem[]>();

  constructor(private api: ApiService) {}

  getByProject(projectId: string): Observable<ProjectItem[]> {
    return this.api.get<ProjectItem[]>(`/project-items?project_id=${encodeURIComponent(projectId)}`).pipe(
      tap(rows => this.cache.set(projectId, rows || []))
    );
  }

  add(
    projectId: string,
    itemId: string,
    selectionType: SelectionType = 'selected',
    projectCategoryId?: string
  ): Observable<ProjectItem> {
    return this.api.post<ProjectItem>('/project-items', {
      project_id: projectId,
      item_id: itemId,
      selection_type: selectionType,
      project_category_id: projectCategoryId ?? null
    }).pipe(
      tap(row => this.upsertCache(projectId, row))
    );
  }

  /** v1.65f2 — update buy quantity on a cart row. Server clamps to a
      minimum of 1; pass an integer >= 1 here. Triggers a ballpark
      recompute server-side, so the Estimate / Overview panels see
      fresh numbers on next read. */
  setQuantity(projectId: string, itemId: string, quantity: number): Observable<ProjectItem> {
    return this.api.patch<ProjectItem>(`/project-items/${projectId}/${itemId}`, { quantity }).pipe(
      tap(row => this.upsertCache(projectId, row))
    );
  }

  /** v1.65fA — partial snapshot update. Pass any subset of
      { name, base_price, unit, description, quantity } — only the
      provided keys are written. Edits go to the project_items
      SNAPSHOT row, not the catalogue master, so the agent can tweak
      "Sit-Down Dinner" for this brief without changing Rocket
      Food's catalogue. Ballpark recompute fires server-side when
      base_price / unit / quantity change. */
  update(
    projectId: string,
    itemId: string,
    patch: Partial<Pick<ProjectItem, 'name' | 'base_price' | 'unit' | 'description' | 'quantity'>>
  ): Observable<ProjectItem> {
    return this.api.patch<ProjectItem>(`/project-items/${projectId}/${itemId}`, patch).pipe(
      tap(row => this.upsertCache(projectId, row))
    );
  }

  /** v1.65f2 — synchronous quantity read against the cache.
      Defaults to 1 if the row hasn't been fetched yet or no quantity
      was set, mirroring the DB DEFAULT. */
  getQuantity(projectId: string, itemId: string): number {
    const row = this.cache.get(projectId)?.find(p => p.item_id === itemId);
    const q = Number(row?.quantity);
    return Number.isFinite(q) && q > 0 ? q : 1;
  }

  remove(projectId: string, itemId: string): Observable<ProjectItem> {
    return this.api.delete<ProjectItem>(`/project-items/${projectId}/${itemId}`).pipe(
      tap(() => this.removeFromCache(projectId, itemId))
    );
  }

  /** Synchronous membership check against the last cached list. Returns
      false if the project has not been fetched yet. */
  isInProject(projectId: string, itemId: string): boolean {
    return !!this.cache.get(projectId)?.some(p => p.item_id === itemId);
  }

  /** Returns the selection type for an item in a project, or null if not
      present (or project not yet fetched). */
  getSelectionType(projectId: string, itemId: string): SelectionType | null {
    const row = this.cache.get(projectId)?.find(p => p.item_id === itemId);
    return row?.selection_type ?? null;
  }

  /** Drop a project's cache so the next getByProject() re-fetches. */
  invalidate(projectId?: string): void {
    if (projectId) this.cache.delete(projectId);
    else this.cache.clear();
  }

  private upsertCache(projectId: string, row: ProjectItem): void {
    const list = this.cache.get(projectId) || [];
    const idx = list.findIndex(p => p.item_id === row.item_id);
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.push(row);
    this.cache.set(projectId, list);
  }

  private removeFromCache(projectId: string, itemId: string): void {
    const list = this.cache.get(projectId);
    if (!list) return;
    this.cache.set(projectId, list.filter(p => p.item_id !== itemId));
  }
}
