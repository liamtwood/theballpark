import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { SessionUser } from './auth/auth.service';

/** pV2-02b — onboarding API. create-org turns an orgless authenticated user
 *  into the admin of a new org; the server re-signs the session cookie with
 *  the new org_id, so callers hard-reload afterwards (fresh app, fresh
 *  session — same pattern as devLogin and the Google callback). */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly api = inject(ApiService);

  createOrg(payload: { orgType: 'agency' | 'supplier'; orgName: string }): Observable<SessionUser> {
    return this.api.post<SessionUser>('/api/onboarding/create-org', payload);
  }
}
