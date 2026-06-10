import { Injectable, computed, signal } from '@angular/core';

/** Role taxonomy — mirrors `prompts/auth-and-users-plan.md` (role lives on the
 *  membership, derived from org.type + is_admin). */
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
  activeOrgType: 'agency' | 'supplier' | 'ballpark';
  isAdmin: boolean;
  role: Role;
}

// Fixed list of fake users for dev — replaced by /api/dev/users in pV2-02.
const STUB_USERS: SessionUser[] = [
  {
    id: 'stub-sm',
    email: 'sarah@creative-agency.example',
    displayName: 'Sarah Mitchell',
    avatarUrl: null,
    activeOrgId: 'stub-cag',
    activeOrgName: 'Creative Agency Ltd',
    activeOrgType: 'agency',
    isAdmin: true,
    role: 'agency_admin',
  },
  {
    id: 'stub-bp',
    email: 'beth@ballpark.example',
    displayName: 'Beth Pizey',
    avatarUrl: null,
    activeOrgId: 'stub-bp-org',
    activeOrgName: 'Ballpark',
    activeOrgType: 'ballpark',
    isAdmin: true,
    role: 'ballpark_admin',
  },
  {
    id: 'stub-ry',
    email: 'ryan@rocketfood.example',
    displayName: 'Ryan Chen',
    avatarUrl: null,
    activeOrgId: 'stub-rf',
    activeOrgName: 'Rocket Food',
    activeOrgType: 'supplier',
    isAdmin: true,
    role: 'supplier_admin',
  },
  {
    id: 'stub-am',
    email: 'alex@creative-agency.example',
    displayName: 'Alex Martin',
    avatarUrl: null,
    activeOrgId: 'stub-cag',
    activeOrgName: 'Creative Agency Ltd',
    activeOrgType: 'agency',
    isAdmin: false,
    role: 'agency_member',
  },
];

/** STUB auth — in-memory signal state, same public surface as the real
 *  HTTP-backed implementation that arrives in pV2-02. Components built against
 *  this don't change when the implementation swaps. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  // Start logged in as Sarah for dev convenience.
  private readonly _user = signal<SessionUser | null>(STUB_USERS[0]);

  /** The current session user, or null when signed out. */
  readonly user = this._user.asReadonly();
  /** True while a session user is present. */
  readonly isLoggedIn = computed(() => this._user() !== null);
  /** The active membership role, or null when signed out. */
  readonly role = computed(() => this._user()?.role ?? null);

  /** Dev-only — the pickable stub identities (real impl: /api/dev/users). */
  listDevUsers(): SessionUser[] {
    return STUB_USERS;
  }

  /** Dev-only — switch the in-memory session to the given stub user. */
  devLogin(userId: string): void {
    const u = STUB_USERS.find((x) => x.id === userId);
    if (u) {
      this._user.set(u);
    }
  }

  /** Real Google OAuth lands in pV2-02. */
  loginWithGoogle(): void {
    console.warn('Google OAuth lands in pV2-02');
  }

  /** Clear the in-memory session. */
  logout(): void {
    this._user.set(null);
  }
}
