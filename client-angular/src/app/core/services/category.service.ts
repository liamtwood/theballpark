import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Category } from '../../models';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  constructor(private api: ApiService) {}
  getAll(namespace?: string) {
    const params = namespace ? `?namespace=${namespace}` : '';
    return this.api.get<Category[]>(`/categories${params}`);
  }
  getById(id: string) { return this.api.get<Category>(`/categories/${id}`); }
  create(data: any) { return this.api.post<Category>('/categories', data); }
  update(id: string, data: any) { return this.api.put<Category>(`/categories/${id}`, data); }
  patch(id: string, data: any) { return this.api.patch<Category>(`/categories/${id}`, data); }
  delete(id: string) { return this.api.delete<Category>(`/categories/${id}`); }
}
