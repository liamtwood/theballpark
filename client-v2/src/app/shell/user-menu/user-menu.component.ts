import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PopoverModule, Popover } from 'primeng/popover';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { can } from '../../core/auth/permissions';
import { UserAvatarComponent } from '../../shared/user-avatar/user-avatar.component';

/** Header avatar + dropdown: current identity, admin links, sign out.
 *  `p-popover` over `p-menu` — rich content (avatar header + rows) fits a
 *  free-content overlay. The View-as (dev) switcher was REMOVED in v2.12d
 *  (Liam, 2026-06-12: one account = one role; role testing uses separate
 *  accounts via the login page's dev picker). */
@Component({
  selector: 'app-user-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PopoverModule, UserAvatarComponent],
  template: `
    @if (auth.user(); as user) {
      <button
        type="button"
        class="block cursor-pointer rounded-full transition-opacity hover:opacity-80"
        (click)="menu.toggle($event)"
        aria-label="Account menu"
      >
        <app-user-avatar
          [displayName]="user.displayName"
          [email]="user.email"
          [imageUrl]="user.avatarUrl"
          [size]="40"
        />
      </button>

      <p-popover #menu>
        <div class="w-64">
          <!-- Current user -->
          <div class="flex items-center gap-3 px-1 pb-3">
            <app-user-avatar
              [displayName]="user.displayName"
              [email]="user.email"
              [imageUrl]="user.avatarUrl"
              [size]="36"
            />
            <div class="min-w-0">
              <div class="truncate text-md font-semibold">{{ user.displayName ?? user.email }}</div>
              <div class="truncate text-sm text-secondary">
                {{ user.role }} · {{ user.activeOrgName }}
              </div>
            </div>
          </div>

          <!-- Platform-admin links — same gate as the pages they open. -->
          @if (canEditPageSettings()) {
            <div class="border-t border-hairline pt-2">
              <a
                routerLink="/settings/pages"
                class="block w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-md text-text no-underline hover:bg-fill"
                (click)="menu.hide()"
              >
                Page settings
              </a>
              <a
                routerLink="/settings/early-access"
                class="block w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-md text-text no-underline hover:bg-fill"
                (click)="menu.hide()"
              >
                Early access
              </a>
            </div>
          }

          <!-- Build chip + sign out (the chip moved here off the floating
               footer — Liam, 2026-06-12). -->
          <div class="mt-2 border-t border-hairline pt-2">
            <div class="bp-meta px-1 pb-1">{{ versionChip }}</div>
            <!-- Version history — what's on dev vs already on preview
                 (the demo list). Liam, 2026-07-17. -->
            <a
              routerLink="/whats-new"
              class="block w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-md text-text no-underline hover:bg-fill"
              (click)="menu.hide()"
            >
              What's new
            </a>
            <button
              type="button"
              class="w-full cursor-pointer rounded-md px-1 py-1.5 text-left text-md text-text hover:bg-fill"
              (click)="signOut(menu)"
            >
              Sign out
            </button>
          </div>
        </div>
      </p-popover>
    }
  `,
})
export class UserMenuComponent {
  protected readonly auth = inject(AuthService);

  /** The build chip — lives here since the floating footer retired. */
  protected readonly versionChip = environment.versionChip;

  /** Page-settings link mirrors the route's ballparkAdminGuard gate. */
  protected readonly canEditPageSettings = computed(() => can(this.auth.role(), 'admin.cross_org_view'));

  protected signOut(menu: Popover): void {
    menu.hide();
    void this.auth.logout();
  }
}
