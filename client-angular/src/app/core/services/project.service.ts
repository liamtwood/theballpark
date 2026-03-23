import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { ApiService } from './api.service';
import { Project } from '../../models';

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
}
