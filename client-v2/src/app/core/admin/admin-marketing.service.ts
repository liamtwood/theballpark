import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';

/** One waitlist signup row (pV2-EA-01 schema). */
export interface SignupRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  source_environment: string;
  created_at: string;
  notified_at: string | null;
}

export interface SignupStats {
  total: number;
  today: number;
  this_week: number;
  by_environment: Record<string, number>;
}

export interface SignupsResponse {
  rows: SignupRow[];
  stats: SignupStats;
}

/** One editable welcome-page copy field. */
export interface ContentField {
  key: string;
  value: string;
  field_type: 'text' | 'longtext' | 'list';
  label: string;
  help_text: string | null;
  slide: number;
  display_order: number;
}

/** Admin-notification email config (`marketing.welcome_settings`). */
export interface WelcomeSettings {
  notify_recipients: string[];
  email_subject: string;
  email_body_template: string;
}

/** pV2-EA-02 — typed client for the gated `/api/admin/*` marketing endpoints.
 *  The admin secret is attached by `adminSecretInterceptor`; this service never
 *  touches it. Mirrors `server/src/routes/adminMarketing.js`. */
@Injectable({ providedIn: 'root' })
export class AdminMarketingService {
  private readonly api = inject(ApiService);

  // ── Signups ──────────────────────────────────────────────────────────
  listSignups(opts: { q?: string; envs?: string[]; sort?: 'newest' | 'oldest' }): Observable<SignupsResponse> {
    const p = new URLSearchParams();
    if (opts.q) p.set('q', opts.q);
    if (opts.envs?.length) p.set('envs', opts.envs.join(','));
    if (opts.sort) p.set('sort', opts.sort);
    const qs = p.toString();
    return this.api.get<SignupsResponse>(`/api/admin/signups${qs ? '?' + qs : ''}`);
  }

  deleteSignup(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/api/admin/signups/${id}`);
  }

  // ── Welcome page content ─────────────────────────────────────────────
  getContent(): Observable<ContentField[]> {
    return this.api.get<ContentField[]>('/api/admin/welcome/content');
  }

  patchContent(updates: { key: string; value: string }[]): Observable<{ updated: number }> {
    return this.api.patch<{ updated: number }>('/api/admin/welcome/content', { updates });
  }

  // ── Admin-notification email settings ────────────────────────────────
  getSettings(): Observable<WelcomeSettings> {
    return this.api.get<WelcomeSettings>('/api/admin/welcome/settings');
  }

  updateSettings(body: Partial<WelcomeSettings>): Observable<WelcomeSettings> {
    return this.api.patch<WelcomeSettings>('/api/admin/welcome/settings', body);
  }

  sendTestEmail(body: { recipients: string[]; subject: string; body_template: string }): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>('/api/admin/welcome/settings/test-email', body);
  }
}
