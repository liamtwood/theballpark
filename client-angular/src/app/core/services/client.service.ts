import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Client, Project } from '../models';

@Injectable({ providedIn: 'root' })
export class ClientService {
  constructor(private api: ApiService) {}
  getAll() { return this.api.get<Client[]>('/clients'); }
  getById(id: string) { return this.api.get<Client>(`/clients/${id}`); }
  create(data: any) { return this.api.post<Client>('/clients', data); }
  update(id: string, data: any) { return this.api.put<Client>(`/clients/${id}`, data); }
  delete(id: string) { return this.api.delete<Client>(`/clients/${id}`); }
  getProjectsForClient(id: string) { return this.api.get<Project[]>(`/clients/${id}/projects`); }
}
