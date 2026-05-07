import { Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Codelist } from '../../models';

const DEFAULT_DISPLAY_LISTS = ['item_unit', 'item_time_unit'];

@Injectable({ providedIn: 'root' })
export class CodelistService {
  private cache = new Map<string, Codelist[]>();

  constructor(private api: ApiService) {}

  getByName(listName: string): Observable<Codelist[]> {
    const cached = this.cache.get(listName);
    if (cached) return of(cached);
    return this.api.get<Codelist[]>(`/codelists/${listName}`).pipe(
      tap(rows => this.cache.set(listName, rows))
    );
  }

  create(listName: string, data: Partial<Codelist>): Observable<Codelist> {
    return this.api.post<Codelist>(`/codelists/admin/${listName}`, data).pipe(
      tap(() => this.cache.delete(listName))
    );
  }

  update(id: string, data: Partial<Codelist>): Observable<Codelist> {
    return this.api.patch<Codelist>(`/codelists/admin/${id}`, data).pipe(
      tap(updated => updated && this.cache.delete(updated.list_name))
    );
  }

  delete(id: string): Observable<Codelist> {
    return this.api.delete<Codelist>(`/codelists/admin/${id}`).pipe(
      tap(removed => removed && this.cache.delete(removed.list_name))
    );
  }

  getAll(): Observable<string[]> {
    return this.api.get<string[]>('/codelists/admin');
  }

  invalidate(listName?: string): void {
    if (listName) this.cache.delete(listName);
    else this.cache.clear();
  }

  getDisplay(code: string, listNames: string[] = DEFAULT_DISPLAY_LISTS): string {
    if (!code) return '';
    for (const name of listNames) {
      const list = this.cache.get(name);
      if (!list) continue;
      const match = list.find(c => c.code === code);
      if (match) return match.symbol || match.label || code;
    }
    return code;
  }
}
