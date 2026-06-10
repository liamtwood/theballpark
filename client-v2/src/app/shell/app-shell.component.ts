import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { UserMenuComponent } from './user-menu/user-menu.component';

/** Chrome around every authenticated route: transparent fixed header
 *  (wordmark left, user menu right) above the routed page. Login/callback
 *  routes live OUTSIDE this component, so they get no header. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, UserMenuComponent],
  host: { class: 'block min-h-screen' },
  template: `
    <header
      class="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-transparent px-6"
    >
      <!-- pV2-01f — wordmark metrics exactly match the 40px avatar's initials
           (16px / 600 / line-height 1 / 0 tracking / --bp-font). Explicit span
           styles, no Tailwind text-sm/tracking-tight (those caused the 14px +
           negative-tracking mismatch found in QC). -->
      <a
        routerLink="/"
        style="font-family: var(--bp-font); font-size: 16px; font-weight: 600; line-height: 1; letter-spacing: 0; color: var(--bp-text-color); text-decoration: none"
      >
        Ballpark
      </a>
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
