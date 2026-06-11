import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** OAuth landing — Google's flow ends with the API redirecting here
 *  (?login=ok) after setting the bp_session cookie. We hydrate the session
 *  signal, hold the spinner ~1s so the transition doesn't flash, then land
 *  at `/` (or back at /login with an error flag). */
@Component({
  selector: 'app-auth-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-screen items-center justify-center px-6' },
  template: `
    <section class="text-center">
      <div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-hairline" style="border-top-color: var(--theme-accent)"></div>
      <h1 class="text-xl font-semibold tracking-tight">Signing you in…</h1>
    </section>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const start = Date.now();
    void this.auth.loadSession().then(() => {
      const wait = Math.max(0, 1000 - (Date.now() - start));
      setTimeout(() => {
        if (this.auth.isLoggedIn()) {
          void this.router.navigate(['/']);
        } else {
          void this.router.navigate(['/login'], { queryParams: { error: 'auth_failed' } });
        }
      }, wait);
    });
  }
}
