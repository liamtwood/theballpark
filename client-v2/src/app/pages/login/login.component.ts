import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { AuthService, SessionUser } from '../../core/auth/auth.service';
import { UserAvatarComponent } from '../../shared/user-avatar/user-avatar.component';

/** Sign-in surface. Google OAuth is the primary CTA (real since pV2-02); the
 *  dev picker lists seeded identities from /api/dev/users — the endpoint
 *  returns 403 in production, which resolves to an empty list here and the
 *  section simply doesn't render. */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, UserAvatarComponent],
  host: { class: 'flex min-h-screen items-center justify-center px-6' },
  template: `
    <section class="w-full max-w-sm rounded-2xl bg-surface-alt p-8 shadow-sm">
      <h1 class="text-2xl font-semibold tracking-tight">Sign in to Ballpark</h1>
      <p class="mt-1 text-sm text-secondary">Continue with Google to access your account.</p>

      <p-button label="Continue with Google" styleClass="w-full" class="mt-6 block" (onClick)="auth.loginWithGoogle()" />

      @if (devUsers.value(); as users) {
        @if (users.length > 0) {
          <div class="mt-8">
            <div class="flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted">
              <span class="h-px flex-1 bg-hairline"></span>
              or, for dev, pick a user
              <span class="h-px flex-1 bg-hairline"></span>
            </div>

            <div class="mt-3 overflow-hidden rounded-xl border border-hairline bg-surface">
              @for (dev of users; track dev.id) {
                <button
                  type="button"
                  class="flex w-full cursor-pointer items-center gap-3 border-b border-hairline px-4 py-2.5 text-left last:border-b-0 hover:bg-fill"
                  (click)="devLogin(dev.id)"
                >
                  <app-user-avatar [displayName]="dev.displayName" [email]="dev.email" [size]="28" />
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-medium">{{ dev.displayName }}</span>
                    <span class="block truncate text-xs text-secondary">
                      {{ dev.activeOrgType }} · {{ dev.isAdmin ? 'Admin' : 'Member' }}
                    </span>
                  </span>
                </button>
              }
            </div>
          </div>
        }
      }
    </section>
  `,
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);

  /** Seeded dev identities — resource per the v2 fetch-into-state standard.
   *  listDevUsers never rejects (401/403 → empty list, faults logged there).
   *  TODO(third-use): user-menu holds this resource's twin — a third consumer
   *  extracts a shared devUsersResource() helper. */
  protected readonly devUsers = resource<SessionUser[], void>({
    loader: () => this.auth.listDevUsers(),
  });

  protected devLogin(userId: string): void {
    void this.auth.devLogin(userId); // sets cookie then hard-reloads to '/'
  }
}
