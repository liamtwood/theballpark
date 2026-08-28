import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../core/auth/auth.service';
import { WordmarkComponent } from '../shared/wordmark/wordmark.component';
import { UserMenuComponent } from './user-menu/user-menu.component';
import { ConfirmDialogComponent } from '../shared/confirm/confirm-dialog.component';

/** Chrome around every authenticated route: a frosted, fixed two-row header
 *  (wordmark + account on row 1, primary nav on row 2) over the routed page.
 *  The primary nav (Overview / New project / Past projects / Messages /
 *  Marketplace / Profile) means you can jump anywhere without going Back. The
 *  project-detail route paints its <main> with the pink "workspace" ground.
 *  Login/callback routes live OUTSIDE this component, so they get no header. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule,
    WordmarkComponent, UserMenuComponent, ConfirmDialogComponent,
  ],
  host: { class: 'block min-h-screen' },
  template: `
    <header class="bp-app-header fixed inset-x-0 top-0 z-40">
      <div class="flex h-14 items-center justify-between px-6">
        <!-- Wordmark routes to /home (pV2-02b): the root is the public landing
             page; authenticated users clicking the logo belong on home. -->
        <app-wordmark link="/home" />
        @if (auth.isLoggedIn()) {
          <app-user-menu />
        }
      </div>

      @if (auth.isLoggedIn()) {
        <nav class="flex items-center gap-1 overflow-x-auto px-6 pb-2">
          @for (item of navItems; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="bp-nav-link--active"
               [routerLinkActiveOptions]="{ exact: item.exact }" class="bp-nav-link">
              <lucide-icon [name]="item.icon" [size]="16" [strokeWidth]="1.75" />{{ item.label }}
            </a>
          }
        </nav>
      }
    </header>

    <!-- Vertical paddings ride the --shell-pt/--shell-pb tokens — the SAME pair
         the vpfit height calc consumes (audit cards-F-1). The project-detail
         route paints the pink workspace ground full-bleed behind the header. -->
    <main class="px-6 pb-[var(--shell-pb)] pt-[var(--shell-pt)]" [class.bp-main--workspace]="isWorkspace()">
      <router-outlet />
    </main>

    <!-- One app-wide confirmation modal (DIALOGS.md). -->
    <app-confirm-dialog />
  `,
})
export class AppShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Primary nav — every destination is an existing authed route. */
  protected readonly navItems = [
    { label: 'Overview', path: '/home', icon: 'layout-grid', exact: true },
    { label: 'New project', path: '/projects/new', icon: 'folder-plus', exact: true },
    { label: 'Past projects', path: '/projects', icon: 'folder-open', exact: true },
    { label: 'Messages', path: '/inbox', icon: 'message-square', exact: false },
    { label: 'Marketplace', path: '/marketplace', icon: 'store', exact: false },
    { label: 'Profile', path: '/settings/profile', icon: 'circle-user', exact: false },
  ];

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** True on a single project's detail page (/projects/:id) — the workspace. */
  protected readonly isWorkspace = computed(() =>
    /^\/projects\/[^/]+$/.test((this.url() || '').split('?')[0]),
  );
}
