import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { ApiService } from './api.service';
import { Project, ProjectCategory } from '../../models';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private refreshSubject = new Subject<void>();
  refresh$ = this.refreshSubject.asObservable();

  constructor(private api: ApiService) {}
  getAll() { return this.api.get<Project[]>('/projects'); }
  getById(id: string) { return this.api.get<Project>(`/projects/${id}`); }
  create(data: any) { return this.api.post<Project>('/projects', data); }
  update(id: string, data: any) { return this.api.put<Project>(`/projects/${id}`, data); }
  delete(id: string) { return this.api.delete<Project>(`/projects/${id}`); }
  getByOrg(orgId: string) { return this.api.get<Project[]>(`/projects?org_id=${orgId}`); }
  triggerRefresh() { this.refreshSubject.next(); }

  // ── Brief tab — scope picker + per-category briefs ──
  getCategories(projectId: string) {
    return this.api.get<ProjectCategory[]>(`/projects/${projectId}/categories`);
  }
  upsertCategory(projectId: string, categoryId: string, data: { requirement_brief?: string; ballpark_budget?: number | null }) {
    return this.api.patch<ProjectCategory>(`/projects/${projectId}/categories/${categoryId}`, data);
  }
  removeCategory(projectId: string, categoryId: string) {
    return this.api.delete<ProjectCategory>(`/projects/${projectId}/categories/${categoryId}`);
  }
  // Build tab — soft toggle. Preserves requirement_brief across un-scope → re-scope.
  setCategoryScope(projectId: string, categoryId: string, active: boolean) {
    return this.api.put<ProjectCategory>(
      `/projects/${projectId}/categories/${categoryId}/scope`, { active }
    );
  }
}
