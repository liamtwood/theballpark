import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { ApiService } from '../api.service';
import {
  Codelist,
  CodelistValue,
  CodelistValueCreate,
  CodelistValuePatch,
} from './codelist.types';

/** pV2-CODELISTS-01 — the client codelist read path + admin curation
 *  writes. Same session-cache discipline as the marketplace
 *  CatalogueService: reads memoised by list, shared in-flight promises,
 *  failed flights evicted, EVERY write busts the cache (so open
 *  dropdowns refetch truth on next read). */
@Injectable({ providedIn: 'root' })
export class CodelistService {
  private readonly api = inject(ApiService);

  private readonly cache = new Map<string, Promise<unknown>>();

  invalidate(): void {
    this.cache.clear();
  }

  private cached<T>(key: string, fetcher: () => Observable<T>): Promise<T> {
    let hit = this.cache.get(key) as Promise<T> | undefined;
    if (!hit) {
      hit = firstValueFrom(fetcher());
      hit.catch(() => this.cache.delete(key));
      this.cache.set(key, hit);
    }
    return hit;
  }

  /** Active values of a list — THE consumer read (dropdowns, pills).
   *  /:list/values, NOT /:list — the bare path is v1's ungated raw-row
   *  read (mounted first) until v1 retires. */
  list(listName: string): Promise<CodelistValue[]> {
    return this.cached(`values:${listName}`, () =>
      this.api.get<CodelistValue[]>(`/api/codelists/${listName}/values`)
    );
  }

  /** Sugar per the doc's consumption examples. */
  async label(listName: string, code: string): Promise<string> {
    const values = await this.list(listName);
    return values.find((v) => v.code === code)?.label ?? code;
  }

  async getMeta(listName: string, code: string): Promise<CodelistValue['meta'] | null> {
    const values = await this.list(listName);
    return values.find((v) => v.code === code)?.meta ?? null;
  }

  // ── Admin curation (ballpark admins; server enforces) ────────────────
  parents(): Observable<Codelist[]> {
    return this.api.get<Codelist[]>('/api/codelists');
  }

  valuesAll(listName: string): Observable<CodelistValue[]> {
    return this.api.get<CodelistValue[]>(`/api/codelists/${listName}/all`);
  }

  usage(listName: string, code: string): Observable<{ count: number | null }> {
    return this.api.get<{ count: number | null }>(
      `/api/codelists/${listName}/values/${code}/usage`
    );
  }

  addValue(listName: string, value: CodelistValueCreate): Observable<CodelistValue> {
    return this.api
      .post<CodelistValue>(`/api/codelists/${listName}/values`, value)
      .pipe(tap(() => this.invalidate()));
  }

  patchValue(listName: string, code: string, patch: CodelistValuePatch): Observable<CodelistValue> {
    return this.api
      .patch<CodelistValue>(`/api/codelists/${listName}/values/${code}`, patch)
      .pipe(tap(() => this.invalidate()));
  }
}
