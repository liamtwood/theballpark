import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { WordmarkComponent } from '../shared/wordmark/wordmark.component';
import { UserMenuComponent } from './user-menu/user-menu.component';

/** Chrome around every authenticated route: transparent fixed header
 *  (wordmark left, user menu right) above the routed page. The pV2-04b1 cog
 *  + page-settings drawer were REMOVED (Liam's simplification, 2026-06-11):
 *  page settings are edited by ballpark admins on the /settings/pages table
 *  instead of per-page drawers. Login/callback routes live OUTSIDE this
 *  component, so they get no header. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, WordmarkComponent, UserMenuComponent],
  host: { class: 'block min-h-screen' },
  template: `
    <header
      class="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-bg px-6"
    >
      <!-- Wordmark routes to /home (pV2-02b): the root is the public landing
           page now; authenticated users clicking the logo belong on home. -->
      <app-wordmark link="/home" />
      @if (auth.isLoggedIn()) {
        <app-user-menu />
      }
    </header>

    <main class="px-6 pb-12 pt-20">
      <router-outlet />
    </main>
  `,
})
export class AppShellComponent {
  protected readonly auth = inject(AuthService);
}
