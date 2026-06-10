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
      <a routerLink="/" class="text-sm font-semibold tracking-tight" style="color: var(--theme-accent)">
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
