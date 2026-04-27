import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrgService } from './org.service';

export interface ContentField {
  key: string;
  value: string;
  field_type: 'text' | 'longtext' | 'list';
  label: string;
  help_text: string | null;
  slide: 1 | 2 | 3 | 4;
  display_order: number;
  updated_at: string;
  updated_by: string | null;
}

export interface WelcomeSettings {
  id: number;
  notify_recipients: string[];
  email_subject: string;
  email_body_template: string;
  updated_at: string;
  updated_by: string | null;
}

export interface SignupRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string;
  created_at: string;
  notified_at: string | null;
}

export interface SignupListResponse {
  rows: SignupRow[];
  stats: {
    total: number;
    today: number;
    this_week: number;
    by_role: Record<string, number>;
  };
}

@Injectable({ providedIn: 'root' })
export class MarketingService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient, private orgService: OrgService) {}

  // ── Auth header — stop-gap until proper Supabase auth lands.
  // Sends the current user id (matches the existing client-side admin gate).
  private adminHeaders(): Observable<HttpHeaders> {
    return new Observable(subscriber => {
      this.orgService.getUsers().subscribe({
        next: (users: any[]) => {
          const id = users?.[0]?.id || '';
          subscriber.next(new HttpHeaders({ 'x-bp-user-id': id }));
          subscriber.complete();
        },
        error: (err) => subscriber.error(err)
      });
    });
  }

  listSignups(params: { q?: string; roles?: string[]; sort?: 'newest' | 'oldest' } = {}): Observable<SignupListResponse> {
    return new Observable(subscriber => {
      this.adminHeaders().subscribe(headers => {
        let httpParams = new HttpParams();
        if (params.q)            httpParams = httpParams.set('q', params.q);
        if (params.roles?.length) httpParams = httpParams.set('roles', params.roles.join(','));
        if (params.sort)         httpParams = httpParams.set('sort', params.sort);
        this.http.get<SignupListResponse>(`${this.baseUrl}/admin/signups`, { headers, params: httpParams })
          .subscribe({
            next: r => { subscriber.next(r); subscriber.complete(); },
            error: e => subscriber.error(e)
          });
      });
    });
  }

  getContent(): Observable<ContentField[]> {
    return new Observable(subscriber => {
      this.adminHeaders().subscribe(headers => {
        this.http.get<ContentField[]>(`${this.baseUrl}/admin/welcome/content`, { headers })
          .subscribe({
            next: r => { subscriber.next(r); subscriber.complete(); },
            error: e => subscriber.error(e)
          });
      });
    });
  }

  patchContent(updates: { key: string; value: string }[]): Observable<{ updated: number }> {
    return new Observable(subscriber => {
      this.adminHeaders().subscribe(headers => {
        this.http.patch<{ updated: number }>(`${this.baseUrl}/admin/welcome/content`, { updates }, { headers })
          .subscribe({
            next: r => { subscriber.next(r); subscriber.complete(); },
            error: e => subscriber.error(e)
          });
      });
    });
  }

  getSettings(): Observable<WelcomeSettings> {
    return new Observable(subscriber => {
      this.adminHeaders().subscribe(headers => {
        this.http.get<WelcomeSettings>(`${this.baseUrl}/admin/welcome/settings`, { headers })
          .subscribe({
            next: r => { subscriber.next(r); subscriber.complete(); },
            error: e => subscriber.error(e)
          });
      });
    });
  }

  updateSettings(body: Partial<WelcomeSettings>): Observable<WelcomeSettings> {
    return new Observable(subscriber => {
      this.adminHeaders().subscribe(headers => {
        this.http.patch<WelcomeSettings>(`${this.baseUrl}/admin/welcome/settings`, body, { headers })
          .subscribe({
            next: r => { subscriber.next(r); subscriber.complete(); },
            error: e => subscriber.error(e)
          });
      });
    });
  }

  sendTestEmail(body: { recipients: string[]; subject: string; body_template: string }): Observable<{ ok: boolean }> {
    return new Observable(subscriber => {
      this.adminHeaders().subscribe(headers => {
        this.http.post<{ ok: boolean }>(`${this.baseUrl}/admin/welcome/settings/test-email`, body, { headers })
          .subscribe({
            next: r => { subscriber.next(r); subscriber.complete(); },
            error: e => subscriber.error(e)
          });
      });
    });
  }
}
