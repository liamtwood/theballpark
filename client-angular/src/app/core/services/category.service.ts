import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
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

  /** Top-level (parent_id === null) categories in the catalogue namespace.
      Filtered client-side from getAll('catalogue') — the API doesn't expose
      a dedicated parent-only filter today and the list is small (~10 rows). */
  getTopLevel(namespace: string = 'catalogue'): Observable<Category[]> {
    return this.getAll(namespace).pipe(
      map(rows => (rows || []).filter(c => !c.parent_id))
    );
  }

  /** Direct children of a given parent category. Same client-side filter
      pattern as getTopLevel(). */
  getChildren(parentId: string, namespace: string = 'catalogue'): Observable<Category[]> {
    return this.getAll(namespace).pipe(
      map(rows => (rows || []).filter(c => c.parent_id === parentId))
    );
  }
}
