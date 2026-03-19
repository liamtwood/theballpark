import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ProjectCategory } from '../../models';

@Injectable({ providedIn: 'root' })
export class ProjectCategoryService {
  constructor(private api: ApiService) {}
  getAll() { return this.api.get<ProjectCategory[]>('/project-categories'); }
  getById(id: string) { return this.api.get<ProjectCategory>(`/project-categories/${id}`); }
  create(data: any) { return this.api.post<ProjectCategory>('/project-categories', data); }
  update(id: string, data: any) { return this.api.put<ProjectCategory>(`/project-categories/${id}`, data); }
  delete(id: string) { return this.api.delete<ProjectCategory>(`/project-categories/${id}`); }
  getByProject(projectId: string) { return this.api.get<ProjectCategory[]>(`/project-categories?project_id=${projectId}`); }
}
