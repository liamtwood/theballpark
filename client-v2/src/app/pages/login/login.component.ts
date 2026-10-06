import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/api.service';
import { PublicHeaderComponent } from '../../shared/public-header/public-header.component';

/** A seeded dev identity (GET /api/dev/users — dev/non-prod only). */
interface DevUser {
  id: string;
  email: string;
  displayName: string;
  activeOrgName: string | null;
  role: string | null;
}

/** Sign-in page. Primary action is the Google button (real role testing uses
 *  real Google accounts — Liam, 2026-06-12). The rebuild/org-slice branch runs
 *  against v2dev where OAuth isn't wired, so the old dev picker is restored HERE
 *  as QC tooling: it renders ONLY when GET /api/dev/users returns seeds (empty /
 *  403 in any real env), so it's invisible in prod. */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PublicHeaderComponent],
  host: { class: 'flex min-h-screen items-center justify-center px-6' },
  template: `
    <app-public-header />

    <section class="w-full max-w-sm rounded-2xl bg-surface-alt p-8 shadow-sm">
      <h1 class="text-2xl font-semibold tracking-tight">Sign in to Ballpark</h1>
      <p class="mt-1 text-md text-secondary">Continue with Google to access your account.</p>

      <!-- Google sign-in per Google's branding (white, hairline, G mark) —
           deliberately NOT a p-button/.bp-btn: third-party identity chrome. -->
      <button
        type="button"
        class="bp-btn-outline mt-6 w-full"
        (click)="auth.loginWithGoogle()"
      >
        <img src="/google-g.svg" alt="" width="18" height="18" />
        Continue with Google
      </button>

      @if (devUsers().length) {
        <div class="mt-6 border-t border-default pt-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-secondary">Dev sign-in · v2dev</p>
          @for (u of devUsers(); track u.id) {
            <button type="button" class="bp-btn-outline mt-2 w-full justify-start text-left" (click)="auth.devLogin(u.id)">
              <span class="truncate">{{ u.displayName || u.email }}</span>
              <span class="ml-auto text-xs text-secondary">{{ u.activeOrgName }} · {{ u.role }}</span>
            </button>
          }
        </div>
      }
    </section>
  `,
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  protected readonly devUsers = signal<DevUser[]>([]);

  constructor() {
    // Dev-only: populate the picker when seeds exist; silent no-op otherwise.
    this.api.get<DevUser[]>('/api/dev/users').subscribe({
      next: (u) => this.devUsers.set(u || []),
      error: () => this.devUsers.set([]),
    });
  }
}
