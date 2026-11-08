import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { SessionUser } from './auth/auth.service';

/** pV2-INVITE-SUPPLIER-01 — one outstanding invite on the accept screen. */
export interface SupplierInvite { supplierOrgId: string; businessName: string; agencies: string[]; }

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

  /** pV2-INVITE-SUPPLIER-01 — the caller's outstanding supplier invites (an
   *  agency invited their business; seat 'invited' on a pending org). */
  supplierInvites(): Observable<SupplierInvite[]> {
    return this.api.get<SupplierInvite[]>('/api/onboarding/supplier-invites');
  }

  /** Accept → org + seat active; the server re-signs the cookie into the org. */
  acceptSupplierInvite(supplierOrgId: string): Observable<SessionUser> {
    return this.api.post<SessionUser>('/api/onboarding/accept-supplier-invite', { supplierOrgId });
  }
}
