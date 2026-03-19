import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Estimate } from '../../models';

@Injectable({ providedIn: 'root' })
export class EstimateService {
  constructor(private api: ApiService) {}
  getAll() { return this.api.get<Estimate[]>('/estimates'); }
  getById(id: string) { return this.api.get<Estimate>(`/estimates/${id}`); }
  create(data: any) { return this.api.post<Estimate>('/estimates', data); }
  update(id: string, data: any) { return this.api.put<Estimate>(`/estimates/${id}`, data); }
  delete(id: string) { return this.api.delete<Estimate>(`/estimates/${id}`); }
  getByProject(projectId: string) { return this.api.get<Estimate[]>(`/estimates?project_id=${projectId}`); }
}
