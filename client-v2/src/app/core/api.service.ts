import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';

/** Single HTTP entry point. Every feature uses this — never `HttpClient`
 *  directly, never a hardcoded URL. The base URL comes from runtime config. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly rc = inject(RuntimeConfigService);

  private base(): string {
    return this.rc.get().apiBaseUrl;
  }

  /** GET `{apiBaseUrl}{path}`. withCredentials so the bp_session cookie flows. */
  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${this.base()}${path}`, { withCredentials: true });
  }

  /** POST `{apiBaseUrl}{path}`. */
  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base()}${path}`, body, { withCredentials: true });
  }

  /** PUT `{apiBaseUrl}{path}`. */
  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.base()}${path}`, body, { withCredentials: true });
  }

  /** PATCH `{apiBaseUrl}{path}`. */
  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.base()}${path}`, body, { withCredentials: true });
  }

  /** DELETE `{apiBaseUrl}{path}`. */
  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base()}${path}`, { withCredentials: true });
  }
}
