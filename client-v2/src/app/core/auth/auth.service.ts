import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api.service';
import { RuntimeConfigService } from '../runtime-config.service';

export type OrgType = 'agency' | 'supplier' | 'ballpark';

/** Role taxonomy — derived server-side from (orgs.type, user_orgs.is_admin). */
export type Role =
  | 'ballpark_admin'
  | 'agency_admin'
  | 'agency_member'
  | 'supplier_admin'
  | 'supplier_member';

/** The signed-in user as the UI consumes it — flattened to the active org.
 *  Org fields are null until onboarding completes (pV2-02b): an orgless
 *  authenticated user is first-class and gets routed to /onboarding. */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  activeOrgId: string | null;
  activeOrgName: string | null;
  activeOrgType: OrgType | null;
  isAdmin: boolean;
  role: Role | null;
}

/** 401 from /auth/me just means "signed out" — the designed no-session
 *  signal. Anything else (5xx, network, CORS) is a real fault that must not
 *  be swallowed silently (WORKING_STANDARDS §"Catch blocks justify
 *  themselves"). */
function isUnexpectedSessionError(err: unknown): boolean {
  return !(err instanceof HttpErrorResponse && err.status === 401);
}

/** Real auth (pV2-02) — session lives in the bp_session HTTP-only cookie;
 *  this service mirrors it into a signal via GET /auth/me. Same public
 *  surface the pV2-01b stub declared, so consumers didn't change shape. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly rc = inject(RuntimeConfigService);
  private readonly router = inject(Router);

  private readonly _user = signal<SessionUser | null>(null);

  /** The current session user, or null when signed out. */
  readonly user = this._user.asReadonly();
  /** True while a session user is present. */
  readonly isLoggedIn = computed(() => this._user() !== null);
  /** The active membership role; null when signed out OR orgless. */
  readonly role = computed(() => this._user()?.role ?? null);
  /** True when the session user belongs to an active org — orgless users
   *  (signed in, pre-onboarding) are routed to /onboarding instead. */
  readonly hasActiveOrg = computed(() => !!this._user()?.activeOrgId);

  /** Hydrate the session from the cookie (called at bootstrap + callback).
   *  Never throws — a 401 just means signed out; anything else still resolves
   *  to signed-out (the app must boot) but is logged, not swallowed. */
  async loadSession(): Promise<void> {
    try {
      const u = await firstValueFrom(this.api.get<SessionUser>('/auth/me'));
      this._user.set(u);
    } catch (err) {
      if (isUnexpectedSessionError(err)) {
        console.warn('[auth] /auth/me failed unexpectedly — treating as signed out', err);
      }
      this._user.set(null);
    }
  }

  /** Hard redirect to the API's Google OAuth entry point. */
  loginWithGoogle(): void {
    window.location.href = `${this.rc.get().apiBaseUrl}/auth/google`;
  }

  /** Clear the server cookie + local state, land on /login. */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/auth/logout', {}));
    } finally {
      this._user.set(null);
      void this.router.navigate(['/login']);
    }
  }

  /** Dev-only — seeded identities for the login picker + header switcher.
   *  Never rejects: 401/403 are the designed "picker off" signals (prod, or
   *  the gated /api surface) → empty list, silently; any other failure also
   *  yields an empty list but is logged. Error classification lives HERE so
   *  the two resource consumers (login, user-menu) don't duplicate it. */
  async listDevUsers(): Promise<SessionUser[]> {
    try {
      return await firstValueFrom(this.api.get<SessionUser[]>('/api/dev/users'));
    } catch (err) {
      if (!(err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403))) {
        console.warn('[auth] dev user list failed unexpectedly', err);
      }
      return [];
    }
  }

  /** Dev-only — cookie-login as a seeded user, then hard reload so the whole
   *  app re-bootstraps with the fresh session (no leaked state). Lands on
   *  /home — `/` is the public landing page since pV2-02b. */
  async devLogin(userId: string): Promise<void> {
    await firstValueFrom(this.api.post('/auth/dev/login', { userId }));
    window.location.href = '/home';
  }
}
