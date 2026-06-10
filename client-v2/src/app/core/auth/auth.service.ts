import { Injectable, computed, inject, signal } from '@angular/core';
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

/** The signed-in user as the UI consumes it — flattened to the active org. */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  activeOrgId: string;
  activeOrgName: string;
  activeOrgType: OrgType;
  isAdmin: boolean;
  role: Role;
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
  /** The active membership role, or null when signed out. */
  readonly role = computed(() => this._user()?.role ?? null);

  /** Hydrate the session from the cookie (called at bootstrap + callback).
   *  Never throws — no/expired cookie just means signed out. */
  async loadSession(): Promise<void> {
    try {
      const u = await firstValueFrom(this.api.get<SessionUser>('/auth/me'));
      this._user.set(u);
    } catch {
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

  /** Dev-only — seeded identities for the login picker. 403 (→ throw) in
   *  prod; callers treat failure as an empty list. */
  listDevUsers(): Promise<SessionUser[]> {
    return firstValueFrom(this.api.get<SessionUser[]>('/api/dev/users'));
  }

  /** Dev-only — cookie-login as a seeded user, then hard reload so the whole
   *  app re-bootstraps with the fresh session (no leaked state). */
  async devLogin(userId: string): Promise<void> {
    await firstValueFrom(this.api.post('/auth/dev/login', { userId }));
    window.location.href = '/';
  }
}
