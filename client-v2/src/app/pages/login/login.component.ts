import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { PublicHeaderComponent } from '../../shared/public-header/public-header.component';

/** Sign-in page: ONE action — the Google-branded button (Liam, 2026-06-12:
 *  the dev role picker is gone; role testing uses real Google accounts, one
 *  per role, through the normal OAuth → onboarding flow). Carries the
 *  public chrome so a direct /login hit matches the landing page. */
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
    </section>
  `,
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
}
