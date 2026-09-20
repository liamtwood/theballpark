import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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
      <div class="bp-header-inset flex h-14 items-center justify-between">
        <!-- Wordmark routes to /home (pV2-02b): the root is the public landing
             page; authenticated users clicking the logo belong on home. -->
        <app-wordmark link="/home" />
        @if (auth.isLoggedIn()) {
          <app-user-menu />
        }
      </div>

      @if (auth.isLoggedIn()) {
        <nav class="bp-header-inset flex items-center gap-1 overflow-x-auto pb-2">
          @for (item of navItems(); track item.path) {
            <a [routerLink]="item.path" [queryParams]="item.query ?? null"
               routerLinkActive="bp-nav-link--active"
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
    <main class="px-6 pb-[var(--shell-pb)] pt-[var(--shell-pt)] bp-main--workspace">
      <router-outlet />
    </main>

    <!-- One app-wide confirmation modal (DIALOGS.md). -->
    <app-confirm-dialog />
  `,
})
export class AppShellComponent {
  protected readonly auth = inject(AuthService);

  /** Primary nav, persona-aware — mirrors the launcher tile sets so the header
   *  and home agree. Suppliers manage incoming work + their shop (no create);
   *  ballpark admins get the platform-admin surfaces (approvals + settings), NOT
   *  agency New/Past projects (BE-00126). Every destination is an existing authed
   *  route. */
  protected readonly navItems = computed(() => {
    const t = this.auth.user()?.activeOrgType;
    if (t === 'ballpark') return BALLPARK_NAV;
    if (t === 'supplier') return SUPPLIER_NAV;
    return AGENCY_NAV;
  });
}

interface NavItem {
  label: string;
  path: string;
  icon: string;
  exact: boolean;
  query?: Record<string, string>;
}

/** Agency (default) — create + track projects, message suppliers, browse. */
const AGENCY_NAV: readonly NavItem[] = [
  { label: 'Overview', path: '/home', icon: 'layout-grid', exact: true },
  { label: 'New project', path: '/projects/new', icon: 'folder-plus', exact: true },
  { label: 'Past projects', path: '/projects', icon: 'folder-open', exact: true },
  { label: 'Messages', path: '/inbox', icon: 'message-square', exact: false },
  { label: 'Marketplace', path: '/marketplace', icon: 'store', exact: false },
  { label: 'Profile', path: '/settings/profile', icon: 'circle-user', exact: false },
];

/** Supplier — incoming work + conversations + their storefront (no create). */
const SUPPLIER_NAV: readonly NavItem[] = [
  { label: 'Overview', path: '/home', icon: 'layout-grid', exact: true },
  { label: 'Projects', path: '/projects-hub', icon: 'folder-open', exact: false },
  { label: 'Messages', path: '/inbox', icon: 'message-square', exact: false },
  { label: 'Marketplace', path: '/marketplace', icon: 'store', exact: false },
  { label: 'My Shop', path: '/store', icon: 'package', exact: false },
  { label: 'Profile', path: '/settings/profile', icon: 'circle-user', exact: false },
];

/** Ballpark platform admin (BE-00126) — mirrors BALLPARK_TILES. Marketplace is
 *  the moderation queue (Approvals → status=pending), NOT the consumer browse;
 *  no New/Past projects or Messages. Orgs is a net-new page, deferred. */
const BALLPARK_NAV: readonly NavItem[] = [
  { label: 'Overview', path: '/home', icon: 'layout-grid', exact: true },
  { label: 'Approvals', path: '/marketplace', icon: 'store', exact: false, query: { status: 'pending' } },
  { label: 'Page Settings', path: '/settings/pages', icon: 'settings', exact: false },
  { label: 'Categories', path: '/settings/categories', icon: 'tags', exact: false },
  { label: 'Codelists', path: '/settings/codelists', icon: 'list-checks', exact: false },
  { label: 'Coachmarks', path: '/settings/coachmarks', icon: 'circle-help', exact: false },
  { label: 'Early Access', path: '/settings/early-access', icon: 'rocket', exact: false },
  { label: 'Profile', path: '/settings/profile', icon: 'circle-user', exact: false },
];
