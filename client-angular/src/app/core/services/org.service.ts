import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Org, User } from '../models';

@Injectable({ providedIn: 'root' })
export class OrgService {
  constructor(private api: ApiService) {}
  getAll() { return this.api.get<Org[]>('/orgs'); }
  getById(id: string) { return this.api.get<Org>(`/orgs/${id}`); }
  create(data: Partial<Org>) { return this.api.post<Org>('/orgs', data); }
  update(id: string, data: Partial<Org>) { return this.api.put<Org>(`/orgs/${id}`, data); }
  delete(id: string) { return this.api.delete<Org>(`/orgs/${id}`); }
  getCurrentOrg() { return this.api.get<Org>('/org'); }
  updateCurrentOrg(data: any) { return this.api.put<Org>('/org', data); }
  getBallsBalance() { return this.api.get<{ balance: number }>('/org/balls-balance'); }
  getUsers() { return this.api.get<User[]>('/org/users'); }
}
