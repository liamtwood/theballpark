import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../core/auth/auth.service';
import { WordmarkComponent } from '../shared/wordmark/wordmark.component';
import { UserMenuComponent } from './user-menu/user-menu.component';
import { ConfirmDialogComponent } from '../shared/confirm/confirm-dialog.component';

/** Chrome around every authenticated route: a frosted, fixed single-row header
 *  (wordmark · primary nav · account + Sign Out) over the routed page.
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
      <!-- ONE row (Liam 2026-10-26): wordmark HARD-PINNED to the left window edge
           (px-6 = 24px), the primary nav in the middle, the account cluster + Sign
           Out hard-pinned to the right edge. flex reserves space so nothing
           overlaps; the nav scrolls on a narrow window. -->
      <div class="flex h-14 items-center gap-4 px-6">
        <!-- Wordmark routes to /home (pV2-02b): authenticated users clicking the
             logo belong on home. -->
        <app-wordmark link="/home" class="shrink-0" />

        @if (auth.isLoggedIn()) {
          <nav class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            @for (item of navItems(); track item.path) {
              <a [routerLink]="item.path" [queryParams]="item.query ?? null"
                 routerLinkActive="bp-nav-link--active"
                 [routerLinkActiveOptions]="{ exact: item.exact }" class="bp-nav-link">
                <lucide-icon [name]="item.icon" [size]="16" [strokeWidth]="1.75" />{{ item.label }}
              </a>
            }
          </nav>
        } @else {
          <span class="flex-1"></span>
        }

        <div class="flex shrink-0 items-center gap-3">
          <!-- FR-00215/FR-00236 — org context: you've switched into an org you hold a
               seat in and are acting AS it (session-only). Clear indicator + one
               click back to where you switched from (admin → orgs). -->
          @if (auth.isAwayFromHome()) {
            <span class="flex items-center gap-2 rounded-full border border-hairline bg-fill px-3 py-1 text-sm">
              <span class="text-secondary">Acting as</span>
              <strong class="font-medium text-accent">{{ auth.user()?.activeOrgName }}</strong>
              <button type="button" class="font-medium text-accent underline-offset-2 hover:underline" (click)="returnHome()">Return to Ballpark</button>
            </span>
          }
          @if (auth.isLoggedIn()) {
            <app-user-menu />
            <button type="button" class="bp-btn-grad" (click)="signOut()">Sign Out</button>
          }
        </div>
      </div>
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

  /** Switch back to the user's home org and land on admin → orgs (where the
   *  switch was initiated — the only UI entry point). */
  protected async returnHome(): Promise<void> {
    const home = this.auth.user()?.homeOrgId;
    if (home) await this.auth.switchOrg(home, '/admin/orgs');
  }

  /** Sign out from the header button (mirrors the user-menu's sign-out). */
  protected signOut(): void {
    void this.auth.logout();
  }
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
  { label: 'Home', path: '/home', icon: 'layout-grid', exact: true },
  { label: 'New project', path: '/projects/new', icon: 'folder-plus', exact: true },
  { label: 'Projects', path: '/projects', icon: 'folder-open', exact: true },
  { label: 'Messages', path: '/inbox', icon: 'message-square', exact: false },
  { label: 'Marketplace', path: '/marketplace', icon: 'store', exact: false },
  { label: 'Profile', path: '/settings/profile', icon: 'circle-user', exact: false },
];

/** Supplier — incoming work + conversations + their storefront (no create). */
const SUPPLIER_NAV: readonly NavItem[] = [
  { label: 'Home', path: '/home', icon: 'layout-grid', exact: true },
  { label: 'Projects', path: '/projects-hub', icon: 'folder-open', exact: false },
  { label: 'Messages', path: '/inbox', icon: 'message-square', exact: false },
  { label: 'Marketplace', path: '/marketplace', icon: 'store', exact: false },
  { label: 'My Shop', path: '/store', icon: 'package', exact: false },
  { label: 'Profile', path: '/settings/profile', icon: 'circle-user', exact: false },
];

/** Ballpark platform admin (BE-00128/BE-00130) — four top-level items; the
 *  config surfaces live under the Admin hub, and full Marketplace browse stays a
 *  home tile (not the header). Approvals is the moderation queue (status=pending). */
const BALLPARK_NAV: readonly NavItem[] = [
  { label: 'Home', path: '/home', icon: 'layout-grid', exact: true },
  { label: 'Approvals', path: '/marketplace', icon: 'circle-check', exact: false, query: { status: 'pending' } },
  { label: 'Admin', path: '/admin', icon: 'settings', exact: false },
  { label: 'Profile', path: '/settings/profile', icon: 'circle-user', exact: false },
];
