import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { WordmarkComponent } from '../wordmark/wordmark.component';

/** Header chrome for PUBLIC pages (landing, login): wordmark → `/` on the
 *  left, Sign In → Google OAuth on the right. The auth shell has its own
 *  header (avatar menu, wordmark → /home) — this one is for pages anonymous
 *  visitors can reach. */
@Component({
  selector: 'app-public-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WordmarkComponent],
  host: {
    class: 'fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-transparent px-6',
  },
  template: `
    <app-wordmark link="/" />
    <button
      type="button"
      class="cursor-pointer text-md font-medium text-text hover:opacity-70"
      (click)="auth.loginWithGoogle()"
    >
      Sign In
    </button>
  `,
})
export class PublicHeaderComponent {
  protected readonly auth = inject(AuthService);
}
